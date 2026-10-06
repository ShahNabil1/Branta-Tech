/** Control Centre pricing data access (browser client, RLS: private.is_cms_admin()). */
import { supabase } from "@/integrations/supabase/client";
import { must, getSettingsGroup, saveSettingsGroup } from "@/lib/supabase/cms";
import type { Tables } from "@/integrations/supabase/types";
import type { PricingConfig, PricingSettings } from "./engine";

export type VideoTypeRow = Tables<"pricing_video_types">;
export type ModelRow = Tables<"pricing_ai_models">;
export type RateRow = Tables<"pricing_model_rates">;
export type TierRow = Tables<"pricing_production_tiers">;
export type AddonRow = Tables<"pricing_addons">;

export type PricingSettingsFull = PricingSettings & {
  public_visible: boolean;
  default_video_type: string | null;
  default_ai_model: string | null;
  default_tier: string | null;
  disclaimer: string;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettingsFull = {
  enabled: false, public_visible: false, currency: "BDT",
  default_video_type: null, default_ai_model: null, default_tier: null,
  min_duration: 5, max_duration: 180, duration_step: 5, rounding_increment: 100,
  tax: { enabled: false, label: "VAT", percentage: 0, inclusive: false },
  disclaimer: "",
};

export const PRICING_KEY = ["cms", "pricing"] as const;

export type AdminPricing = {
  videoTypes: VideoTypeRow[]; models: ModelRow[]; rates: RateRow[]; tiers: TierRow[];
  addons: AddonRow[]; scopes: { addon_id: string; video_type_id: string }[];
  settings: PricingSettingsFull; settingsSaved: boolean;
};

export async function loadAdminPricing(): Promise<AdminPricing> {
  const [videoTypes, models, rates, tiers, addons, scopes, raw] = await Promise.all([
    must(supabase.from("pricing_video_types").select("*").order("sort_order").order("name")),
    must(supabase.from("pricing_ai_models").select("*").order("sort_order").order("name")),
    must(supabase.from("pricing_model_rates").select("*")),
    must(supabase.from("pricing_production_tiers").select("*").order("sort_order")),
    must(supabase.from("pricing_addons").select("*").order("sort_order").order("name")),
    must(supabase.from("pricing_addon_video_types").select("addon_id,video_type_id")),
    getSettingsGroup<Partial<PricingSettingsFull>>("pricing"),
  ]);
  const s = raw ?? {};
  return {
    videoTypes, models, rates, tiers, addons, scopes, settingsSaved: !!raw,
    settings: { ...DEFAULT_PRICING_SETTINGS, ...s, tax: { ...DEFAULT_PRICING_SETTINGS.tax, ...(s.tax ?? {}) } },
  };
}

export const savePricingSettings = (s: PricingSettingsFull) => saveSettingsGroup("pricing", s);

/** Converts admin rows into the engine's config (numeric strings → numbers). */
export function toEngineConfig(d: AdminPricing): PricingConfig {
  return {
    settings: d.settings,
    videoTypes: d.videoTypes.map((v) => ({ ...v, base_creative_fee: Number(v.base_creative_fee), minimum_project_price: Number(v.minimum_project_price) })),
    models: d.models,
    tiers: d.tiers.map((t) => ({ ...t, multiplier: Number(t.multiplier) })),
    rates: d.rates.map((r) => ({ ...r, selling_rate_per_second: Number(r.selling_rate_per_second) })),
    addons: d.addons.map((a) => ({
      ...a, charge_type: a.charge_type as PricingConfig["addons"][number]["charge_type"],
      amount: a.amount == null ? null : Number(a.amount), percentage: a.percentage == null ? null : Number(a.percentage),
      video_type_ids: d.scopes.filter((s) => s.addon_id === a.id).map((s) => s.video_type_id),
    })),
  };
}

export const bdt = (major: number | string | null | undefined) =>
  major == null || major === "" ? "—" : `৳${Number(major).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const bdtMinor = (minor: number) => bdt(minor / 100);

export const CHARGE_TYPE_LABEL: Record<string, string> = { fixed: "Fixed", per_second: "Per second", per_scene: "Per scene", percentage: "Percentage" };

export function validateSettings(s: PricingSettingsFull, d: Pick<AdminPricing, "videoTypes" | "models" | "tiers">): string[] {
  const e: string[] = [];
  const int = (n: number) => Number.isInteger(n);
  if (!/^[A-Z]{3}$/.test(s.currency)) e.push("Currency must be a 3-letter code (e.g. BDT).");
  if (!int(s.min_duration) || s.min_duration <= 0) e.push("Minimum duration must be a whole number above 0.");
  if (!int(s.max_duration) || s.max_duration <= s.min_duration) e.push("Maximum duration must be greater than the minimum.");
  if (!int(s.duration_step) || s.duration_step <= 0) e.push("Duration increment must be a positive whole number.");
  if (!(s.rounding_increment > 0)) e.push("Rounding increment must be positive.");
  if (s.tax.enabled && !(s.tax.percentage > 0 && s.tax.percentage <= 100)) e.push("Tax percentage must be between 0 and 100.");
  if (s.default_video_type && !d.videoTypes.some((v) => v.slug === s.default_video_type)) e.push("Default video type no longer exists.");
  if (s.default_ai_model && !d.models.some((m) => m.slug === s.default_ai_model && m.available)) e.push("Default AI model is missing or unavailable.");
  if (s.default_tier && !d.tiers.some((t) => t.slug === s.default_tier)) e.push("Default tier no longer exists.");
  return e;
}

/** Pre-publish checks. Errors block going public; warnings are advisory. */
export function publishReadiness(d: AdminPricing) {
  const errors: string[] = [], warnings: string[] = [];
  const pubTypes = d.videoTypes.filter((v) => v.published);
  const pubModels = d.models.filter((m) => m.published && m.available);
  const pubTiers = d.tiers.filter((t) => t.published);
  if (!pubModels.length) errors.push("Publish at least one available AI model.");
  if (!pubTypes.length) errors.push("Publish at least one video type.");
  if (!pubTiers.length) errors.push("Publish at least one production tier.");
  for (const v of d.videoTypes) if (Number(v.base_creative_fee) < 0 || Number(v.minimum_project_price) < 0) errors.push(`${v.name}: fees can't be negative.`);
  for (const t of d.tiers) if (!(Number(t.multiplier) > 0 && Number(t.multiplier) <= 10)) errors.push(`${t.name}: multiplier must be between 0 and 10.`);
  for (const v of pubTypes) {
    const live = d.rates.filter((r) => r.video_type_id === v.id && r.enabled && pubModels.some((m) => m.id === r.ai_model_id));
    if (!live.length) errors.push(`${v.name} is published but has no enabled rate for a published model.`);
    for (const r of live) if (r.currency !== d.settings.currency) errors.push(`${v.name}: a rate uses ${r.currency}, settings use ${d.settings.currency}.`);
    if (Number(v.minimum_project_price) === 0) warnings.push(`${v.name} has no minimum project price.`);
  }
  for (const a of d.addons.filter((x) => x.published && x.enabled)) {
    if (a.charge_type === "percentage" ? a.percentage == null : a.amount == null) errors.push(`Add-on "${a.name}" is missing its amount.`);
    const sc = d.scopes.filter((s) => s.addon_id === a.id);
    if (sc.length && !sc.some((s) => pubTypes.some((v) => v.id === s.video_type_id))) warnings.push(`Add-on "${a.name}" only applies to unpublished video types.`);
  }
  errors.push(...validateSettings(d.settings, d));
  return { errors, warnings };
}
