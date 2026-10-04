/** Shared parsing for the closing Home sections: process, client_logos, insights_teaser, careers_teaser, final_cta. Client-safe. */
export type ProcessStep = { title: string; body: string };
export type ClientLogo = { client_name: string; logo_url: string; client_url: string; alt: string; sort_order: number; enabled: boolean };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown) => (Array.isArray(v) ? v : []);
export const httpsUrl = (v: unknown) => (/^https:\/\/\S+$/.test(str(v)) ? str(v) : "");

export function parseSteps(raw: unknown): ProcessStep[] {
  return list(asObj(raw)["steps"]).map((s) => ({ title: str(asObj(s)["title"]), body: str(asObj(s)["body"]) })).filter((s) => s.title).slice(0, 8);
}

/** All logos (for admin); `publicOnly` keeps enabled ones with a real https logo, sorted. */
export function parseLogos(raw: unknown, publicOnly = false): ClientLogo[] {
  const all = list(asObj(raw)["logos"]).map((l, i) => {
    const o = asObj(l);
    return {
      client_name: str(o["client_name"]), logo_url: str(o["logo_url"]), client_url: str(o["client_url"]), alt: str(o["alt"]),
      sort_order: Number(o["sort_order"]) || i, enabled: o["enabled"] !== false,
    };
  });
  if (!publicOnly) return all;
  return all.filter((l) => l.enabled && l.client_name && httpsUrl(l.logo_url)).sort((a, b) => a.sort_order - b.sort_order);
}

export const maxItems = (raw: unknown) => Math.min(3, Math.max(1, Number(asObj(raw)["max_items"]) || 3));
export const secondaryCta = (raw: unknown) => ({ label: str(asObj(raw)["secondary_cta_label"]), url: str(asObj(raw)["secondary_cta_url"]) });
