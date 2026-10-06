/** Homepage hero slider: slides[] stored in the Home hero page_section config. Pure parsing, browser-safe. */
import { safeMediaUrl, vimeoId } from "./hero";

export const SLIDE_LAYOUTS = [
  { value: "intro", label: "Intro + 3 mini cards" },
  { value: "video", label: "Full video" },
  { value: "product", label: "Product (split)" },
  { value: "commercial", label: "Cinematic commercial" },
  { value: "web", label: "Web mockup" },
  { value: "brand", label: "Brand card" },
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number]["value"];
export type SlideMedia = { type: "image" | "video" | "vimeo"; url: string; poster: string };
export type HeroSlide = {
  id: string; status: "published" | "draft"; layout: SlideLayout;
  badge: string; title: string; body: string; cta_label: string; cta_url: string;
  media: SlideMedia | null;
  /** Work Showcase homepage group key used for mini cards / fallback media. */
  work_group: string;
};
export type SliderConfig = { autoplay: boolean; interval: number; slides: HeroSlide[] };

const LAYOUTS = new Set<string>(SLIDE_LAYOUTS.map((l) => l.value));
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

function media(raw: unknown): SlideMedia | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const url = str(m["url"], 500).trim();
  const type = m["type"] === "video" || m["type"] === "vimeo" ? m["type"] : "image";
  if (!url) return null;
  if (type === "vimeo" ? !vimeoId(url) : !safeMediaUrl(url)) return null;
  return { type, url, poster: safeMediaUrl(str(m["poster"], 500)) };
}

export function parseSlider(raw: unknown, publicOnly = false): SliderConfig {
  const c = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(c["slides"]) ? (c["slides"] as unknown[]) : [];
  const slides: HeroSlide[] = list.flatMap((r, i) => {
    if (!r || typeof r !== "object") return [];
    const s = r as Record<string, unknown>;
    const slide: HeroSlide = {
      id: str(s["id"], 40) || `s${i}`,
      status: s["status"] === "draft" ? "draft" : "published",
      layout: (LAYOUTS.has(str(s["layout"])) ? s["layout"] : "intro") as SlideLayout,
      badge: str(s["badge"], 60), title: str(s["title"], 140), body: str(s["body"], 320),
      cta_label: str(s["cta_label"], 40), cta_url: str(s["cta_url"], 300),
      media: media(s["media"]), work_group: str(s["work_group"], 40),
    };
    if (publicOnly && (slide.status !== "published" || !slide.title.trim())) return [];
    return [slide];
  });
  return { autoplay: c["slider_autoplay"] !== false, interval: Math.min(15, Math.max(4, Number(c["slider_interval"]) || 7)), slides };
}
