/**
 * Final-quote arithmetic (pure). Integer minor units throughout.
 * Order: line items → one discount (fixed or %) on the line subtotal → tax on the discounted amount.
 * Exclusive tax is added on top; inclusive tax is reported as contained in the total.
 */
import type { Quote } from "./engine";

export type QuoteLineItem = { label: string; quantity: number; unit_minor: number };
export type DiscountType = "none" | "fixed" | "percentage";
export type QuoteTerms = {
  line_items: QuoteLineItem[]; discount_type: DiscountType; discount_value: number; // major units for fixed, % for percentage
  tax_percentage: number; tax_inclusive: boolean;
};
export type QuoteTotals = { subtotal_minor: number; discount_minor: number; tax_minor: number; total_minor: number; lines: (QuoteLineItem & { amount_minor: number })[] };

export class QuoteBuildError extends Error {}

export function computeQuoteTotals(t: QuoteTerms): QuoteTotals {
  const lines = t.line_items.map((l) => {
    if (!l.label.trim()) throw new QuoteBuildError("Every line item needs a description.");
    if (!Number.isFinite(l.quantity) || l.quantity <= 0 || Math.round(l.quantity * 1000) !== l.quantity * 1000) throw new QuoteBuildError(`"${l.label}": quantity must be above 0.`);
    if (!Number.isInteger(l.unit_minor)) throw new QuoteBuildError(`"${l.label}": invalid amount.`);
    return { ...l, amount_minor: Math.round(l.unit_minor * l.quantity) };
  });
  const subtotal = lines.reduce((s, l) => s + l.amount_minor, 0);
  if (subtotal < 0) throw new QuoteBuildError("Line items can't total below zero.");
  let discount = 0;
  if (t.discount_type === "fixed") discount = Math.round(t.discount_value * 100);
  if (t.discount_type === "percentage") {
    if (!(t.discount_value >= 0 && t.discount_value <= 100)) throw new QuoteBuildError("Discount percentage must be 0–100.");
    discount = Math.round((subtotal * Math.round(t.discount_value * 1000)) / 100000);
  }
  if (discount < 0) throw new QuoteBuildError("Discount can't be negative.");
  if (discount > subtotal) throw new QuoteBuildError("Discount can't exceed the subtotal.");
  const net = subtotal - discount;
  if (!(t.tax_percentage >= 0 && t.tax_percentage <= 100)) throw new QuoteBuildError("Tax percentage must be 0–100.");
  const p = Math.round(t.tax_percentage * 1000);
  const tax = p === 0 ? 0 : t.tax_inclusive ? net - Math.round((net * 100000) / (100000 + p)) : Math.round((net * p) / 100000);
  return { lines, subtotal_minor: subtotal, discount_minor: discount, tax_minor: tax, total_minor: t.tax_inclusive ? net : net + tax };
}

/** Starting line items derived from a stored estimate snapshot (never from live prices). */
export function linesFromEstimate(q: Quote | null): QuoteLineItem[] {
  if (!q) return [];
  const out: QuoteLineItem[] = [
    { label: `Base creative fee — ${q.videoType.name}`, quantity: 1, unit_minor: q.baseFee },
    { label: `AI production — ${q.model.name}, ${q.durationSeconds}s, ${q.tier.name}`, quantity: 1, unit_minor: q.variableSubtotal },
    ...q.addonLines.map((l) => ({ label: l.name + (l.chargeType === "per_scene" ? ` (${l.quantity} scenes)` : ""), quantity: 1, unit_minor: l.amount })),
  ];
  if (q.minimumAdjustment) out.push({ label: "Minimum project adjustment", quantity: 1, unit_minor: q.minimumAdjustment });
  if (q.roundingAdjustment) out.push({ label: "Rounding", quantity: 1, unit_minor: q.roundingAdjustment });
  return out;
}

/** Customer-link token: 32 random bytes, base64url. Only its SHA-256 is stored. */
export function newAccessToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function hashToken(token: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
