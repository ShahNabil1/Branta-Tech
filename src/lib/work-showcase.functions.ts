import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import type { WorkCard } from "./work.functions";
import { HOME_GROUPS, parseShowcaseConfig, type HomeGroupKey, type Tone } from "./work-showcase";

export type ShowcaseRow = { key: string; label: string; description: string; tone: Tone; exploreUrl: string; items: WorkCard[] };
export type WorkShowcase = {
  eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string;
  speed: number; hoverPreview: boolean; showJumpNav: boolean;
  featured: WorkCard[];
  groups: ShowcaseRow[];
} | null;

/** Homepage Work Showcase: published featured projects + one row per homepage group from portfolio_categories. Anon RLS, never throws. */
export const getWorkShowcase = createServerFn({ method: "GET" }).handler(async (): Promise<WorkShowcase> => {
  const { client, buildCards, PROJ_COLS } = await import("./work.functions");
  const sb = client();
  if (!sb) return null;
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data: sec } = await sb.from("page_sections").select("eyebrow,title,body,cta_label,cta_url,config")
      .eq("page_id", page.data.id).eq("section_type", "work_showcase").eq("is_visible", true).order("sort_order").limit(1).maybeSingle();
    if (!sec) return null;
    const cfg = parseShowcaseConfig(sec.config);
    const [{ data: projects }, { data: cats }] = await Promise.all([
      sb.from("portfolio_projects").select(`${PROJ_COLS},is_featured`).eq("status", "published")
        .order("sort_order").order("updated_at", { ascending: false }).limit(200),
      sb.from("portfolio_categories").select("id,slug,homepage_group,show_on_homepage,sort_order").eq("status", "published").order("sort_order"),
    ]);
    const list = projects ?? [];
    const { cards } = await buildCards(sb, list);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const featured = list.filter((p) => p.is_featured).slice(0, cfg.maxFeatured).map((p) => byId.get(p.id)).filter((c): c is WorkCard => !!c);
    const catGroup = new Map<string, { group: HomeGroupKey; slug: string }>();
    for (const c of cats ?? []) {
      if (!c.show_on_homepage || !c.homepage_group) continue;
      if (HOME_GROUPS.some((g) => g.key === c.homepage_group)) catGroup.set(c.id, { group: c.homepage_group as HomeGroupKey, slug: c.slug });
    }
    const groups: ShowcaseRow[] = [];
    for (const key of cfg.groupOrder) {
      const meta = HOME_GROUPS.find((g) => g.key === key)!;
      const slugs = [...catGroup.values()].filter((v) => v.group === key).map((v) => v.slug);
      const items = list.filter((p) => p.category_id && catGroup.get(p.category_id)?.group === key).map((p) => byId.get(p.id)).filter((c): c is WorkCard => !!c).slice(0, 16);
      if (!items.length) continue;
      groups.push({
        key, label: meta.label, tone: meta.tone, description: cfg.descriptions[key] ?? meta.description, items,
        exploreUrl: slugs.length === 1 ? `/work?filter=${slugs[0]}` : "/work",
      });
    }
    return {
      eyebrow: sec.eyebrow || "FEATURED WORK", title: sec.title || "Work We’re Proud Of.",
      body: sec.body || "", ctaLabel: sec.cta_label || "Explore All Work", ctaUrl: sec.cta_url || "/work",
      speed: cfg.speed, hoverPreview: cfg.hoverPreview, showJumpNav: cfg.showJumpNav, featured, groups,
    };
  } catch {
    return null;
  }
});

export const workShowcaseQuery = queryOptions({ queryKey: ["public", "work-showcase"], queryFn: () => getWorkShowcase(), staleTime: 5 * 60 * 1000 });
