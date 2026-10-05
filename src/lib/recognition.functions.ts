import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { defaultLabel, isLogoUrl } from "./recognition";

export type RecognitionItem = {
  id: string; type: string; label: string; title: string | null; organization: string;
  description: string | null; year: string | null; logo: string | null; url: string | null;
};
export type Recognition = { eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string; items: RecognitionItem[] } | null;

/** Homepage Recognition: published site_recognitions only (anon RLS). Null hides the section. */
export const getRecognition = createServerFn({ method: "GET" }).handler(async (): Promise<Recognition> => {
  const { client } = await import("./work.functions");
  const sb = client();
  if (!sb) return null;
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data: sec } = await sb.from("page_sections").select("eyebrow,title,body,cta_label,cta_url")
      .eq("page_id", page.data.id).eq("section_type", "recognition").eq("is_visible", true).order("sort_order").limit(1).maybeSingle();
    if (!sec) return null;
    const { data: rows } = await sb.from("site_recognitions").select("*").eq("is_published", true).order("sort_order").limit(24);
    if (!rows?.length) return null;
    return {
      eyebrow: sec.eyebrow || "RECOGNITION", title: sec.title || "Recognition That Matters.", body: sec.body || "",
      ctaLabel: sec.cta_label || "", ctaUrl: sec.cta_url || "/work",
      items: rows.map((r) => ({
        id: r.id, type: r.type, label: r.label?.trim() || defaultLabel(r.type), title: r.title, organization: r.organization,
        description: r.description, year: r.year, logo: r.logo_url && isLogoUrl(r.logo_url) ? r.logo_url : null,
        url: r.external_url && /^https:\/\//.test(r.external_url) ? r.external_url : null,
      })),
    };
  } catch {
    return null;
  }
});

export const recognitionQuery = queryOptions({ queryKey: ["public", "recognition"], queryFn: () => getRecognition(), staleTime: 5 * 60 * 1000 });
