import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { buildCards, client, PROJ_COLS, type ProjRow, type WorkCard } from "./work.functions";
import { parseGroupConfig, parseMedia, parseServiceConfig, type ServiceMedia, type ServicePageConfig } from "./services";
import { vimeoId } from "./hero";

export type ServiceLink = { slug: string; name: string; short: string | null };
export type GroupBlock = { slug: string; name: string; short: string | null; description: string | null; media: ServiceMedia | null; services: ServiceLink[] };

export type ServicePage =
  | {
      kind: "service";
      service: { slug: string; name: string; short: string | null; description: string | null; media: ServiceMedia | null; config: ServicePageConfig };
      group: { slug: string; name: string } | null;
      work: WorkCard[];
      related: ServiceLink[];
      seo: { title: string | null; description: string | null; canonical: string | null; ogImage: string | null; noindex: boolean };
    }
  | { kind: "group"; group: GroupBlock; work: WorkCard[] }
  | null;

export type StudioEntry = { id: string; kind: string; title: string; body: string; media: ServiceMedia | null; ratio: string; ctaLabel: string; ctaUrl: string };
export type AiStudio = { eyebrow: string; title: string; body: string; entries: StudioEntry[] };

async function poster(m: ServiceMedia | null): Promise<ServiceMedia | null> {
  if (!m || m.type !== "vimeo" || m.poster) return m;
  const id = vimeoId(m.url);
  if (!id) return m;
  const { vimeoThumb } = await import("./vimeo.server");
  return { ...m, poster: (await vimeoThumb(id)) ?? "" };
}

const SVC_COLS = "id,slug,name,short_description,sort_order,group_id";

/** All published groups with their published services. Never throws. */
export const getServicesIndex = createServerFn({ method: "GET" }).handler(async (): Promise<GroupBlock[]> => {
  const sb = client();
  if (!sb) return [];
  try {
    const [g, s] = await Promise.all([
      sb.from("service_groups").select("id,slug,name,short_description,description,config,sort_order").eq("status", "published").order("sort_order"),
      sb.from("services").select(SVC_COLS).eq("status", "published").order("sort_order"),
    ]);
    return Promise.all((g.data ?? []).map(async (x) => ({
      slug: x.slug, name: x.name, short: x.short_description, description: x.description,
      media: await poster(parseGroupConfig(x.config).media),
      services: (s.data ?? []).filter((v) => v.group_id === x.id).map((v) => ({ slug: v.slug, name: v.name, short: v.short_description })),
    })));
  } catch {
    return [];
  }
});

/** A published service by slug, else a published group by slug, else null. */
export const getServicePage = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }).parse(d))
  .handler(async ({ data }): Promise<ServicePage> => {
    const sb = client();
    if (!sb) return null;
    try {
      const { data: svc } = await sb.from("services").select("*").eq("slug", data.slug).eq("status", "published").maybeSingle();
      if (svc) {
        const config = parseServiceConfig(svc.page_config);
        const [grp, siblings, links] = await Promise.all([
          sb.from("service_groups").select("slug,name").eq("id", svc.group_id).eq("status", "published").maybeSingle(),
          sb.from("services").select(SVC_COLS).eq("group_id", svc.group_id).eq("status", "published").neq("id", svc.id).order("sort_order").limit(6),
          sb.from("portfolio_project_services").select("project_id,sort_order").eq("service_id", svc.id).order("sort_order"),
        ]);
        const linked = (links.data ?? []).map((l) => l.project_id);
        // Manual priority first (only if actually linked), then remaining links.
        const ids = [...config.project_ids.filter((i) => linked.includes(i)), ...linked.filter((i) => !config.project_ids.includes(i))].slice(0, 6);
        const work = await workFor(sb, ids);
        return {
          kind: "service",
          service: {
            slug: svc.slug, name: svc.name, short: svc.short_description, description: svc.description, config,
            media: await poster(parseMedia(svc.hero_media_type, svc.hero_media_url, svc.hero_poster_url, config.hero_alt || svc.name)),
          },
          group: grp.data ?? null,
          work,
          related: (siblings.data ?? []).map((v) => ({ slug: v.slug, name: v.name, short: v.short_description })),
          seo: { title: svc.meta_title, description: svc.meta_description, canonical: svc.canonical_url, ogImage: svc.og_image_url, noindex: svc.noindex },
        };
      }
      const { data: g } = await sb.from("service_groups").select("id,slug,name,short_description,description,config").eq("slug", data.slug).eq("status", "published").maybeSingle();
      if (!g) return null;
      const { data: svcs } = await sb.from("services").select(SVC_COLS).eq("group_id", g.id).eq("status", "published").order("sort_order");
      const svcIds = (svcs ?? []).map((v) => v.id);
      const links = svcIds.length ? (await sb.from("portfolio_project_services").select("project_id").in("service_id", svcIds)).data ?? [] : [];
      const work = await workFor(sb, [...new Set(links.map((l) => l.project_id))].slice(0, 6));
      return {
        kind: "group",
        group: {
          slug: g.slug, name: g.name, short: g.short_description, description: g.description,
          media: await poster(parseGroupConfig(g.config).media),
          services: (svcs ?? []).map((v) => ({ slug: v.slug, name: v.name, short: v.short_description })),
        },
        work,
      };
    } catch {
      return null;
    }
  });

async function workFor(sb: NonNullable<ReturnType<typeof client>>, ids: string[]): Promise<WorkCard[]> {
  if (!ids.length) return [];
  const { data } = await sb.from("portfolio_projects").select(PROJ_COLS).in("id", ids).eq("status", "published");
  const rows = ids.map((i) => (data ?? []).find((p) => p.id === i)).filter((p): p is ProjRow => !!p);
  return (await buildCards(sb, rows)).cards;
}

const STUDIO_RATIOS = new Set(["square", "portrait", "landscape", "wide"]);

/** AI Studio page (site_pages slug "ai-studio"): studio_hero + studio_entry sections. Never throws. */
export const getAiStudio = createServerFn({ method: "GET" }).handler(async (): Promise<AiStudio> => {
  const base: AiStudio = {
    eyebrow: "AI STUDIO",
    title: "Experiments Before They Become Services.",
    body: "A space for visual experiments, prototypes and AI-native ideas from the Branta team.",
    entries: [],
  };
  const sb = client();
  if (!sb) return base;
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "ai-studio").eq("status", "published").maybeSingle();
    if (!page.data) return base;
    const { data } = await sb.from("page_sections").select("id,section_type,eyebrow,title,body,media_url,media_type,cta_label,cta_url,config")
      .eq("page_id", page.data.id).eq("is_visible", true).in("section_type", ["studio_hero", "studio_entry"]).order("sort_order");
    const hero = (data ?? []).find((s) => s.section_type === "studio_hero");
    const entries = await Promise.all((data ?? []).filter((s) => s.section_type === "studio_entry").map(async (s): Promise<StudioEntry | null> => {
      const c = (s.config && typeof s.config === "object" && !Array.isArray(s.config) ? s.config : {}) as Record<string, unknown>;
      const media = await poster(parseMedia(s.media_type, s.media_url, c["poster_url"], c["alt"] ?? s.title));
      if (!media && !s.title) return null;
      const ratio = typeof c["ratio"] === "string" && STUDIO_RATIOS.has(c["ratio"]) ? c["ratio"] : "auto";
      return {
        id: s.id, kind: (s.eyebrow ?? "").slice(0, 60), title: s.title ?? "", body: s.body ?? "", media, ratio,
        ctaLabel: s.cta_label ?? "", ctaUrl: s.cta_url ?? "",
      };
    }));
    return {
      eyebrow: hero?.eyebrow || base.eyebrow,
      title: hero?.title || base.title,
      body: hero?.body || base.body,
      entries: entries.filter((e): e is StudioEntry => !!e),
    };
  } catch {
    return base;
  }
});

export const servicesIndexQuery = queryOptions({ queryKey: ["public", "services"], queryFn: () => getServicesIndex(), staleTime: 5 * 60 * 1000 });
export const servicePageQuery = (slug: string) =>
  queryOptions({ queryKey: ["public", "service", slug], queryFn: () => getServicePage({ data: { slug } }), staleTime: 5 * 60 * 1000 });
export const aiStudioQuery = queryOptions({ queryKey: ["public", "ai-studio"], queryFn: () => getAiStudio(), staleTime: 5 * 60 * 1000 });
