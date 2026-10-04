/** Browser-safe Capability Explorer types + config parsing (shared by site + Control Centre). */

export type CapMediaType = "vimeo" | "image" | "video" | "workflow" | "none";
export type CapMedia = { type: CapMediaType; url: string; poster_url: string; alt: string };
export type CapItem = {
  key: string;
  label: string;
  enabled: boolean;
  sort_order: number;
  headline: string;
  description: string;
  related_labels: string[];
  service_ids: string[];
  cta_label: string;
  cta_url: string;
  media: CapMedia;
};
export type CapConfig = { default_key: string; items: CapItem[] };
export type CapService = { id: string; name: string; slug: string };
export type CapExplorerContent = {
  eyebrow: string;
  title: string;
  body: string;
  default_key: string;
  items: (CapItem & { related: string[] })[];
};

export const CAP_MEDIA_TYPES: { value: CapMediaType; label: string }[] = [
  { value: "none", label: "None (clean placeholder)" },
  { value: "image", label: "Image" },
  { value: "vimeo", label: "Vimeo" },
  { value: "video", label: "Video file" },
  { value: "workflow", label: "Workflow diagram" },
];

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const safeMediaUrl = (u: string) => (/^https:\/\//.test(u) || (u.startsWith("/") && !u.startsWith("//")) ? u : "");

export function parseCapConfig(raw: unknown): CapConfig {
  const c = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(c["items"]) ? c["items"] : [];
  const items = list
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x, i): CapItem => {
      const m = (x["media"] && typeof x["media"] === "object" ? x["media"] : {}) as Record<string, unknown>;
      const type = str(m["type"]) as CapMediaType;
      return {
        key: str(x["key"]) || `cap-${i + 1}`,
        label: str(x["label"]),
        enabled: x["enabled"] !== false,
        sort_order: typeof x["sort_order"] === "number" ? x["sort_order"] : (i + 1) * 10,
        headline: str(x["headline"]),
        description: str(x["description"]),
        related_labels: strs(x["related_labels"]),
        service_ids: strs(x["service_ids"]),
        cta_label: str(x["cta_label"]),
        cta_url: str(x["cta_url"]),
        media: {
          type: CAP_MEDIA_TYPES.some((t) => t.value === type) ? type : "none",
          url: str(m["url"]),
          poster_url: str(m["poster_url"]),
          alt: str(m["alt"]),
        },
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
  return { default_key: str(c["default_key"]), items };
}

export type CapSectionRow = { eyebrow: string | null; title: string | null; body: string | null; config: import("@/integrations/supabase/types").Json };

/** Public view: enabled items only; related names come from real services when linked, else config labels. */
export function capExplorerFrom(s: CapSectionRow | null, services: CapService[]): CapExplorerContent | null {
  if (!s) return null;
  const cfg = parseCapConfig(s.config);
  const byId = new Map(services.map((x) => [x.id, x.name]));
  const items = cfg.items
    .filter((i) => i.enabled && i.label.trim())
    .map((i) => {
      const fromDb = i.service_ids.map((id) => byId.get(id)).filter((n): n is string => !!n);
      return {
        ...i,
        media: { ...i.media, url: safeMediaUrl(i.media.url), poster_url: safeMediaUrl(i.media.poster_url) },
        related: fromDb.length ? fromDb : i.related_labels,
      };
    });
  if (!items.length) return null;
  const def = items.some((i) => i.key === cfg.default_key) ? cfg.default_key : items[0]!.key;
  return { eyebrow: s.eyebrow ?? "", title: s.title ?? "", body: s.body ?? "", default_key: def, items };
}
