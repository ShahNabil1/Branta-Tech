import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { WorkMedia } from "./featured-work.functions";
import { vimeoId } from "./hero";
import { parseCaseConfig, safeHttps, type CaseConfig } from "./case-study";

export type Tag = { slug: string; name: string };
export type WorkCard = {
  id: string; slug: string; title: string; client: string | null; year: number | null;
  category: Tag | null; services: Tag[]; media: WorkMedia | null;
};
export type WorkList = { items: WorkCard[]; filters: Tag[] };

export type CaseSection = { id: string; type: string; eyebrow: string; title: string; body: string; config: CaseConfig };
export type Credit = { name: string; role: string; photo: string | null; profile: string | null };
export type CaseStudy = {
  project: WorkCard & {
    industry: string | null; timeline: string | null; intro: string | null;
    overview: string | null; challenge: string | null; approach: string | null; execution: string | null; result: string | null;
    seo: { title: string | null; description: string | null; canonical: string | null; ogImage: string | null; noindex: boolean };
  };
  gallery: WorkMedia[];
  sections: CaseSection[];
  credits: Credit[];
  next: { slug: string; title: string } | null;
  related: WorkCard[];
} | null;

type SB = ReturnType<typeof createClient<Database>>;
const MEDIA_TYPES = new Set(["image", "video", "vimeo"]);

export function client(): SB | null {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  return url && key ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export async function withPoster(m: WorkMedia | null): Promise<WorkMedia | null> {
  if (!m || m.type !== "vimeo" || m.poster) return m;
  const id = vimeoId(m.url);
  if (!id) return m;
  const { vimeoThumb } = await import("./vimeo.server");
  return { ...m, poster: await vimeoThumb(id) };
}

export type ProjRow = Pick<Database["public"]["Tables"]["portfolio_projects"]["Row"], "id" | "slug" | "title" | "client_name" | "project_year" | "category_id" | "cover_position" | "cover_type" | "cover_url" | "cover_poster_url" | "sort_order">;
export const PROJ_COLS = "id,slug,title,client_name,project_year,category_id,cover_position,cover_type,cover_url,cover_poster_url,sort_order";

/** Builds cards with category, services and cover media (published only — RLS + explicit filters). */
export async function buildCards(sb: SB, list: ProjRow[]): Promise<{ cards: WorkCard[]; links: { project_id: string; service_id: string }[] }> {
  const ids = list.map((p) => p.id);
  if (!ids.length) return { cards: [], links: [] };
  const catIds = [...new Set(list.map((p) => p.category_id).filter((x): x is string => !!x))];
  const [media, cats, links] = await Promise.all([
    sb.from("portfolio_media").select("project_id,media_type,url,poster_url,alt_text,orientation,sort_order").in("project_id", ids).order("sort_order"),
    catIds.length ? sb.from("portfolio_categories").select("id,name,slug").in("id", catIds).eq("status", "published") : null,
    sb.from("portfolio_project_services").select("project_id,service_id,sort_order").in("project_id", ids).order("sort_order"),
  ]);
  const svcIds = [...new Set((links.data ?? []).map((l) => l.service_id))];
  const svcs = svcIds.length ? (await sb.from("services").select("id,name,slug").in("id", svcIds).eq("status", "published")).data ?? [] : [];
  const svc = new Map(svcs.map((s) => [s.id, { slug: s.slug, name: s.name }]));
  const cat = new Map((cats?.data ?? []).map((c) => [c.id, { slug: c.slug, name: c.name }]));
  const cards = await Promise.all(list.map(async (p) => {
    const pm = (media.data ?? []).filter((m) => m.project_id === p.id);
    const match = pm.find((m) => m.url === p.cover_url);
    let m: WorkMedia | null = null;
    if (p.cover_url && p.cover_type && MEDIA_TYPES.has(p.cover_type)) {
      m = { type: p.cover_type as WorkMedia["type"], url: p.cover_url, poster: safeHttps(p.cover_poster_url) || match?.poster_url || null, alt: match?.alt_text || p.title, orientation: match?.orientation ?? "auto" };
    } else {
      const first = pm.find((x) => MEDIA_TYPES.has(x.media_type));
      if (first) m = { type: first.media_type as WorkMedia["type"], url: first.url, poster: first.poster_url, alt: first.alt_text || p.title, orientation: first.orientation };
    }
    return {
      id: p.id, slug: p.slug, title: p.title, client: p.client_name, year: p.project_year,
      category: p.category_id ? cat.get(p.category_id) ?? null : null,
      services: (links.data ?? []).filter((l) => l.project_id === p.id).map((l) => svc.get(l.service_id)).filter((x): x is Tag => !!x),
      media: m ? { ...(await withPoster(m))!, position: p.cover_position } : null,
    };
  }));
  return { cards, links: links.data ?? [] };
}

/** All published projects + filters derived only from tags that real published work uses. Never throws. */
export const getWorkList = createServerFn({ method: "GET" }).handler(async (): Promise<WorkList> => {
  const sb = client();
  if (!sb) return { items: [], filters: [] };
  try {
    const { data } = await sb.from("portfolio_projects").select(PROJ_COLS).eq("status", "published")
      .order("is_featured", { ascending: false }).order("sort_order").order("updated_at", { ascending: false });
    const { cards } = await buildCards(sb, data ?? []);
    const seen = new Map<string, Tag>();
    for (const c of cards) for (const t of [c.category, ...c.services]) if (t && !seen.has(t.slug)) seen.set(t.slug, t);
    return { items: cards, filters: [...seen.values()] };
  } catch {
    return { items: [], filters: [] };
  }
});

export const workListQuery = queryOptions({ queryKey: ["public", "work"], queryFn: () => getWorkList(), staleTime: 5 * 60 * 1000 });

/** One published case study by slug, with sections, credits, next and related work. Drafts/archived return null. */
export const getCaseStudy = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/) }).parse(d))
  .handler(async ({ data }): Promise<CaseStudy> => {
    const sb = client();
    if (!sb) return null;
    try {
      const { data: p } = await sb.from("portfolio_projects").select(`${PROJ_COLS},industry,timeline,short_description,overview,challenge,approach,execution,result,meta_title,meta_description,canonical_url,og_image_url,noindex`)
        .eq("slug", data.slug).eq("status", "published").maybeSingle();
      if (!p) return null;
      const [{ cards: [card] }, media, secs, team, all] = await Promise.all([
        buildCards(sb, [p]),
        sb.from("portfolio_media").select("media_type,url,poster_url,alt_text,orientation,sort_order").eq("project_id", p.id).order("sort_order"),
        sb.from("portfolio_case_sections").select("id,section_type,eyebrow,title,body,config").eq("project_id", p.id).eq("is_visible", true).order("sort_order"),
        sb.from("portfolio_project_team").select("member_name,role,photo_url,profile_url").eq("project_id", p.id).eq("is_visible", true).order("sort_order"),
        sb.from("portfolio_projects").select(PROJ_COLS).eq("status", "published").order("sort_order").order("updated_at", { ascending: false }),
      ]);
      const list = all.data ?? [];
      const idx = list.findIndex((x) => x.id === p.id);
      const nextRow = list.length > 1 ? list[(idx + 1) % list.length] : null;
      // Related: share category or a service.
      const others = list.filter((x) => x.id !== p.id);
      const { cards: otherCards } = await buildCards(sb, others.slice(0, 40));
      const tags = new Set([card?.category?.slug, ...(card?.services ?? []).map((s) => s.slug)].filter(Boolean));
      const related = otherCards.filter((c) => [c.category?.slug, ...c.services.map((s) => s.slug)].some((t) => t && tags.has(t))).slice(0, 3);
      const gallery = await Promise.all((media.data ?? []).filter((m) => MEDIA_TYPES.has(m.media_type))
        .map((m) => withPoster({ type: m.media_type as WorkMedia["type"], url: m.url, poster: m.poster_url, alt: m.alt_text || p.title, orientation: m.orientation })));
      return {
        project: {
          ...card!,
          industry: p.industry, timeline: p.timeline, intro: p.short_description,
          overview: p.overview, challenge: p.challenge, approach: p.approach, execution: p.execution, result: p.result,
          seo: { title: p.meta_title, description: p.meta_description, canonical: safeHttps(p.canonical_url) || null, ogImage: safeHttps(p.og_image_url) || null, noindex: p.noindex },
        },
        gallery: gallery.filter((g): g is WorkMedia => !!g),
        sections: (secs.data ?? []).map((s) => ({ id: s.id, type: s.section_type, eyebrow: s.eyebrow ?? "", title: s.title ?? "", body: s.body ?? "", config: parseCaseConfig(s.config, s.section_type) })),
        credits: (team.data ?? []).map((t) => ({ name: t.member_name, role: t.role, photo: safeHttps(t.photo_url) || null, profile: safeHttps(t.profile_url) || null })),
        next: nextRow && nextRow.id !== p.id ? { slug: nextRow.slug, title: nextRow.title } : null,
        related,
      };
    } catch {
      return null;
    }
  });

export const caseStudyQuery = (slug: string) =>
  queryOptions({ queryKey: ["public", "case-study", slug], queryFn: () => getCaseStudy({ data: { slug } }), staleTime: 5 * 60 * 1000 });
