import { describe, expect, it } from "vitest";
import { calculateQuote, PricingError, type PricingConfig, type QuoteInput } from "./engine";

const RATES: Record<string, [number, number, number, number]> = {
  motion: [180, 230, 280, 3500], commercial: [350, 450, 600, 7000], ovc: [500, 650, 800, 12000], tvc: [800, 1000, 1300, 20000],
};
const MODELS = ["seedance", "kling", "omni"];

function cfg(published = true): PricingConfig {
  return {
    settings: { enabled: true, currency: "BDT", min_duration: 5, max_duration: 180, duration_step: 5, rounding_increment: 0,
      tax: { enabled: false, label: "VAT", percentage: 0, inclusive: false } },
    videoTypes: Object.entries(RATES).map(([k, r]) => ({ id: k, name: k, slug: k, base_creative_fee: r[3], minimum_project_price: 0, published })),
    models: MODELS.map((m) => ({ id: m, name: m, slug: m, available: true, published })),
    tiers: [["essential", 1], ["professional", 1.25], ["premium", 1.5]].map(([id, m]) => ({ id: id as string, name: id as string, slug: id as string, multiplier: m as number, published })),
    rates: Object.entries(RATES).flatMap(([k, r]) => MODELS.map((m, i) => ({ id: `${k}-${m}`, video_type_id: k, ai_model_id: m, selling_rate_per_second: r[i]!, currency: "BDT", enabled: true }))),
    addons: [
      { id: "fixed", name: "Voiceover", charge_type: "fixed", amount: 2000, percentage: null, enabled: true, published, video_type_ids: [] },
      { id: "persec", name: "Subtitles", charge_type: "per_second", amount: 10, percentage: null, enabled: true, published, video_type_ids: [] },
      { id: "scene", name: "Extra scene", charge_type: "per_scene", amount: 1500, percentage: null, enabled: true, published, video_type_ids: [] },
      { id: "rush", name: "Rush", charge_type: "percentage", amount: null, percentage: 20, enabled: true, published, video_type_ids: [] },
    ],
  };
}
const q = (over: Partial<QuoteInput> = {}, c = cfg()) => calculateQuote(c, { videoTypeId: "motion", modelId: "seedance", tierId: "essential", durationSeconds: 30, ...over });
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as PricingError).code; } return null; };

describe("pricing engine", () => {
  it("AI Motion", () => expect(q().total).toBe((3500 + 30 * 180) * 100));
  it("AI Commercial", () => expect(q({ videoTypeId: "commercial", modelId: "kling" }).total).toBe((7000 + 30 * 450) * 100));
  it("OVC", () => expect(q({ videoTypeId: "ovc", modelId: "omni", durationSeconds: 60 }).total).toBe((12000 + 60 * 800) * 100));
  it("TVC", () => expect(q({ videoTypeId: "tvc", durationSeconds: 45 }).total).toBe((20000 + 45 * 800) * 100));
  it("model switching changes rate", () => {
    expect(q({ modelId: "kling" }).ratePerSecond).toBe(23000);
    expect(q({ modelId: "omni" }).total).toBe((3500 + 30 * 280) * 100);
  });
  it("tier multiplier applies to variable only", () => {
    const r = q({ tierId: "professional" });
    expect(r.variableSubtotal).toBe(30 * 180 * 125);
    expect(r.total).toBe(350000 + 675000);
  });
  it("fixed add-on", () => expect(q({ addons: [{ id: "fixed" }, { id: "fixed" }] }).total).toBe((3500 + 5400 + 2000) * 100));
  it("per-second add-on", () => expect(q({ addons: [{ id: "persec" }] }).addonLines[0]!.amount).toBe(30 * 1000));
  it("per-scene add-on", () => {
    expect(q({ addons: [{ id: "scene", scenes: 3 }] }).addonLines[0]!.amount).toBe(450000);
    expect(code(() => q({ addons: [{ id: "scene" }] }))).toBe("invalid_scenes");
  });
  it("percentage add-on uses chargeable base", () => {
    const r = q({ addons: [{ id: "rush" }, { id: "fixed" }] });
    expect(r.chargeableBase).toBe((3500 + 5400 + 2000) * 100);
    expect(r.addonLines.find((l) => l.addonId === "rush")!.amount).toBe(218000);
  });
  it("minimum project charge", () => {
    const c = cfg(); c.videoTypes[0]!.minimum_project_price = 15000;
    const r = q({}, c);
    expect(r.minimumAdjustment).toBe(610000);
    expect(r.total).toBe(1500000);
  });
  it("rounding up to increment", () => {
    const c = cfg(); c.settings.rounding_increment = 1000;
    const r = q({ durationSeconds: 25 }, c); // 3500 + 4500 = 8000 → stays
    expect(r.total).toBe(800000);
    expect(q({ durationSeconds: 35 }, c).total).toBe(1000000); // 9800 → 10000
  });
  it("exclusive tax", () => {
    const c = cfg(); c.settings.tax = { enabled: true, label: "VAT", percentage: 15, inclusive: false };
    expect(q({}, c).total).toBe(Math.round(890000 * 1.15));
  });
  it("disabled rate is rejected", () => {
    const c = cfg(); c.rates[0]!.enabled = false;
    expect(code(() => q({}, c))).toBe("disabled_rate");
  });
  it("missing configuration", () => {
    expect(code(() => calculateQuote(null, { videoTypeId: "motion", modelId: "seedance", tierId: "essential", durationSeconds: 30 }))).toBe("missing_config");
    const c = cfg(); c.rates = [];
    expect(code(() => q({}, c))).toBe("missing_rate");
  });
  it("invalid duration", () => {
    for (const d of [0, -5, 7, 2.5, 500]) expect(code(() => q({ durationSeconds: d }))).toBe("invalid_duration");
  });
  it("draft data hidden publicly, allowed in admin preview", () => {
    expect(code(() => q({}, cfg(false)))).toBe("unpublished");
    expect(calculateQuote(cfg(false), { videoTypeId: "motion", modelId: "seedance", tierId: "essential", durationSeconds: 30 }, "admin").total).toBe(890000);
  });
  it("recalculation is deterministic and ignores any client total", () => {
    const input = { videoTypeId: "commercial", modelId: "omni", tierId: "premium", durationSeconds: 60, addons: [{ id: "rush" }], total: 1 } as QuoteInput;
    const a = calculateQuote(cfg(), input), b = calculateQuote(cfg(), JSON.parse(JSON.stringify(input)));
    expect(a).toEqual(b);
    expect(a.total).not.toBe(1);
  });
});
