export const IMAGE_SIZES = ["large", "medium", "portrait", "wide"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageItem = { url: string; alt: string; label: string; project_id: string | null; size_variant: ImageSize; sort_order: number };
export type BeforeAfter = { before_url: string; after_url: string; alt: string } | null;
export type AiImageConfig = { layout_variant: string; media_items: ImageItem[]; before_after_pair: BeforeAfter };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseImageConfig(raw: unknown): AiImageConfig {
  const c = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const items = (Array.isArray(c["media_items"]) ? c["media_items"] : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((m, i) => ({
      url: str(m["url"]),
      alt: str(m["alt"]),
      label: str(m["label"]),
      project_id: str(m["project_id"]) || null,
      size_variant: (IMAGE_SIZES as readonly string[]).includes(str(m["size_variant"])) ? (str(m["size_variant"]) as ImageSize) : "medium",
      sort_order: Number(m["sort_order"]) || (i + 1) * 10,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
  const ba = c["before_after_pair"] as Record<string, unknown> | null | undefined;
  const pair = ba && typeof ba === "object" && str(ba["before_url"]) && str(ba["after_url"])
    ? { before_url: str(ba["before_url"]), after_url: str(ba["after_url"]), alt: str(ba["alt"]) }
    : null;
  return { layout_variant: str(c["layout_variant"]) || "editorial", media_items: items, before_after_pair: pair };
}

/** Only https or same-origin asset paths are rendered. */
export const safeImg = (u: string) => /^https:\/\//.test(u) || /^\/[^/]/.test(u);
