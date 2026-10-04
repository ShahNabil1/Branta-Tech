import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { vimeoId } from "./hero";

export type WebWork = { id: string; slug: string; title: string; client: string | null; image: string | null; alt: string; services: string[] };
export type WebSoftware = {
  eyebrow: string; title: string; body: string; statement: string; ctaLabel: string; ctaUrl: string;
  promoVimeo: string | null; promoPoster: string | null; capabilities: string[]; workHeading: string; work: WebWork[];
} | null;

export type WebConfig = { statement: string; promo_vimeo_url: string; promo_poster_url: string; capabilities: string[]; work_heading: string; max_items: number; project_ids: string[] };

const WEB_RE = /web|software|saas|website|e-?commerce|lms|crm|erp|pos|digital product|ui|ux/i;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseWebConfig(raw: unknown): WebConfig {
  const c = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    statement: str(c["statement"]),
    promo_vimeo_url: str(c["promo_vimeo_url"]),
    promo_poster_url: str(c["promo_poster_url"]),
    capabilities: arr(c["capabilities"]),
    work_heading: str(c["work_heading"]) || "Selected Digital Work",
    max_items: Math.min(6, Math.max(1, Number(c["max_items"]) || 4)),
    project_ids: arr(c["project_ids"]),
  };
}

/** Home "web_software_showcase" section + published projects linked to web/software services (or hand-picked IDs). Excludes the promo film itself. Never throws. */
export const getWebSoftware = createServerFn({ method: "GET" }).handler(async (): Promise<WebSoftware> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data: sec } = await sb.from("page_sections").select("eyebrow,title,body,cta_label,cta_url,config")
      .eq("page_id", page.data.id).eq("section_type", "web_software_showcase").eq("is_visible", true).order("sort_order").limit(1).maybeSingle();
    if (!sec) return null;
    const cfg = parseWebConfig(sec.config);
    const promoId = vimeoId(cfg.promo_vimeo_url);

    // Candidate projects: hand-picked, else those linked to web/software services.
    let ids = cfg.project_ids;
    const svcNames = new Map<string, string>();
    const links = (await sb.from("portfolio_project_services").select("project_id,service_id,sort_order").order("sort_order")).data ?? [];
    const svcIds = [...new Set(links.map((l) => l.service_id))];
    if (svcIds.length) {
      for (const s of (await sb.from("services").select("id,name").in("id", svcIds).eq("status", "published")).data ?? []) svcNames.set(s.id, s.name);
    }
    if (!ids.length) ids = [...new Set(links.filter((l) => WEB_RE.test(svcNames.get(l.service_id) ?? "")).map((l) => l.project_id))];

    let work: WebWork[] = [];
    if (ids.length) {
      const { data: projects } = await sb.from("portfolio_projects").select("id,slug,title,client_name,cover_type,cover_url,sort_order")
        .in("id", ids).eq("status", "published").order("sort_order");
      const pids = (projects ?? []).map((p) => p.id);
      const media = pids.length ? (await sb.from("portfolio_media").select("project_id,media_type,url,poster_url,alt_text,sort_order").in("project_id", pids).order("sort_order")).data ?? [] : [];
      work = (projects ?? [])
        .filter((p) => !(promoId && p.cover_url && vimeoId(p.cover_url) === promoId))
        .map((p) => {
          const pm = media.filter((m) => m.project_id === p.id);
          const img = p.cover_type === "image" && p.cover_url ? p.cover_url : pm.find((m) => m.media_type === "image")?.url ?? pm[0]?.poster_url ?? null;
          return {
            id: p.id, slug: p.slug, title: p.title, client: p.client_name, image: img, alt: pm[0]?.alt_text || p.title,
            services: links.filter((l) => l.project_id === p.id).map((l) => svcNames.get(l.service_id)).filter((x): x is string => !!x).slice(0, 3),
          };
        });
      if (cfg.project_ids.length) work.sort((a, b) => cfg.project_ids.indexOf(a.id) - cfg.project_ids.indexOf(b.id));
    }

    return {
      eyebrow: sec.eyebrow || "WEB & SOFTWARE",
      title: sec.title || "From Interface to Infrastructure.",
      body: sec.body || "",
      statement: cfg.statement,
      ctaLabel: sec.cta_label || "Explore Web & Software",
      ctaUrl: sec.cta_url || "/services/web-software",
      promoVimeo: promoId,
      promoPoster: /^https:\/\//.test(cfg.promo_poster_url) ? cfg.promo_poster_url : null,
      capabilities: cfg.capabilities,
      workHeading: cfg.work_heading,
      work: work.slice(0, cfg.max_items),
    };
  } catch {
    return null;
  }
});

export const webSoftwareQuery = queryOptions({ queryKey: ["public", "web-software"], queryFn: () => getWebSoftware(), staleTime: 5 * 60 * 1000 });
