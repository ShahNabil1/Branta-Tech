/** Builds route head() meta from real values only. Image tags are added only for absolute https images. */
export function pageMeta({ title, description, image, noindex, type = "website" }: { title: string; description: string; image?: string | null; noindex?: boolean; type?: string }) {
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
