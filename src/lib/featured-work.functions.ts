import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

export type WorkMedia = { type: "image" | "video" | "vimeo"; url: string; poster: string | null; alt: string; orientation: string; position?: string };
export type WorkItem = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  /** Primary label: category name, else first service name. */
  label: string | null;
  /** Filter tag slugs (category + services). */
  tags: string[];
  year: number | null;
  media: WorkMedia | null;
};
export type FeaturedWork = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  showClient: boolean;
  filters: { slug: string; name: string }[];
  items: WorkItem[];
} | null;

/** Home "featured_work" section + published projects (featured first, then sort_order/recency). Anon RLS, never throws. */
export const getFeaturedWork = createServerFn({ method: "GET" }).handler(async (): Promise<FeaturedWork> => {
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
      .eq("section_type", "featured_work")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!sec) return null;
    const cfg = (sec.config && typeof sec.config === "object" && !Array.isArray(sec.config) ? sec.config : {}) as Record<string, unknown>;
    const max = Math.min(30, Math.max(1, Number(cfg["max_projects"]) || 24));
    const { PROJ_COLS, buildCards } = await import("./work.functions");
    const { data: projects } = await sb.from("portfolio_projects").select(PROJ_COLS).eq("status", "published")
      .order("is_featured", { ascending: false }).order("sort_order").order("updated_at", { ascending: false }).limit(max);
    const { cards } = await buildCards(sb, projects ?? []);
    const seen = new Map<string, { slug: string; name: string }>();
    for (const c of cards) for (const t of [c.category, ...c.services]) if (t && !seen.has(t.slug)) seen.set(t.slug, t);
    const items: WorkItem[] = cards.map((c) => ({
      id: c.id, slug: c.slug, title: c.title, client: c.client, year: c.year, media: c.media,
      label: c.category?.name ?? c.services[0]?.name ?? null,
      tags: [c.category?.slug, ...c.services.map((x) => x.slug)].filter((x): x is string => !!x),
    }));

    return {
      eyebrow: sec.eyebrow || "SELECTED WORK",
      title: sec.title || "Made by Branta.",
      body: sec.body || "",
      ctaLabel: sec.cta_label || "View All Work",
      ctaUrl: sec.cta_url || "/work",
      showClient: cfg["show_client"] !== false,
      filters: [...seen.values()],
      items,
    };
  } catch {
    return null;
  }
});

export const featuredWorkQuery = queryOptions({
  queryKey: ["public", "featured-work"],
  queryFn: () => getFeaturedWork(),
  staleTime: 5 * 60 * 1000,
});
