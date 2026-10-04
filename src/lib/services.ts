/** Service page model shared by the public pages and the Control Centre editor. Client-safe. */
import { vimeoId } from "./hero";
import { safeHttps } from "./case-study";

export type ServiceItem = { label: string; description: string };
export type ServiceCta = { heading: string; body: string; label: string; url: string };
export type ServiceMedia = { type: "image" | "video" | "vimeo"; url: string; poster: string; alt: string };

export type ServicePageConfig = {
  eyebrow: string;
  intro_heading: string;
  supporting: string;
  hero_alt: string;
  deliverables_heading: string;
  deliverables: ServiceItem[];
  process_heading: string;
  process: ServiceItem[];
  cta: ServiceCta;
  project_ids: string[];
};

export type GroupConfig = { media: ServiceMedia | null };

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Internal /path or https URL only. */
export const safeLink = (v: unknown) => {
  const s = str(v, 500);
  if (/^\/(?!\/)[\w\-/#?=&.%]*$/.test(s)) return s;
  return safeHttps(s);
};

const items = (v: unknown, max = 12): ServiceItem[] =>
  (Array.isArray(v) ? v : [])
    .map((i) => ({ label: str(obj(i)["label"], 200), description: str(obj(i)["description"], 600) }))
    .filter((i) => i.label)
    .slice(0, max);

export function parseServiceConfig(raw: unknown): ServicePageConfig {
  const c = obj(raw);
  const cta = obj(c["cta"]);
  return {
    eyebrow: str(c["eyebrow"], 120),
    intro_heading: str(c["intro_heading"], 200),
    supporting: str(c["supporting"], 2000),
    hero_alt: str(c["hero_alt"], 300),
    deliverables_heading: str(c["deliverables_heading"], 200),
    deliverables: items(c["deliverables"], 16),
    process_heading: str(c["process_heading"], 200),
    process: items(c["process"], 10),
    cta: { heading: str(cta["heading"], 200), body: str(cta["body"], 600), label: str(cta["label"], 80), url: safeLink(cta["url"]) },
    project_ids: (Array.isArray(c["project_ids"]) ? c["project_ids"] : []).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 6),
  };
}

/** Validated media (https only; vimeo must be a real Vimeo link). */
export function parseMedia(type: unknown, url: unknown, poster: unknown, alt: unknown): ServiceMedia | null {
  const t = type === "vimeo" || type === "video" || type === "image" ? type : null;
  const u = safeHttps(url);
  if (!t || !u || (t === "vimeo" && !vimeoId(u))) return null;
  return { type: t, url: u, poster: safeHttps(poster), alt: str(alt, 300) };
}

export function parseGroupConfig(raw: unknown): GroupConfig {
  const m = obj(obj(raw)["media"]);
  return { media: parseMedia(m["type"], m["url"], m["poster"], m["alt"]) };
}
