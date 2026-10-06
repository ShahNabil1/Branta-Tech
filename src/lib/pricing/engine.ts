/**
 * Deterministic AI video pricing engine (pure, browser- and server-safe).
 * All money is handled in integer minor units (1 BDT = 100 poisha) to avoid float drift.
 *
 * Order of calculation:
 *  1. variable = duration × rate/sec × tier multiplier
 *  2. fixed / per_second / per_scene add-ons
 *  3. percentage add-ons, charged on the "chargeable base" =
 *     base fee + variable + non-percentage add-ons (percentages never compound on each other)
 *  4. subtotal raised to the video type's minimum project price (adjustment line)
 *  5. rounded UP to the configured rounding increment
 *  6. tax: exclusive → added on top; inclusive → reported as contained in the total
 */

export type ChargeType = "fixed" | "per_second" | "per_scene" | "percentage";

export type PricingVideoType = { id: string; name: string; slug: string; base_creative_fee: number; minimum_project_price: number; published: boolean };
export type PricingModel = { id: string; name: string; slug: string; available: boolean; published: boolean };
export type PricingTier = { id: string; name: string; slug: string; multiplier: number; published: boolean };
export type PricingRate = { id: string; video_type_id: string; ai_model_id: string; selling_rate_per_second: number; currency: string; enabled: boolean };
export type PricingAddon = {
  id: string; name: string; charge_type: ChargeType; amount: number | null; percentage: number | null;
  enabled: boolean; published: boolean; video_type_ids: string[]; // empty = all types
};
export type PricingSettings = {
  enabled: boolean; currency: string; min_duration: number; max_duration: number; duration_step: number;
  rounding_increment: number; tax: { enabled: boolean; label: string; percentage: number; inclusive: boolean };
};
export type PricingConfig = {
  settings: PricingSettings; videoTypes: PricingVideoType[]; models: PricingModel[];
  tiers: PricingTier[]; rates: PricingRate[]; addons: PricingAddon[];
};
export type QuoteInput = {
  videoTypeId: string; modelId: string; tierId: string; durationSeconds: number;
  addons?: { id: string; scenes?: number }[];
};
/** "public" requires published records; "admin" allows drafts for internal previews. */
export type QuoteMode = "public" | "admin";

export type QuoteLine = { addonId: string; name: string; chargeType: ChargeType; quantity: number; unitAmount: number; amount: number };
export type Quote = {
  currency: string; durationSeconds: number;
  videoType: { id: string; name: string }; model: { id: string; name: string }; tier: { id: string; name: string; multiplier: number };
  rateId: string; baseFee: number; ratePerSecond: number; variableSubtotal: number;
  addonLines: QuoteLine[]; chargeableBase: number; subtotal: number; minimumAdjustment: number;
  roundingAdjustment: number; preTaxTotal: number;
  tax: { label: string; percentage: number; inclusive: boolean; amount: number } | null;
  total: number;
};

export class PricingError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const toMinor = (major: number) => Math.round(major * 100);
export const fromMinor = (minor: number) => minor / 100;
/** multiplier/percent as integer basis (×1000) to keep multiplication exact. */
const mulMinor = (minor: number, factor: number) => Math.round((minor * Math.round(factor * 1000)) / 1000);

function fail(code: string, msg: string): never { throw new PricingError(code, msg); }

export function calculateQuote(config: PricingConfig | null | undefined, input: QuoteInput, mode: QuoteMode = "public"): Quote {
  if (!config?.settings) fail("missing_config", "Pricing is not configured.");
  const s = config.settings;
  const pub = mode === "public";
  if (pub && !s.enabled) fail("disabled", "Pricing is currently unavailable.");

  const d = input.durationSeconds;
  if (!Number.isFinite(d) || !Number.isInteger(d) || d <= 0) fail("invalid_duration", "Duration must be a whole number of seconds above zero.");
  if (d < s.min_duration || d > s.max_duration) fail("invalid_duration", `Duration must be between ${s.min_duration} and ${s.max_duration} seconds.`);
  if (s.duration_step > 0 && (d - s.min_duration) % s.duration_step !== 0) fail("invalid_duration", `Duration must be in ${s.duration_step}-second steps.`);

  const vt = config.videoTypes.find((v) => v.id === input.videoTypeId) ?? fail("unknown_video_type", "Unknown video type.");
  const model = config.models.find((m) => m.id === input.modelId) ?? fail("unknown_model", "Unknown AI model.");
  const tier = config.tiers.find((t) => t.id === input.tierId) ?? fail("unknown_tier", "Unknown production tier.");
  if (pub && (!vt.published || !model.published || !model.available || !tier.published)) fail("unpublished", "That option isn't available.");
  if (!(tier.multiplier > 0 && tier.multiplier <= 10)) fail("invalid_multiplier", "Tier multiplier is out of range.");

  const rate = config.rates.find((r) => r.video_type_id === vt.id && r.ai_model_id === model.id) ?? fail("missing_rate", "No rate for that combination.");
  if (!rate.enabled) fail("disabled_rate", "That model isn't available for this video type.");
  if (rate.currency !== s.currency) fail("currency_mismatch", "Rate currency does not match pricing currency.");
  for (const n of [vt.base_creative_fee, vt.minimum_project_price, rate.selling_rate_per_second]) if (!(n >= 0)) fail("negative_price", "Prices cannot be negative.");

  const baseFee = toMinor(vt.base_creative_fee);
  const ratePerSecond = toMinor(rate.selling_rate_per_second);
  const variableSubtotal = mulMinor(d * ratePerSecond, tier.multiplier);

  const seen = new Set<string>();
  const chosen = (input.addons ?? []).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))); // no duplicate charges
  const resolved = chosen.map((sel) => {
    const a = config.addons.find((x) => x.id === sel.id) ?? fail("unknown_addon", "Unknown add-on.");
    if (!a.enabled || (pub && !a.published)) fail("unpublished", `Add-on "${a.name}" isn't available.`);
    if (a.video_type_ids.length && !a.video_type_ids.includes(vt.id)) fail("addon_not_applicable", `Add-on "${a.name}" doesn't apply to ${vt.name}.`);
    return { a, sel };
  });

  const addonLines: QuoteLine[] = [];
  for (const { a, sel } of resolved) {
    if (a.charge_type === "percentage") continue;
    const unit = toMinor(a.amount ?? fail("invalid_addon", "Add-on amount missing."));
    if (unit < 0) fail("negative_price", "Prices cannot be negative.");
    let qty = 1;
    if (a.charge_type === "per_second") qty = d;
    if (a.charge_type === "per_scene") {
      qty = sel.scenes ?? 0;
      if (!Number.isInteger(qty) || qty <= 0 || qty > 500) fail("invalid_scenes", "Scene count must be a positive whole number.");
    }
    addonLines.push({ addonId: a.id, name: a.name, chargeType: a.charge_type, quantity: qty, unitAmount: unit, amount: unit * qty });
  }
  const chargeableBase = baseFee + variableSubtotal + addonLines.reduce((t, l) => t + l.amount, 0);
  for (const { a } of resolved) {
    if (a.charge_type !== "percentage") continue;
    const pct = a.percentage ?? fail("invalid_addon", "Add-on percentage missing.");
    if (!(pct >= 0 && pct <= 100)) fail("invalid_addon", "Add-on percentage out of range.");
    const amt = mulMinor(chargeableBase, pct / 100);
    addonLines.push({ addonId: a.id, name: a.name, chargeType: "percentage", quantity: pct, unitAmount: chargeableBase, amount: amt });
  }

  const subtotal = baseFee + variableSubtotal + addonLines.reduce((t, l) => t + l.amount, 0);
  const minimum = toMinor(vt.minimum_project_price);
  const minimumAdjustment = Math.max(0, minimum - subtotal);
  const afterMin = subtotal + minimumAdjustment;
  const inc = toMinor(s.rounding_increment > 0 ? s.rounding_increment : 0);
  const preTaxTotal = inc > 0 ? Math.ceil(afterMin / inc) * inc : afterMin;
  const roundingAdjustment = preTaxTotal - afterMin;

  let tax: Quote["tax"] = null;
  let total = preTaxTotal;
  if (s.tax?.enabled && s.tax.percentage > 0) {
    const p = s.tax.percentage;
    const amount = s.tax.inclusive ? preTaxTotal - Math.round((preTaxTotal * 100000) / (100000 + Math.round(p * 1000))) : mulMinor(preTaxTotal, p / 100);
    if (!s.tax.inclusive) total += amount;
    tax = { label: s.tax.label, percentage: p, inclusive: s.tax.inclusive, amount };
  }

  return {
    currency: s.currency, durationSeconds: d,
    videoType: { id: vt.id, name: vt.name }, model: { id: model.id, name: model.name },
    tier: { id: tier.id, name: tier.name, multiplier: tier.multiplier },
    rateId: rate.id, baseFee, ratePerSecond, variableSubtotal, addonLines, chargeableBase,
    subtotal, minimumAdjustment, roundingAdjustment, preTaxTotal, tax, total,
  };
}
