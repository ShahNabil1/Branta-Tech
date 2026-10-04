/** Parsing for the Home trust_proof section (stats + funded-by). Logos come from the client_logos section. Client-safe. */
import { asObj, httpsUrl } from "./home-closing";

export type TrustStat = { value: string; label: string; enabled: boolean };
export type FundedBy = { enabled: boolean; label: string; name: string; logo_url: string; url: string; body: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** All stats (admin). `publicOnly` keeps enabled ones with both value and label. */
export function parseStats(raw: unknown, publicOnly = false): TrustStat[] {
  const list = Array.isArray(asObj(raw)["stats"]) ? (asObj(raw)["stats"] as unknown[]) : [];
  const all = list.map((s) => {
    const o = asObj(s);
    return { value: str(o["value"]), label: str(o["label"]), enabled: o["enabled"] !== false };
  }).slice(0, 6);
  return publicOnly ? all.filter((s) => s.enabled && s.value && s.label) : all;
}

export function parseFundedBy(raw: unknown): FundedBy {
  const o = asObj(asObj(raw)["funded_by"]);
  return {
    enabled: o["enabled"] === true, label: str(o["label"]) || "FUNDED BY", name: str(o["name"]),
    logo_url: str(o["logo_url"]), url: str(o["url"]), body: str(o["body"]),
  };
}

export const showLogos = (raw: unknown) => asObj(raw)["show_logos"] !== false;
export const publicFundedBy = (raw: unknown): FundedBy | null => {
  const f = parseFundedBy(raw);
  return f.enabled && f.name ? { ...f, logo_url: httpsUrl(f.logo_url), url: httpsUrl(f.url) } : null;
};
