/** Shared homepage media items stored in page_sections.config.media_items. Client-safe parsing. */
import { vimeoId } from "@/lib/hero";
import { parsePriority, type VideoPriority } from "@/lib/video-priority";

export type MediaType = "image" | "video" | "vimeo";
export const ASPECTS = ["16:9", "4:5", "1:1", "4:3", "portrait", "wide", "full"] as const;
export type Aspect = (typeof ASPECTS)[number];
export const POSITIONS = ["center", "top", "bottom", "left", "right"] as const;
export type Position = (typeof POSITIONS)[number];

export type SectionMediaItem = {
  id: string; type: MediaType; url: string; poster_url: string; alt: string; label: string; caption: string;
  enabled: boolean; sort_order: number; autoplay: boolean; muted: boolean; loop: boolean;
  aspect: Aspect; position: Position;
  /** "auto" lets each section pick its default loading priority. */
  priority: VideoPriority | "auto"; sound_control: boolean;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const isHttps = (v: string) => /^https:\/\/\S+$/.test(v);
export const isDirectVideo = (v: string) => isHttps(v) && /\.(mp4|webm)(\?|#|$)/i.test(v);

export const newMediaItem = (aspect: Aspect = "16:9"): SectionMediaItem => ({
  id: Math.random().toString(36).slice(2, 10), type: "image", url: "", poster_url: "", alt: "", label: "", caption: "",
  enabled: true, sort_order: 0, autoplay: true, muted: true, loop: true, aspect, position: "center", priority: "auto", sound_control: true,
});

/** Usable publicly: https URL matching its type. */
export function isRenderable(m: SectionMediaItem) {
  if (m.type === "vimeo") return !!vimeoId(m.url);
  if (m.type === "video") return isDirectVideo(m.url);
  return isHttps(m.url);
}

export function parseMediaItems(raw: unknown, publicOnly = false, fallbackAspect: Aspect = "16:9"): SectionMediaItem[] {
  const list = Array.isArray(obj(raw)["media_items"]) ? (obj(raw)["media_items"] as unknown[]) : [];
  const all = list.slice(0, 24).map((r, i): SectionMediaItem => {
    const o = obj(r);
    const type = (["image", "video", "vimeo"] as const).find((t) => t === o["type"]) ?? "image";
    return {
      id: str(o["id"]) || `m${i}`, type, url: str(o["url"]), poster_url: str(o["poster_url"]), alt: str(o["alt"]).slice(0, 300),
      label: str(o["label"]).slice(0, 80), caption: str(o["caption"]).slice(0, 200), enabled: o["enabled"] !== false,
      sort_order: Number.isFinite(Number(o["sort_order"])) ? Number(o["sort_order"]) : i,
      autoplay: o["autoplay"] !== false, muted: o["muted"] !== false, loop: o["loop"] !== false,
      aspect: (ASPECTS as readonly string[]).includes(str(o["aspect"])) ? (str(o["aspect"]) as Aspect) : fallbackAspect,
      position: (POSITIONS as readonly string[]).includes(str(o["position"])) ? (str(o["position"]) as Position) : "center",
      priority: parsePriority(o["priority"]), sound_control: o["sound_control"] !== false,
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
  if (!publicOnly) return all;
  return all.filter((m) => m.enabled && isRenderable(m)).map((m) => ({ ...m, poster_url: isHttps(m.poster_url) ? m.poster_url : "", muted: m.autoplay ? true : m.muted }));
}
