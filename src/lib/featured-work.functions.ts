import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

export type WorkMedia = { type: "image" | "video" | "vimeo"; url: string; poster: string | null; alt: string; orientation: string };
export type WorkItem = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  category: string | null;
  services: string[];
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
  showCategory: boolean;
  showServices: boolean;
  items: WorkItem[];
} | null;

const MEDIA_TYPES = new Set(["image", "video", "vimeo"]);

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
    const max = Math.min(6, Math.max(1, Number(cfg["max_projects"]) || 6));

    const { data: projects } = await sb
      .from("portfolio_projects")
      .select("id,slug,title,client_name,project_year,cover_type,cover_url,category_id,is_featured,sort_order,updated_at")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("updated_at", { ascending: false })
      .limit(max);
    const list = projects ?? [];
    const ids = list.map((p) => p.id);
    const catIds = [...new Set(list.map((p) => p.category_id).filter((x): x is string => !!x))];

    const [media, cats, links] = await Promise.all([
      ids.length ? sb.from("portfolio_media").select("project_id,media_type,url,poster_url,alt_text,orientation,sort_order").in("project_id", ids).order("sort_order") : null,
      catIds.length ? sb.from("portfolio_categories").select("id,name").in("id", catIds).eq("status", "published") : null,
      ids.length ? sb.from("portfolio_project_services").select("project_id,service_id,sort_order").in("project_id", ids).order("sort_order") : null,
    ]);
    const svcIds = [...new Set((links?.data ?? []).map((l) => l.service_id))];
    const svcs = svcIds.length ? (await sb.from("services").select("id,name").in("id", svcIds).eq("status", "published")).data ?? [] : [];
    const svcName = new Map(svcs.map((s) => [s.id, s.name]));
    const catName = new Map((cats?.data ?? []).map((c) => [c.id, c.name]));

    const items: WorkItem[] = list.map((p) => {
      const pm = (media?.data ?? []).filter((m) => m.project_id === p.id);
      const match = pm.find((m) => m.url === p.cover_url);
      let m: WorkMedia | null = null;
      if (p.cover_url && p.cover_type && MEDIA_TYPES.has(p.cover_type)) {
        m = { type: p.cover_type as WorkMedia["type"], url: p.cover_url, poster: match?.poster_url ?? null, alt: match?.alt_text || p.title, orientation: match?.orientation ?? "auto" };
      } else {
        const first = pm.find((x) => MEDIA_TYPES.has(x.media_type));
        if (first) m = { type: first.media_type as WorkMedia["type"], url: first.url, poster: first.poster_url, alt: first.alt_text || p.title, orientation: first.orientation };
      }
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        client: p.client_name,
        category: p.category_id ? catName.get(p.category_id) ?? null : null,
        services: (links?.data ?? []).filter((l) => l.project_id === p.id).map((l) => svcName.get(l.service_id)).filter((x): x is string => !!x).slice(0, 3),
        year: p.project_year,
        media: m,
      };
    });

    return {
      eyebrow: sec.eyebrow || "SELECTED WORK",
      title: sec.title || "Made by Branta.",
      body: sec.body || "",
      ctaLabel: sec.cta_label || "View All Work",
      ctaUrl: sec.cta_url || "/work",
      showClient: cfg["show_client"] !== false,
      showCategory: cfg["show_category"] !== false,
      showServices: cfg["show_services"] !== false,
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
