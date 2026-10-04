/** Case-study section model shared by the public renderer and the Control Centre builder. Client-safe. */
import { vimeoId } from "./hero";

export const SECTION_TYPES = [
  { value: "rich_text", label: "Rich text", media: 0 },
  { value: "full_image", label: "Full width image", media: 1 },
  { value: "full_video", label: "Full width video / Vimeo", media: 1 },
  { value: "image_grid", label: "Image grid", media: 12 },
  { value: "two_column_media", label: "Two column media", media: 2 },
  { value: "text_media", label: "Text + media", media: 1 },
  { value: "challenge", label: "Challenge", media: 1 },
  { value: "solution", label: "Solution / approach", media: 1 },
  { value: "process", label: "Process", media: 0, items: "steps" },
  { value: "gallery", label: "Gallery", media: 24 },
  { value: "before_after", label: "Before / after", media: 0, beforeAfter: true },
  { value: "result", label: "Result", media: 1 },
  { value: "quote", label: "Quote / client feedback", media: 0, quote: true },
  { value: "credits", label: "Team / credits", media: 0 },
  { value: "key_facts", label: "Key facts / project details", media: 0, items: "facts" },
  { value: "custom", label: "Custom editorial", media: 6 },
] as const satisfies readonly { value: string; label: string; media: number; items?: "steps" | "facts"; quote?: boolean; beforeAfter?: boolean }[];

export type SectionType = (typeof SECTION_TYPES)[number]["value"];
export const sectionMeta = (t: string) => SECTION_TYPES.find((s) => s.value === t) as
  | { value: SectionType; label: string; media: number; items?: "steps" | "facts"; quote?: boolean; beforeAfter?: boolean }
  | undefined;

export const LAYOUTS = ["contained", "wide", "full", "portrait", "two-up", "three-up", "text-left", "text-right"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const TONES = ["light", "dark"] as const;
export type Tone = (typeof TONES)[number];

export type CaseMedia = { type: "image" | "video" | "vimeo"; url: string; poster: string; alt: string; caption: string };
export type CaseItem = { label: string; value: string };
export type CaseConfig = {
  layout: Layout;
  tone: Tone;
  media: CaseMedia[];
  items: CaseItem[];
  quote_name: string;
  quote_role: string;
  quote_company: string;
  quote_avatar: string;
  before_url: string;
  after_url: string;
  before_alt: string;
  after_alt: string;
};

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const safeHttps = (v: unknown) => {
  const s = str(v, 2000);
  try { return s && new URL(s).protocol === "https:" ? s : ""; } catch { return ""; }
};

/** Validates config into a closed shape: known layouts only, https media only, capped lists. Never trusts raw JSON. */
export function parseCaseConfig(raw: unknown, type?: string): CaseConfig {
  const c = obj(raw);
  const max = sectionMeta(type ?? "")?.media ?? 24;
  const media = (Array.isArray(c["media"]) ? c["media"] : [])
    .map((m) => {
      const o = obj(m);
      const t = o["type"] === "vimeo" || o["type"] === "video" ? (o["type"] as "vimeo" | "video") : "image";
      const url = safeHttps(o["url"]);
      return { type: t, url: t === "vimeo" && !vimeoId(url) ? "" : url, poster: safeHttps(o["poster"]), alt: str(o["alt"], 300), caption: str(o["caption"], 300) };
    })
    .filter((m) => m.url)
    .slice(0, Math.max(max, 0));
  const items = (Array.isArray(c["items"]) ? c["items"] : [])
    .map((i) => ({ label: str(obj(i)["label"], 200), value: str(obj(i)["value"], 1000) }))
    .filter((i) => i.label || i.value)
    .slice(0, 12);
  return {
    layout: LAYOUTS.includes(c["layout"] as Layout) ? (c["layout"] as Layout) : "contained",
    tone: c["tone"] === "dark" ? "dark" : "light",
    media, items,
    quote_name: str(c["quote_name"], 200), quote_role: str(c["quote_role"], 200), quote_company: str(c["quote_company"], 200),
    quote_avatar: safeHttps(c["quote_avatar"]),
    before_url: safeHttps(c["before_url"]), after_url: safeHttps(c["after_url"]),
    before_alt: str(c["before_alt"], 300), after_alt: str(c["after_alt"], 300),
  };
}

/** Raw (lenient) config for editing — keeps half-typed values. */
export function editableConfig(raw: unknown): CaseConfig {
  const c = obj(raw);
  const p = parseCaseConfig(raw);
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  return {
    ...p,
    media: (Array.isArray(c["media"]) ? c["media"] : []).map((m) => {
      const o = obj(m);
      return { type: (["image", "video", "vimeo"].includes(o["type"] as string) ? o["type"] : "image") as CaseMedia["type"], url: str(o["url"]), poster: str(o["poster"]), alt: str(o["alt"]), caption: str(o["caption"]) };
    }),
    items: (Array.isArray(c["items"]) ? c["items"] : []).map((i) => ({ label: str(obj(i)["label"]), value: str(obj(i)["value"]) })),
    quote_avatar: s("quote_avatar"), before_url: s("before_url"), after_url: s("after_url"),
  };
}
