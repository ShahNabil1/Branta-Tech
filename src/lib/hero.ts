/** Browser-safe hero types, defaults and config parsing (shared by site + Control Centre). */

export type HeroMediaRole = "film" | "fashion" | "product" | "campaign" | "ugc" | "web";
export type HeroMediaType = "vimeo" | "image" | "video";
export type HeroMediaItem = {
  role: HeroMediaRole;
  type: HeroMediaType;
  url: string;
  poster_url: string;
  label: string;
  alt: string;
  size_variant: "primary" | "portrait" | "small" | "wide";
  sort_order: number;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
};
export type HeroContent = {
  eyebrow: string;
  title: string;
  body: string;
  primary: { label: string; url: string };
  secondary: { label: string; url: string };
  capabilities: string[];
  media: HeroMediaItem[];
};

export const HERO_ROLES: { value: HeroMediaRole; label: string }[] = [
  { value: "film", label: "AI Film (main tile)" },
  { value: "fashion", label: "AI Fashion (portrait)" },
  { value: "product", label: "AI Product" },
  { value: "campaign", label: "AI Campaign" },
  { value: "ugc", label: "AI UGC" },
  { value: "web", label: "Digital Product (wide)" },
];
export const HERO_SIZES = ["primary", "portrait", "small", "wide"].map((v) => ({ value: v, label: v }));
export const HERO_MEDIA_TYPES = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video file (MP4/WebM)" },
  { value: "vimeo", label: "Vimeo" },
];

/** Built-in copy used only if the CMS hero cannot be read. Media stays empty — never filler. */
export const HERO_FALLBACK: HeroContent = {
  eyebrow: "AI-powered creative & technology studio",
  title: "We Create What Brands Need Next.",
  body: "AI films, product visuals, campaigns, digital products and automation, built by one integrated creative technology team.",
  primary: { label: "Explore Our Work", url: "/work" },
  secondary: { label: "Start a Project", url: "/start-a-project" },
  capabilities: ["AI Film", "AI Photography", "Creative", "Web", "Software", "Automation"],
  media: [],
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
export const safeMediaUrl = (u: string) => (/^https:\/\//.test(u) || (u.startsWith("/") && !u.startsWith("//")) ? u : "");

/** Vimeo ID from vimeo.com/123, vimeo.com/channels/x/123, player.vimeo.com/video/123, with any query string. */
export function vimeoId(url: string) {
  if (!/^https:\/\/(www\.|player\.)?vimeo\.com\//i.test(url.trim())) return null;
  return /vimeo\.com\/(?:.*\/)?(\d{6,})(?:[/?#]|$)/.exec(url.trim())?.[1] ?? null;
}
export const isVideoFile = (u: string) => /\.(mp4|webm|m4v|mov)(\?.*)?$/i.test(u);
const isImageFile = (u: string) => /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(u) || /vimeocdn\.com|\/storage\/v1\/object\/public\/|\/__l5e\/assets/i.test(u);

/** Admin validation for one item; null when valid or empty (empty items stay hidden). */
export function mediaItemError(m: Pick<HeroMediaItem, "type" | "url" | "poster_url">): { url?: string; poster?: string } | null {
  const e: { url?: string; poster?: string } = {};
  if (m.url) {
    if (!safeMediaUrl(m.url)) e.url = "Use an https:// link or an uploaded file.";
    else if (m.type === "vimeo" && !vimeoId(m.url)) e.url = "Not a valid Vimeo link (e.g. https://vimeo.com/123456789).";
    else if (m.type !== "vimeo" && vimeoId(m.url)) e.url = "This is a Vimeo link — set Media type to Vimeo.";
    else if (m.type === "video" && !isVideoFile(m.url)) e.url = "Use a direct .mp4 or .webm file link.";
    else if (m.type === "image" && isVideoFile(m.url)) e.url = "This is a video file — set Media type to Video file.";
  }
  if (m.poster_url && m.type !== "image") {
    if (!safeMediaUrl(m.poster_url)) e.poster = "Use an https:// link or an uploaded image.";
    else if (vimeoId(m.poster_url) || isVideoFile(m.poster_url)) e.poster = "Poster must be an image, not a video link.";
  }
  return e.url || e.poster ? e : null;
}

export function heroMediaErrors(raw: unknown): string | null {
  const bad = parseMediaItems(raw).map((m, i) => (mediaItemError(m) ? i + 1 : 0)).filter(Boolean);
  return bad.length ? `Fix hero media item ${bad.join(", ")} before saving.` : null;
}

export function parseMediaItems(raw: unknown): HeroMediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x, i) => {
      const t = str(x["type"]);
      return {
        role: (str(x["role"]) || "product") as HeroMediaRole,
        type: (t === "vimeo" || t === "video" ? t : "image") as HeroMediaType,
        url: str(x["url"]),
        poster_url: str(x["poster_url"]),
        label: str(x["label"]),
        alt: str(x["alt"]),
        size_variant: (str(x["size_variant"]) || "small") as HeroMediaItem["size_variant"],
        sort_order: typeof x["sort_order"] === "number" ? x["sort_order"] : (i + 1) * 10,
        autoplay: bool(x["autoplay"], true),
        loop: bool(x["loop"], true),
        muted: bool(x["muted"], true),
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

export type HeroSectionRow = {
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  config: import("@/integrations/supabase/types").Json;
};

/** Public normalisation: tolerant of legacy mistakes (Vimeo link saved as "video", video link as poster). */
export function normalizeForPublic(m: HeroMediaItem): HeroMediaItem | null {
  const url = safeMediaUrl(m.url);
  if (!url) return null;
  let type = m.type;
  if (vimeoId(url)) type = "vimeo";
  else if (type === "vimeo") return null;
  else if (isVideoFile(url)) type = "video";
  let poster = type === "image" ? "" : safeMediaUrl(m.poster_url);
  if (poster && (vimeoId(poster) || isVideoFile(poster))) poster = "";
  return { ...m, type, url, poster_url: poster };
}

export function heroFromSection(s: HeroSectionRow | null): HeroContent {
  if (!s) return HERO_FALLBACK;
  const c = (s.config && typeof s.config === "object" ? s.config : {}) as Record<string, unknown>;
  const sec = (c["secondary_cta"] ?? {}) as Record<string, unknown>;
  const caps = Array.isArray(c["capabilities"]) ? c["capabilities"].filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  return {
    eyebrow: s.eyebrow ?? "",
    title: s.title ?? "",
    body: s.body ?? "",
    primary: { label: s.cta_label ?? "", url: s.cta_url ?? "" },
    secondary: { label: str(sec["label"]), url: str(sec["url"]) },
    capabilities: caps,
    media: parseMediaItems(c["media_items"]).map(normalizeForPublic).filter((m): m is HeroMediaItem => !!m),
  };
}

export { isImageFile };
