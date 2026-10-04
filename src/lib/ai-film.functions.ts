import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import type { WorkMedia } from "./featured-work.functions";

export const FILM_FILTERS = [
  { key: "commercial", label: "Commercial", re: /commercial|tvc|ovc|advert/i },
  { key: "product", label: "Product", re: /product/i },
  { key: "fashion", label: "Fashion", re: /fashion/i },
  { key: "ugc", label: "UGC", re: /ugc|reel/i },
  { key: "motion", label: "Motion / VFX", re: /motion|vfx|animation|character/i },
] as const;
const FILM_RE = /film|video|commercial|tvc|ovc|ugc|fashion|motion|vfx|reel|animation/i;

export type FilmItem = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  format: string | null;
  filters: string[];
  media: WorkMedia;
};
export type AiFilm = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  filterEnabled: boolean;
  items: FilmItem[];
} | null;

export type AiFilmConfig = { max_items: number; filter_enabled: boolean; sort_mode: "featured" | "sort_order" | "recent"; project_ids: string[] };

export function parseFilmConfig(raw: unknown): AiFilmConfig {
  const c = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const sm = c["sort_mode"];
  return {
    max_items: Math.min(8, Math.max(1, Number(c["max_items"]) || 8)),
    filter_enabled: c["filter_enabled"] !== false,
    sort_mode: sm === "sort_order" || sm === "recent" ? sm : "featured",
    project_ids: Array.isArray(c["project_ids"]) ? c["project_ids"].filter((x): x is string => typeof x === "string") : [],
  };
}

/** Home "ai_film_showcase" section + published film projects. Manual project_ids first, else film-related published projects. Anon RLS, never throws. */
export const getAiFilm = createServerFn({ method: "GET" }).handler(async (): Promise<AiFilm> => {
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
      .eq("section_type", "ai_film_showcase")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!sec) return null;
    const cfg = parseFilmConfig(sec.config);

    let q = sb
      .from("portfolio_projects")
      .select("id,slug,title,client_name,cover_type,cover_url,category_id,is_featured,sort_order,updated_at")
      .eq("status", "published");
    if (cfg.project_ids.length) q = q.in("id", cfg.project_ids);
    if (cfg.sort_mode === "featured") q = q.order("is_featured", { ascending: false }).order("sort_order");
    else if (cfg.sort_mode === "sort_order") q = q.order("sort_order");
    else q = q.order("updated_at", { ascending: false });
    const { data: projects } = await q.limit(50);
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

    const items: FilmItem[] = [];
    for (const p of list) {
      const pm = (media?.data ?? []).filter((m) => m.project_id === p.id);
      // Films only: cover or first media must be video/vimeo.
      let m: WorkMedia | null = null;
      if (p.cover_url && (p.cover_type === "vimeo" || p.cover_type === "video")) {
        const match = pm.find((x) => x.url === p.cover_url);
        m = { type: p.cover_type, url: p.cover_url, poster: match?.poster_url ?? null, alt: match?.alt_text || p.title, orientation: match?.orientation ?? "auto" };
      } else {
        const v = pm.find((x) => x.media_type === "vimeo" || x.media_type === "video");
        if (v) m = { type: v.media_type as WorkMedia["type"], url: v.url, poster: v.poster_url, alt: v.alt_text || p.title, orientation: v.orientation };
      }
      if (!m) continue;
      const cat = p.category_id ? catName.get(p.category_id) ?? null : null;
      const svc = (links?.data ?? []).filter((l) => l.project_id === p.id).map((l) => svcName.get(l.service_id)).filter((x): x is string => !!x);
      const tags = [cat, ...svc].filter((x): x is string => !!x);
      // Projects tagged with unrelated work are excluded unless hand-picked.
      if (!cfg.project_ids.length && tags.length && !tags.some((t) => FILM_RE.test(t))) continue;
      items.push({
        id: p.id,
        slug: p.slug,
        title: p.title,
        client: p.client_name,
        format: cat ?? svc[0] ?? null,
        filters: FILM_FILTERS.filter((f) => tags.some((t) => f.re.test(t))).map((f) => f.key),
        media: m,
      });
    }
    if (cfg.project_ids.length) items.sort((a, b) => cfg.project_ids.indexOf(a.id) - cfg.project_ids.indexOf(b.id));

    return {
      eyebrow: sec.eyebrow || "AI FILM",
      title: sec.title || "Turn an Idea Into a World.",
      body: sec.body || "",
      ctaLabel: sec.cta_label || "Explore AI Film",
      ctaUrl: sec.cta_url || "/services/ai-video-film",
      filterEnabled: cfg.filter_enabled,
      items: items.slice(0, cfg.max_items),
    };
  } catch {
    return null;
  }
});

export const aiFilmQuery = queryOptions({
  queryKey: ["public", "ai-film"],
  queryFn: () => getAiFilm(),
  staleTime: 5 * 60 * 1000,
});
