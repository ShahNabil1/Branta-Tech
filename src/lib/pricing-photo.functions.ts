import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { PricingError } from "./pricing/engine";
import { calculatePhotoQuote, DEFAULT_PHOTO_SETTINGS, type PhotoConfig, type PhotoSettings } from "./pricing/photo-engine";

function anon() {
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
  });
}

/** Only anon-RLS-visible rows (published + priced). Enabled only when shared public pricing AND photography are switched on. */
export async function loadPublicPhotoConfig(): Promise<PhotoConfig & { descriptions: Record<string, string>; examples: Record<string, string> }> {
  const sb = await anon();
  const [set, shared, cats, views, pk, pv, ad, bt] = await Promise.all([
    sb.from("site_settings").select("settings").eq("setting_group", "pricing_photo").maybeSingle(),
    sb.from("site_settings").select("settings").eq("setting_group", "pricing").maybeSingle(),
    sb.from("pricing_photo_categories").select("id,name,slug,description,price_per_image,bulk_eligible,published").order("sort_order"),
    sb.from("pricing_photo_views").select("id,name,slug,applies_to,published").order("sort_order"),
    sb.from("pricing_photo_packages").select("id,name,slug,description,price_per_product,image_count,example_image_url,bulk_eligible,published").order("sort_order"),
    sb.from("pricing_photo_package_views").select("package_id,view_id,position").order("position"),
    sb.from("pricing_photo_addons").select("id,name,description,charge_type,amount,percentage,enabled,published").order("sort_order"),
    sb.from("pricing_photo_bulk_tiers").select("id,min_products,max_products,discount_percentage,custom_quote,published").order("min_products"),
  ]);
  const err = [set, shared, cats, views, pk, pv, ad, bt].find((r) => r.error)?.error;
  if (err) { console.error("[pricing-photo] load failed", err); throw new PricingError("load_failed", "Pricing is unavailable."); }
  const p = (set.data?.settings ?? {}) as Partial<PhotoSettings>;
  const sh = (shared.data?.settings ?? {}) as { enabled?: boolean; public_visible?: boolean; tax?: PhotoSettings["tax"] };
  const n = (v: unknown) => (v == null ? null : Number(v));
  const descriptions: Record<string, string> = {}, examples: Record<string, string> = {};
  for (const r of [...(cats.data ?? []), ...(pk.data ?? []), ...(ad.data ?? [])]) if (r.description) descriptions[r.id] = r.description;
  for (const r of pk.data ?? []) if (r.example_image_url && /^https:\/\//.test(r.example_image_url)) examples[r.id] = r.example_image_url;
  return {
    settings: { ...DEFAULT_PHOTO_SETTINGS, ...p, enabled: !!p.enabled && !!sh.enabled && !!sh.public_visible, tax: { ...DEFAULT_PHOTO_SETTINGS.tax, ...(sh.tax ?? {}) } },
    categories: (cats.data ?? []).map((c) => ({ ...c, price_per_image: n(c.price_per_image) })),
    views: (views.data ?? []) as PhotoConfig["views"],
    packages: (pk.data ?? []).map((x) => ({ ...x, price_per_product: n(x.price_per_product), view_ids: (pv.data ?? []).filter((v) => v.package_id === x.id).map((v) => v.view_id) })),
    addons: (ad.data ?? []).map((a) => ({ ...a, charge_type: a.charge_type as PhotoConfig["addons"][number]["charge_type"], amount: n(a.amount), percentage: n(a.percentage) })),
    bulkTiers: (bt.data ?? []).map((t) => ({ ...t, discount_percentage: n(t.discount_percentage) })),
    descriptions, examples,
  };
}

export type PublicPhotoPricing = { active: false } | { active: true; config: PhotoConfig; descriptions: Record<string, string>; examples: Record<string, string> };

export const getPublicPhotoPricing = createServerFn({ method: "GET" }).handler(async (): Promise<PublicPhotoPricing> => {
  try {
    const { descriptions, examples, ...config } = await loadPublicPhotoConfig();
    if (!config.settings.enabled || !(config.categories.length || config.packages.length)) return { active: false };
    return { active: true, config, descriptions, examples };
  } catch { return { active: false }; }
});

export const publicPhotoPricingQuery = queryOptions({ queryKey: ["public", "pricing-photo"], queryFn: () => getPublicPhotoPricing(), staleTime: 60 * 1000 });

export const PhotoSelectionSchema = z.object({
  mode: z.enum(["individual", "package"]),
  categoryId: z.string().uuid().optional(), packageId: z.string().uuid().optional(),
  workflow: z.string().max(40), products: z.number().int().positive().max(1000),
  imagesPerProduct: z.number().int().positive().max(100).optional(),
  viewIds: z.array(z.string().uuid()).max(30).optional(),
  background: z.string().max(80).optional(), modelRequired: z.boolean().optional(),
  specs: z.string().max(1000).optional(),
  addons: z.array(z.object({ id: z.string().uuid() })).max(30).optional(),
});

/** Trusted server recalculation for the photography calculator. */
export const calculatePublicPhotoQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PhotoSelectionSchema.parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, quote: calculatePhotoQuote(await loadPublicPhotoConfig(), data, "public") }; }
    catch (e) { if (e instanceof PricingError) return { ok: false as const, code: e.code, message: e.message }; throw e; }
  });
