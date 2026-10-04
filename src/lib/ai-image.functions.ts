import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { parseImageConfig, safeImg, type BeforeAfter, type ImageItem } from "./ai-image";

export type AiImage = { eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string; items: ImageItem[]; pair: BeforeAfter } | null;

/** Home "ai_image_showcase" section. Config images first; if none, falls back to published portfolio image media. Anon RLS, never throws. */
export const getAiImage = createServerFn({ method: "GET" }).handler(async (): Promise<AiImage> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data: sec } = await sb
      .from("page_sections")
      .select("eyebrow,title,body,cta_label,cta_url,config")
      .eq("page_id", page.data.id)
      .eq("section_type", "ai_image_showcase")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!sec) return null;
    const cfg = parseImageConfig(sec.config);
    let items = cfg.media_items.filter((m) => m.url && safeImg(m.url));
    if (!items.length) {
      // Fallback: image media from published projects (RLS hides drafts' media).
      const { data } = await sb.from("portfolio_media").select("url,alt_text,orientation,project_id").eq("media_type", "image").order("sort_order").limit(5);
      items = (data ?? []).map((m, i) => ({
        url: m.url, alt: m.alt_text ?? "", label: "", project_id: m.project_id,
        size_variant: i === 0 ? "large" : m.orientation === "portrait" ? "portrait" : "medium", sort_order: i,
      }));
    }
    return {
      eyebrow: sec.eyebrow || "AI IMAGE",
      title: sec.title || "Your Product.\nAnywhere.",
      body: sec.body || "",
      ctaLabel: sec.cta_label || "Explore AI Image",
      ctaUrl: sec.cta_url || "/services/ai-photography",
      items: items.slice(0, 6),
      pair: cfg.before_after_pair && safeImg(cfg.before_after_pair.before_url) && safeImg(cfg.before_after_pair.after_url) ? cfg.before_after_pair : null,
    };
  } catch {
    return null;
  }
});

export const aiImageQuery = queryOptions({ queryKey: ["public", "ai-image"], queryFn: () => getAiImage(), staleTime: 5 * 60 * 1000 });
