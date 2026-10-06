import { describe, expect, it } from "vitest";
import { processQuoteRequest } from "./quote-request";
import { computeQuoteTotals, hashToken, linesFromEstimate, newAccessToken } from "./quote-builder";
import type { PricingConfig } from "./engine";

const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const config = (enabled = true): PricingConfig => ({
  settings: { enabled, currency: "BDT", min_duration: 5, max_duration: 60, duration_step: 5, rounding_increment: 0, tax: { enabled: false, label: "VAT", percentage: 0, inclusive: false } },
  videoTypes: [{ id: U(1), name: "AI Motion", slug: "ai-motion", base_creative_fee: 3500, minimum_project_price: 0, published: true }],
  models: [{ id: U(2), name: "Seedance", slug: "seedance", available: true, published: true }, { id: U(3), name: "Kling", slug: "kling", available: true, published: true }],
  tiers: [{ id: U(4), name: "Essential", slug: "essential", multiplier: 1, published: true }],
  rates: [
    { id: U(5), video_type_id: U(1), ai_model_id: U(2), selling_rate_per_second: 180, currency: "BDT", enabled: true },
    { id: U(6), video_type_id: U(1), ai_model_id: U(3), selling_rate_per_second: 230, currency: "BDT", enabled: false },
  ],
  addons: [{ id: U(7), name: "Lip Sync", charge_type: "per_scene", amount: 2000, percentage: null, enabled: true, published: true, video_type_ids: [] }],
});
const now = 1_900_000_000_000;
const base = { name: "Rahim Uddin", whatsapp: "+8801712345678", email: "rahim@example.com", started_at: now - 10_000,
  selection: { videoTypeId: U(1), modelId: U(2), tierId: U(4), durationSeconds: 30, addons: [] as { id: string; scenes?: number }[] } };
const run = (over: Record<string, unknown> = {}, c: PricingConfig | null = config()) => processQuoteRequest({ ...base, ...over }, c, now);

describe("quote request processing", () => {
  it("accepts a valid submission and recalculates on the server", () => {
    const r = run({ clientTotal: 1 });
    expect(r.ok && r.status).toBe("new");
    if (r.ok) expect(r.estimate?.total).toBe((3500 + 30 * 180) * 100); // browser total ignored
  });
  it("requires name, WhatsApp and email", () => {
    const r = run({ name: "", whatsapp: "", email: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields ?? {})).toEqual(expect.arrayContaining(["name", "whatsapp", "email"]));
  });
  it("validates WhatsApp and email formats", () => {
    for (const w of ["123", "abc12345678", "+88 01"]) { const r = run({ whatsapp: w }); expect(!r.ok && r.fields?.["whatsapp"]).toBeTruthy(); }
    const r = run({ email: "not-an-email" }); expect(!r.ok && r.fields?.["email"]).toBeTruthy();
  });
  it("rejects invalid service selection, disabled model, invalid duration, invalid add-on and missing scenes", () => {
    expect(run({ selection: { ...base.selection, videoTypeId: U(9) } }).ok).toBe(false);
    expect(run({ selection: { ...base.selection, modelId: U(3) } }).ok).toBe(false);
    expect(run({ selection: { ...base.selection, durationSeconds: 7 } }).ok).toBe(false);
    expect(run({ selection: { ...base.selection, addons: [{ id: U(8) }] } }).ok).toBe(false);
    expect(run({ selection: { ...base.selection, addons: [{ id: U(7) }] } }).ok).toBe(false);
    const ok = run({ selection: { ...base.selection, addons: [{ id: U(7), scenes: 2 }] } });
    expect(ok.ok && ok.estimate?.total).toBe((3500 + 5400 + 4000) * 100);
  });
  it("drafts/disabled pricing → custom request with no estimate and no stored selection", () => {
    for (const c of [config(false), null]) {
      const r = run({}, c);
      expect(r.ok && r.status).toBe("custom_quote_requested");
      if (r.ok) { expect(r.estimate).toBeNull(); expect(r.selection).toBeNull(); }
    }
  });
  it("blocks bots (honeypot / too fast)", () => {
    expect(run({ hp_field: "x" }).ok).toBe(false);
    expect(run({ started_at: now - 100 }).ok).toBe(false);
  });
  it("snapshot is independent of later live price changes", () => {
    const c = config(); const r = run({}, c);
    const frozen = JSON.parse(JSON.stringify(r.ok ? r.estimate : null));
    c.rates[0]!.selling_rate_per_second = 999;
    expect(frozen.total).toBe(890000);
    expect(linesFromEstimate(frozen).reduce((t, l) => t + l.unit_minor * l.quantity, 0)).toBe(890000);
  });
});

describe("final quote arithmetic", () => {
  const lines = [{ label: "Base", quantity: 1, unit_minor: 350000 }, { label: "Production", quantity: 2, unit_minor: 270000 }];
  it("adjusts line items", () => expect(computeQuoteTotals({ line_items: lines, discount_type: "none", discount_value: 0, tax_percentage: 0, tax_inclusive: false }).total_minor).toBe(890000));
  it("fixed and percentage discounts applied once", () => {
    expect(computeQuoteTotals({ line_items: lines, discount_type: "fixed", discount_value: 900, tax_percentage: 0, tax_inclusive: false }).total_minor).toBe(800000);
    const p = computeQuoteTotals({ line_items: lines, discount_type: "percentage", discount_value: 10, tax_percentage: 0, tax_inclusive: false });
    expect(p.discount_minor).toBe(89000); expect(p.total_minor).toBe(801000);
  });
  it("exclusive vs inclusive tax", () => {
    expect(computeQuoteTotals({ line_items: lines, discount_type: "none", discount_value: 0, tax_percentage: 15, tax_inclusive: false }).total_minor).toBe(1023500);
    const inc = computeQuoteTotals({ line_items: lines, discount_type: "none", discount_value: 0, tax_percentage: 15, tax_inclusive: true });
    expect(inc.total_minor).toBe(890000); expect(inc.tax_minor).toBe(890000 - Math.round(890000 / 1.15));
  });
  it("prevents negative totals", () => {
    expect(() => computeQuoteTotals({ line_items: lines, discount_type: "fixed", discount_value: 99999, tax_percentage: 0, tax_inclusive: false })).toThrow();
    expect(() => computeQuoteTotals({ line_items: [{ label: "Credit", quantity: 1, unit_minor: -100 }], discount_type: "none", discount_value: 0, tax_percentage: 0, tax_inclusive: false })).toThrow();
  });
  it("access tokens are random and only hashes are stored", async () => {
    const a = newAccessToken(), b = newAccessToken();
    expect(a).not.toBe(b); expect(a.length).toBeGreaterThanOrEqual(40);
    expect(await hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
