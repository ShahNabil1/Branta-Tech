import { describe, expect, it } from "vitest";
import { calculatePhotoQuote, DEFAULT_PHOTO_SETTINGS, type PhotoConfig } from "./photo-engine";
import { calculateQuote, type PricingConfig } from "./engine";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const views = ["Flat-lay Front", "Flat-lay Back", "Front", "Back", "Side", "Close-up", "Model Front", "Model Back", "Model Side", "Model Close-up"]
  .map((name, i) => ({ id: U(100 + i), name, slug: `v${i}`, applies_to: "all" as const, published: true }));
const cfg = (over: Partial<PhotoConfig["settings"]> = {}): PhotoConfig => ({
  settings: { ...DEFAULT_PHOTO_SETTINGS, enabled: true, rounding_increment: 0, ...over },
  categories: [{ id: U(1), name: "E-commerce", slug: "e", price_per_image: 250, bulk_eligible: true, published: true },
    { id: U(2), name: "Basic", slug: "b", price_per_image: 200, bulk_eligible: false, published: true }],
  views,
  packages: [
    { id: U(11), name: "Basic Flat-lay", slug: "a", price_per_product: 500, image_count: 2, bulk_eligible: true, published: true, view_ids: [U(100), U(101)] },
    { id: U(12), name: "Website Set", slug: "b", price_per_product: 900, image_count: 4, bulk_eligible: true, published: true, view_ids: [U(102), U(103), U(104), U(105)] },
    { id: U(13), name: "Fashion Complete", slug: "c", price_per_product: 2200, image_count: 6, bulk_eligible: true, published: true, view_ids: [U(100), U(101), U(106), U(107), U(108), U(109)] },
    { id: U(14), name: "Premium Fashion", slug: "d", price_per_product: 3500, image_count: 6, bulk_eligible: true, published: true, view_ids: [U(100), U(101), U(106), U(107), U(108), U(109)] },
    { id: U(15), name: "Draft", slug: "x", price_per_product: 1, image_count: 1, bulk_eligible: true, published: false, view_ids: [] },
  ],
  addons: [
    { id: U(21), name: "Retouch", charge_type: "per_image", amount: 50, percentage: null, enabled: true, published: true },
    { id: U(22), name: "Rush", charge_type: "percentage", amount: null, percentage: 20, enabled: true, published: true },
    { id: U(23), name: "Unpriced", charge_type: "fixed", amount: null, percentage: null, enabled: true, published: true },
  ],
  bulkTiers: [
    { id: U(31), min_products: 1, max_products: 4, discount_percentage: 0, custom_quote: false, published: true },
    { id: U(32), min_products: 5, max_products: 9, discount_percentage: 5, custom_quote: false, published: true },
    { id: U(33), min_products: 10, max_products: 24, discount_percentage: 10, custom_quote: false, published: true },
    { id: U(34), min_products: 25, max_products: 49, discount_percentage: 15, custom_quote: false, published: true },
    { id: U(35), min_products: 50, max_products: null, discount_percentage: null, custom_quote: true, published: true },
  ],
});
const pkg = (id: number, products = 1, c = cfg()) => calculatePhotoQuote(c, { mode: "package", packageId: U(id), workflow: "magnific-c3", products });

describe("photography pricing", () => {
  it("single image pricing", () => {
    const q = calculatePhotoQuote(cfg(), { mode: "individual", categoryId: U(1), workflow: "gpt-5-image", products: 1, imagesPerProduct: 1 });
    expect(q.total).toBe(25000);
  });
  it("packages price per product and include their views", () => {
    expect(pkg(11).total).toBe(50000); expect(pkg(11).totalImages).toBe(2);
    expect(pkg(12).total).toBe(90000); expect(pkg(12).views.map((v) => v.name)).toEqual(["Front", "Back", "Side", "Close-up"]);
    expect(pkg(13).total).toBe(220000); expect(pkg(14).total).toBe(350000); expect(pkg(14).totalImages).toBe(6);
  });
  it("C3 and GPT-5 Image cost exactly the same", () => {
    const a = calculatePhotoQuote(cfg(), { mode: "individual", categoryId: U(1), workflow: "magnific-c3", products: 3, imagesPerProduct: 4 });
    const b = calculatePhotoQuote(cfg(), { mode: "individual", categoryId: U(1), workflow: "gpt-5-image", products: 3, imagesPerProduct: 4 });
    expect(a.total).toBe(b.total); expect(a.total).toBe(300000);
  });
  it("custom image counts × quantities", () => {
    expect(calculatePhotoQuote(cfg(), { mode: "individual", categoryId: U(1), workflow: "magnific-c3", products: 2, imagesPerProduct: 7 }).totalImages).toBe(14);
  });
  it("bulk discount boundaries, single tier only", () => {
    expect(pkg(11, 4).bulk).toBeNull();
    expect(pkg(11, 5).bulk?.percentage).toBe(5); expect(pkg(11, 5).total).toBe(237500);
    expect(pkg(11, 9).bulk?.percentage).toBe(5); expect(pkg(11, 10).bulk?.percentage).toBe(10);
    expect(pkg(11, 25).bulk?.percentage).toBe(15); expect(pkg(11, 49).total).toBe(Math.round(2450000 * 0.85));
    expect(() => pkg(11, 50)).toThrow(/custom quote/);
  });
  it("no bulk discount on ineligible categories", () => {
    expect(calculatePhotoQuote(cfg(), { mode: "individual", categoryId: U(2), workflow: "magnific-c3", products: 10, imagesPerProduct: 1 }).bulk).toBeNull();
  });
  it("minimum order only when enabled and only for individual orders", () => {
    const i = { mode: "individual" as const, categoryId: U(2), workflow: "magnific-c3", products: 1, imagesPerProduct: 1 };
    expect(calculatePhotoQuote(cfg(), i).total).toBe(20000);
    expect(calculatePhotoQuote(cfg({ minimum_order_enabled: true }), i).total).toBe(100000);
    expect(pkg(11, 1, cfg({ minimum_order_enabled: true })).total).toBe(50000);
  });
  it("add-ons: per image then percentage, never double-charging package images", () => {
    const q = calculatePhotoQuote(cfg(), { mode: "package", packageId: U(11), workflow: "magnific-c3", products: 2, addons: [{ id: U(21) }, { id: U(22) }, { id: U(21) }] });
    // base 1000 + retouch 4 images × 50 = 1200, rush 20% = 240
    expect(q.baseAmount).toBe(100000); expect(q.total).toBe(144000); expect(q.addonLines).toHaveLength(2);
  });
  it("rejects unpriced extras, unpublished packages, bad workflows and too many views", () => {
    expect(() => calculatePhotoQuote(cfg(), { mode: "package", packageId: U(11), workflow: "magnific-c3", products: 1, addons: [{ id: U(23) }] })).toThrow();
    expect(() => pkg(15)).toThrow();
    expect(() => calculatePhotoQuote(cfg(), { mode: "package", packageId: U(11), workflow: "midjourney", products: 1 })).toThrow();
    expect(() => calculatePhotoQuote(cfg(), { mode: "individual", categoryId: U(1), workflow: "magnific-c3", products: 1, imagesPerProduct: 1, viewIds: [U(100), U(101)] })).toThrow();
    expect(() => pkg(11, 1, cfg({ enabled: false }))).toThrow();
  });
  it("rounding and tax", () => {
    const q = pkg(11, 1, cfg({ rounding_increment: 300, tax: { enabled: true, label: "VAT", percentage: 15, inclusive: false } }));
    expect(q.preTaxTotal).toBe(60000); expect(q.tax?.amount).toBe(9000); expect(q.total).toBe(69000);
  });
});

describe("video model hierarchy with the proposed rates", () => {
  const ids = { t: U(201), b: U(301), k: U(302), s: U(303), tier: U(401), pro: U(402) };
  const c: PricingConfig = {
    settings: { enabled: true, currency: "BDT", min_duration: 5, max_duration: 180, duration_step: 5, rounding_increment: 0, tax: { enabled: false, label: "VAT", percentage: 0, inclusive: false } },
    videoTypes: [{ id: ids.t, name: "AI Motion", slug: "ai-motion", base_creative_fee: 3500, minimum_project_price: 8000, published: true }],
    models: [ids.b, ids.k, ids.s].map((id, i) => ({ id, name: ["Budget", "Kling", "Seedance"][i]!, slug: `m${i}`, available: true, published: true })),
    tiers: [{ id: ids.tier, name: "Essential", slug: "e", multiplier: 1, published: true }, { id: ids.pro, name: "Pro", slug: "p", multiplier: 1.25, published: true }],
    rates: [[ids.b, 150], [ids.k, 230], [ids.s, 350]].map(([m, r], i) => ({ id: U(500 + i), video_type_id: ids.t, ai_model_id: m as string, selling_rate_per_second: r as number, currency: "BDT", enabled: true })),
    addons: [],
  };
  const total = (m: string, d: number, tier = ids.tier) => calculateQuote(c, { videoTypeId: ids.t, modelId: m, tierId: tier, durationSeconds: d }).total;
  it("budget < kling < seedance", () => { expect(total(ids.b, 60)).toBeLessThan(total(ids.k, 60)); expect(total(ids.k, 60)).toBeLessThan(total(ids.s, 60)); });
  it("per-second maths, tier and minimum", () => {
    expect(total(ids.k, 30)).toBe((3500 + 30 * 230) * 100);
    expect(total(ids.k, 30, ids.pro)).toBe((3500 + 30 * 230 * 1.25) * 100);
    expect(total(ids.b, 10)).toBe(800000); // raised to the 8,000 minimum
  });
});
