import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { httpsUrl, maxItems, parseLogos, parseSteps, secondaryCta, type ClientLogo, type ProcessStep } from "./home-closing";

type Intro = { eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string };
export type HomeClosing = {
  process: (Intro & { steps: ProcessStep[] }) | null;
  clients: (Intro & { logos: ClientLogo[] }) | null;
  insights: (Intro & { maxItems: number }) | null;
  careers: (Intro & { image: string | null; imageAlt: string }) | null;
  finalCta: (Intro & { secondary: { label: string; url: string } }) | null;
};
const EMPTY: HomeClosing = { process: null, clients: null, insights: null, careers: null, finalCta: null };
const TYPES = ["process", "client_logos", "insights_teaser", "careers_teaser", "final_cta"];

/** Closing homepage sections in one read (publishable key, anon RLS). Never throws. */
export const getHomeClosing = createServerFn({ method: "GET" }).handler(async (): Promise<HomeClosing> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return EMPTY;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return EMPTY;
    const { data } = await sb.from("page_sections").select("section_type,eyebrow,title,body,cta_label,cta_url,media_url,config")
      .eq("page_id", page.data.id).in("section_type", TYPES).eq("is_visible", true).order("sort_order");
    const get = (t: string) => (data ?? []).find((s) => s.section_type === t);
    const intro = (s: NonNullable<ReturnType<typeof get>>): Intro => ({
      eyebrow: s.eyebrow ?? "", title: s.title ?? "", body: s.body ?? "", ctaLabel: s.cta_label ?? "", ctaUrl: s.cta_url ?? "",
    });
    const p = get("process"), c = get("client_logos"), i = get("insights_teaser"), k = get("careers_teaser"), f = get("final_cta");
    const steps = p ? parseSteps(p.config) : [];
    const logos = c ? parseLogos(c.config, true) : [];
    return {
      process: p && steps.length ? { ...intro(p), steps } : null,
      // No real logos yet → hide publicly (admin shows the empty state).
      clients: c && logos.length ? { ...intro(c), logos } : null,
      insights: i ? { ...intro(i), maxItems: maxItems(i.config) } : null,
      careers: k ? { ...intro(k), image: httpsUrl(k.media_url) || null, imageAlt: k.title ?? "Branta team" } : null,
      finalCta: f ? { ...intro(f), secondary: secondaryCta(f.config) } : null,
    };
  } catch {
    return EMPTY;
  }
});

export const homeClosingQuery = queryOptions({ queryKey: ["public", "home-closing"], queryFn: () => getHomeClosing(), staleTime: 5 * 60 * 1000 });
