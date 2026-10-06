import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calculateQuote, PricingError, type PricingConfig, type PricingSettings, type QuoteInput } from "@/lib/pricing/engine";

const DEFAULT_SETTINGS: PricingSettings = {
  enabled: false, currency: "BDT", min_duration: 5, max_duration: 180, duration_step: 5, rounding_increment: 100,
  tax: { enabled: false, label: "VAT", percentage: 0, inclusive: false },
};

/** Loads only what anon RLS allows (published / enabled rows). */
async function loadPublicConfig(): Promise<PricingConfig> {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const [set, vt, md, tr, rt, ad, sc] = await Promise.all([
    sb.from("site_settings").select("settings").eq("setting_group", "pricing").maybeSingle(),
    sb.from("pricing_video_types").select("id,name,slug,base_creative_fee,minimum_project_price,published").order("sort_order"),
    sb.from("pricing_ai_models").select("id,name,slug,available,published").order("sort_order"),
    sb.from("pricing_production_tiers").select("id,name,slug,multiplier,published").order("sort_order"),
    sb.from("pricing_model_rates").select("id,video_type_id,ai_model_id,selling_rate_per_second,currency,enabled"),
    sb.from("pricing_addons").select("id,name,charge_type,amount,percentage,enabled,published").order("sort_order"),
    sb.from("pricing_addon_video_types").select("addon_id,video_type_id"),
  ]);
  const err = [set, vt, md, tr, rt, ad, sc].find((r) => r.error)?.error;
  if (err) { console.error("[pricing] load failed", err); throw new PricingError("load_failed", "Pricing is unavailable."); }
  const s = (set.data?.settings ?? {}) as Partial<PricingSettings>;
  const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: (keyof T)[]) =>
    (rows ?? []).map((r) => { const o = { ...r }; for (const k of keys) if (o[k] != null) (o as Record<keyof T, unknown>)[k] = Number(o[k]); return o; });
  return {
    settings: { ...DEFAULT_SETTINGS, ...s, tax: { ...DEFAULT_SETTINGS.tax, ...(s.tax ?? {}) } },
    videoTypes: num(vt.data, ["base_creative_fee", "minimum_project_price"]) as PricingConfig["videoTypes"],
    models: (md.data ?? []) as PricingConfig["models"],
    tiers: num(tr.data, ["multiplier"]) as PricingConfig["tiers"],
    rates: num(rt.data, ["selling_rate_per_second"]) as PricingConfig["rates"],
    addons: num(ad.data, ["amount", "percentage"]).map((a) => ({
      ...a, video_type_ids: (sc.data ?? []).filter((x) => x.addon_id === a.id).map((x) => x.video_type_id),
    })) as PricingConfig["addons"],
  };
}

const QuoteSchema = z.object({
  videoTypeId: z.string().uuid(), modelId: z.string().uuid(), tierId: z.string().uuid(),
  durationSeconds: z.number().int().positive().max(3600),
  addons: z.array(z.object({ id: z.string().uuid(), scenes: z.number().int().positive().max(500).optional() })).max(30).optional(),
});

/** Server-side recalculation — the only trusted quote. Browser totals are never accepted. */
export const calculatePublicQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => QuoteSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const config = await loadPublicConfig();
      return { ok: true as const, quote: calculateQuote(config, data as QuoteInput, "public") };
    } catch (e) {
      if (e instanceof PricingError) return { ok: false as const, code: e.code, message: e.message };
      throw e;
    }
  });
