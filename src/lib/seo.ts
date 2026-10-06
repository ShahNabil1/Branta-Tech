/** Builds route head() meta from real values only. Image tags are added only for absolute https images. */
export function pageMeta({ title, description, image, noindex, type = "website", path }: { title: string; description: string; image?: string | null | undefined; noindex?: boolean | undefined; type?: string; path?: string | undefined }) {
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:site_name", content: "Branta Tech" },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
  if (path) meta.push({ property: "og:url", content: absoluteUrl(path) });
  if (image && /^https:\/\//.test(image)) meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
  if (noindex) meta.push({ name: "robots", content: "noindex" });
  return meta;
}

export const SITE_URL = "https://brantatech.com";

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`}`;
}

/** Self-referencing canonical link for a leaf route (absolute https URLs from the CMS win). */
export function canonical(path: string, override?: string | null) {
  let href = absoluteUrl(path);
  if (override) {
    try {
      const candidate = new URL(override);
      if (candidate.protocol === "https:" && candidate.hostname === new URL(SITE_URL).hostname) href = candidate.href;
    } catch {
      // Invalid CMS canonicals safely fall back to this page's public URL.
    }
  }
  return [{ rel: "canonical", href }];
}

export function jsonLd(data: Record<string, unknown> | Array<Record<string, unknown>>) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
