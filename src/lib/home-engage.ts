/** Parsing for the Home services_snapshot, pricing and book_call_cta sections. Client-safe. */
import { asObj } from "./home-closing";

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []);

export type SnapshotItem = { label: string; description: string; slug: string; enabled: boolean };
export function parseSnapshotItems(raw: unknown): SnapshotItem[] {
  return list(asObj(raw)["items"]).slice(0, 12).map((i) => {
    const o = asObj(i);
    return { label: str(o["label"], 80), description: str(o["description"], 200), slug: str(o["slug"], 120).toLowerCase(), enabled: o["enabled"] !== false };
  });
}

export const PRICE_TYPES = [
  ["custom", "Custom Quote"], ["contact", "Contact Us"], ["fixed", "Fixed price"],
  ["from", "Starting from"], ["range", "Price range"], ["monthly", "Monthly"],
] as const;
export type PriceType = (typeof PRICE_TYPES)[number][0];

export type PricingPlan = {
  id: string; name: string; tagline: string; price_type: PriceType; price: string; price_max: string; currency: string;
  features: string[]; cta_label: string; cta_url: string; highlighted: boolean; badge: string; enabled: boolean;
};

export const newPlan = (): PricingPlan => ({
  id: Math.random().toString(36).slice(2, 10), name: "", tagline: "", price_type: "custom", price: "", price_max: "", currency: "",
  features: [], cta_label: "Get a Quote", cta_url: "/start-a-project", highlighted: false, badge: "", enabled: true,
});

export function parsePlans(raw: unknown): PricingPlan[] {
  return list(asObj(raw)["plans"]).slice(0, 6).map((p, i) => {
    const o = asObj(p);
    const t = PRICE_TYPES.find(([k]) => k === o["price_type"])?.[0] ?? "custom";
    return {
      id: str(o["id"], 40) || `p${i}`, name: str(o["name"], 60), tagline: str(o["tagline"], 200), price_type: t,
      price: str(o["price"], 30), price_max: str(o["price_max"], 30), currency: str(o["currency"], 8),
      features: list(o["features"]).map((f) => str(f, 120)).filter(Boolean).slice(0, 12),
      cta_label: str(o["cta_label"], 40), cta_url: str(o["cta_url"], 300), highlighted: o["highlighted"] === true,
      badge: str(o["badge"], 30), enabled: o["enabled"] !== false,
    };
  });
}

/** Display price: { main, suffix }. Never invents a number — missing values fall back to "Custom Quote". */
export function priceLabel(p: PricingPlan): { main: string; prefix: string; suffix: string } {
  const c = p.currency;
  const fmt = (v: string) => `${c}${v}`;
  if (p.price_type === "contact") return { prefix: "", main: "Contact Us", suffix: "" };
  if (p.price_type === "custom" || !p.price) return { prefix: "", main: "Custom Quote", suffix: "" };
  if (p.price_type === "from") return { prefix: "From", main: fmt(p.price), suffix: "" };
  if (p.price_type === "range") return { prefix: "", main: p.price_max ? `${fmt(p.price)}–${fmt(p.price_max)}` : fmt(p.price), suffix: "" };
  if (p.price_type === "monthly") return { prefix: "", main: fmt(p.price), suffix: "/ month" };
  return { prefix: "", main: fmt(p.price), suffix: "" };
}
