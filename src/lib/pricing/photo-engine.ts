/**
 * Deterministic AI product photography pricing (pure, browser- and server-safe). Integer minor units.
 *
 * Order:
 *  1. base = per-image rate × images per product × products   (individual)
 *           package price × products                           (package — included images are never charged again)
 *  2. one bulk tier (by product count) discounts the base when the category/package is bulk-eligible;
 *     a "custom quote" tier blocks instant pricing
 *  3. fixed / per_product / per_image add-ons; then percentage add-ons on (base − discount + those add-ons)
 *  4. optional minimum order (individual image orders only, only when enabled)
 *  5. round up to the rounding increment, then tax (exclusive → added; inclusive → reported)
 * The image workflow (e.g. Magnific C3 / GPT-5 Image) is a production preference and never changes the price.
 */
import { PricingError } from "./engine";

export type PhotoAddonCharge = "fixed" | "per_product" | "per_image" | "percentage";
export type PhotoCategory = { id: string; name: string; slug: string; price_per_image: number | null; bulk_eligible: boolean; published: boolean };
export type PhotoView = { id: string; name: string; slug: string; applies_to: "all" | "fashion" | "product"; published: boolean };
export type PhotoPackage = { id: string; name: string; slug: string; price_per_product: number | null; image_count: number; bulk_eligible: boolean; published: boolean; view_ids: string[] };
export type PhotoAddon = { id: string; name: string; charge_type: PhotoAddonCharge; amount: number | null; percentage: number | null; enabled: boolean; published: boolean };
export type PhotoBulkTier = { id: string; min_products: number; max_products: number | null; discount_percentage: number | null; custom_quote: boolean; published: boolean };
export type PhotoWorkflow = { slug: string; name: string };
export type PhotoSettings = {
  enabled: boolean; currency: string; rounding_increment: number;
  minimum_order: number; minimum_order_enabled: boolean;
  max_products: number; max_images_per_product: number;
  workflows: PhotoWorkflow[]; backgrounds: string[];
  tax: { enabled: boolean; label: string; percentage: number; inclusive: boolean };
};
export type PhotoConfig = { settings: PhotoSettings; categories: PhotoCategory[]; views: PhotoView[]; packages: PhotoPackage[]; addons: PhotoAddon[]; bulkTiers: PhotoBulkTier[] };

export type PhotoQuoteInput = {
  mode: "individual" | "package";
  categoryId?: string | undefined; packageId?: string | undefined;
  workflow: string; products: number; imagesPerProduct?: number | undefined;
  viewIds?: string[] | undefined; background?: string | undefined; modelRequired?: boolean | undefined;
  addons?: { id: string }[] | undefined;
};
export type PhotoQuoteLine = { addonId: string; name: string; chargeType: PhotoAddonCharge; quantity: number; unitAmount: number; amount: number };
export type PhotoQuote = {
  category: "photography"; currency: string; mode: "individual" | "package";
  workflow: PhotoWorkflow; item: { id: string; name: string }; products: number; imagesPerProduct: number; totalImages: number;
  views: { id: string; name: string }[]; background: string | null; modelRequired: boolean;
  unitPrice: number; baseAmount: number;
  bulk: { tierId: string; percentage: number; amount: number } | null;
  addonLines: PhotoQuoteLine[]; subtotal: number; minimumAdjustment: number; roundingAdjustment: number; preTaxTotal: number;
  tax: { label: string; percentage: number; inclusive: boolean; amount: number } | null; total: number;
};

const toMinor = (major: number) => Math.round(major * 100);
const mulMinor = (minor: number, factor: number) => Math.round((minor * Math.round(factor * 1000)) / 1000);
function fail(code: string, msg: string): never { throw new PricingError(code, msg); }

export function bulkTierFor(tiers: PhotoBulkTier[], products: number, pub = true) {
  return tiers.find((t) => (!pub || t.published) && products >= t.min_products && (t.max_products == null || products <= t.max_products)) ?? null;
}

export function calculatePhotoQuote(config: PhotoConfig | null | undefined, input: PhotoQuoteInput, mode: "public" | "admin" = "public"): PhotoQuote {
  if (!config?.settings) fail("missing_config", "Photography pricing is not configured.");
  const s = config.settings, pub = mode === "public";
  if (pub && !s.enabled) fail("disabled", "Photography pricing is currently unavailable.");
  const workflow = s.workflows.find((w) => w.slug === input.workflow) ?? fail("unknown_workflow", "Choose an image workflow.");
  const products = input.products;
  if (!Number.isInteger(products) || products < 1 || products > (s.max_products || 500)) fail("invalid_products", `Product quantity must be between 1 and ${s.max_products || 500}.`);

  const viewOk = (v: PhotoView | undefined): v is PhotoView => !!v && (!pub || v.published);
  let item: { id: string; name: string }, unit: number, imagesPerProduct: number, eligible: boolean, views: PhotoView[];
  if (input.mode === "package") {
    const p = config.packages.find((x) => x.id === input.packageId) ?? fail("unknown_package", "Unknown package.");
    if (pub && !p.published) fail("unpublished", "That package isn't available.");
    if (p.price_per_product == null || p.price_per_product < 0) fail("unpriced", "That package has no price yet.");
    item = { id: p.id, name: p.name }; unit = toMinor(p.price_per_product); imagesPerProduct = p.image_count; eligible = p.bulk_eligible;
    views = p.view_ids.map((id) => config.views.find((v) => v.id === id)).filter(viewOk);
  } else {
    const c = config.categories.find((x) => x.id === input.categoryId) ?? fail("unknown_category", "Unknown photography category.");
    if (pub && !c.published) fail("unpublished", "That category isn't available.");
    if (c.price_per_image == null || c.price_per_image < 0) fail("unpriced", "That category has no price yet.");
    const n = input.imagesPerProduct ?? 0;
    if (!Number.isInteger(n) || n < 1 || n > (s.max_images_per_product || 30)) fail("invalid_images", `Images per product must be between 1 and ${s.max_images_per_product || 30}.`);
    const ids = [...new Set(input.viewIds ?? [])];
    views = ids.map((id) => config.views.find((v) => v.id === id) ?? fail("unknown_view", "Unknown image view.")).filter(viewOk);
    if (views.length !== ids.length) fail("unpublished", "That image view isn't available.");
    if (views.length > n) fail("too_many_views", "You've chosen more views than images per product.");
    item = { id: c.id, name: c.name }; unit = toMinor(c.price_per_image); imagesPerProduct = n; eligible = c.bulk_eligible;
  }
  const totalImages = imagesPerProduct * products;
  const baseAmount = input.mode === "package" ? unit * products : unit * totalImages;

  const tier = bulkTierFor(config.bulkTiers, products, pub);
  if (tier?.custom_quote) fail("custom_quote_required", `For ${tier.min_products}+ products we prepare a custom quote.`);
  const pct = eligible && tier?.discount_percentage ? tier.discount_percentage : 0;
  const bulk = tier && pct > 0 ? { tierId: tier.id, percentage: pct, amount: mulMinor(baseAmount, pct / 100) } : null;
  const afterDiscount = baseAmount - (bulk?.amount ?? 0);

  const seen = new Set<string>();
  const chosen = (input.addons ?? []).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
    .map((sel) => {
      const a = config.addons.find((x) => x.id === sel.id) ?? fail("unknown_addon", "Unknown extra.");
      if (!a.enabled || (pub && !a.published)) fail("unpublished", `"${a.name}" isn't available.`);
      return a;
    });
  const addonLines: PhotoQuoteLine[] = [];
  for (const a of chosen) {
    if (a.charge_type === "percentage") continue;
    const u = toMinor(a.amount ?? fail("unpriced", `"${a.name}" has no price yet.`));
    const qty = a.charge_type === "per_product" ? products : a.charge_type === "per_image" ? totalImages : 1;
    addonLines.push({ addonId: a.id, name: a.name, chargeType: a.charge_type, quantity: qty, unitAmount: u, amount: u * qty });
  }
  const pctBase = afterDiscount + addonLines.reduce((t, l) => t + l.amount, 0);
  for (const a of chosen) {
    if (a.charge_type !== "percentage") continue;
    const p = a.percentage ?? fail("unpriced", `"${a.name}" has no percentage yet.`);
    addonLines.push({ addonId: a.id, name: a.name, chargeType: "percentage", quantity: p, unitAmount: pctBase, amount: mulMinor(pctBase, p / 100) });
  }
  const subtotal = afterDiscount + addonLines.reduce((t, l) => t + l.amount, 0);
  const min = input.mode === "individual" && s.minimum_order_enabled ? toMinor(s.minimum_order) : 0;
  const minimumAdjustment = Math.max(0, min - subtotal);
  const afterMin = subtotal + minimumAdjustment;
  const inc = toMinor(s.rounding_increment > 0 ? s.rounding_increment : 0);
  const preTaxTotal = inc > 0 ? Math.ceil(afterMin / inc) * inc : afterMin;

  let tax: PhotoQuote["tax"] = null, total = preTaxTotal;
  if (s.tax?.enabled && s.tax.percentage > 0) {
    const p = s.tax.percentage;
    const amount = s.tax.inclusive ? preTaxTotal - Math.round((preTaxTotal * 100000) / (100000 + Math.round(p * 1000))) : mulMinor(preTaxTotal, p / 100);
    if (!s.tax.inclusive) total += amount;
    tax = { label: s.tax.label, percentage: p, inclusive: s.tax.inclusive, amount };
  }
  return {
    category: "photography", currency: s.currency, mode: input.mode, workflow, item, products, imagesPerProduct, totalImages,
    views: views.map((v) => ({ id: v.id, name: v.name })), background: input.background?.slice(0, 80) || null, modelRequired: !!input.modelRequired,
    unitPrice: unit, baseAmount, bulk, addonLines, subtotal, minimumAdjustment, roundingAdjustment: preTaxTotal - afterMin, preTaxTotal, tax, total,
  };
}

export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = {
  enabled: false, currency: "BDT", rounding_increment: 100, minimum_order: 1000, minimum_order_enabled: false,
  max_products: 500, max_images_per_product: 30,
  workflows: [{ slug: "magnific-c3", name: "Magnific C3" }, { slug: "gpt-5-image", name: "GPT-5 Image" }],
  backgrounds: ["White studio", "Solid colour", "Lifestyle scene", "Custom"],
  tax: { enabled: false, label: "VAT", percentage: 0, inclusive: false },
};
