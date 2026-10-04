/** Browser-safe hero types, defaults and config parsing (shared by site + Control Centre). */

export type HeroMediaRole = "film" | "fashion" | "product" | "campaign" | "ugc" | "web";
export type HeroMediaItem = {
  role: HeroMediaRole;
  type: "vimeo" | "image" | "video";
  url: string;
  poster_url: string;
  label: string;
  alt: string;
  size_variant: "primary" | "portrait" | "small" | "wide";
  sort_order: number;
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
  { value: "film", label: "AI Film (main video)" },
  { value: "fashion", label: "AI Fashion (portrait)" },
  { value: "product", label: "AI Product" },
  { value: "campaign", label: "AI Campaign" },
  { value: "ugc", label: "AI UGC" },
  { value: "web", label: "Digital Product" },
];
export const HERO_SIZES = ["primary", "portrait", "small", "wide"].map((v) => ({ value: v, label: v }));
export const HERO_MEDIA_TYPES = ["vimeo", "image", "video"].map((v) => ({ value: v, label: v }));

/** Built-in copy used only if the CMS hero cannot be read. Media stays empty — never filler. */
export const HERO_FALLBACK: HeroContent = {
  eyebrow: "AI-powered creative & technology studio",
  title: "We Create What Brands Need Next.",
  body: "AI films, product visuals, campaigns, digital products and automation, built by one integrated creative technology team.",
  primary: { label: "Explore Our Work", url: "/work" },
  secondary: { label: "Start a Project", url: "/contact" },
  capabilities: ["AI Film", "AI Photography", "Creative", "Web", "Software", "Automation"],
  media: [],
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const safeMediaUrl = (u: string) => (/^https:\/\//.test(u) || (u.startsWith("/") && !u.startsWith("//")) ? u : "");

export function parseMediaItems(raw: unknown): HeroMediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x, i) => ({
      role: (str(x["role"]) || "product") as HeroMediaRole,
      type: (str(x["type"]) || "image") as HeroMediaItem["type"],
      url: str(x["url"]),
      poster_url: str(x["poster_url"]),
      label: str(x["label"]),
      alt: str(x["alt"]),
      size_variant: (str(x["size_variant"]) || "small") as HeroMediaItem["size_variant"],
      sort_order: typeof x["sort_order"] === "number" ? x["sort_order"] : (i + 1) * 10,
    }))
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
    media: parseMediaItems(c["media_items"])
      .map((m) => ({ ...m, url: safeMediaUrl(m.url), poster_url: safeMediaUrl(m.poster_url) }))
      .filter((m) => m.url),
  };
}

export function vimeoId(url: string) {
  return /vimeo\.com\/(?:video\/)?(\d+)/.exec(url)?.[1] ?? null;
}
