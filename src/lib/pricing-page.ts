/** Parsing for the Pricing page's CMS sections (pricing_included, pricing_faq). Client-safe. */
export type PricingContentItem = { title: string; body: string; enabled: boolean };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseContentItems(raw: unknown): PricingContentItem[] {
  const items = obj(raw)["items"];
  return (Array.isArray(items) ? items : []).slice(0, 30).map((i) => {
    const o = obj(i);
    return { title: str(o["title"], 160), body: str(o["body"], 2000), enabled: o["enabled"] === true };
  });
}

/** Public: only enabled items with both a title and approved body text. */
export const publicItems = (raw: unknown) => parseContentItems(raw).filter((i) => i.enabled && i.title && i.body);
