/** Builds route head() meta from real values only. Image tags are added only for absolute https images. */
export function pageMeta({ title, description, image, noindex, type = "website" }: { title: string; description: string; image?: string | null | undefined; noindex?: boolean | undefined; type?: string }) {
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
  if (image && /^https:\/\//.test(image)) meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
  if (noindex) meta.push({ name: "robots", content: "noindex" });
  return meta;
}

export const SITE_URL = "https://brantatech.com";

/** Self-referencing canonical link for a leaf route (absolute https URLs from the CMS win). */
export function canonical(path: string, override?: string | null) {
  const href = override && /^https:\/\//.test(override) ? override : `${SITE_URL}${path === "/" ? "/" : path}`;
  return [{ rel: "canonical", href }];
}
