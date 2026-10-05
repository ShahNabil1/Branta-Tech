import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { listPublishedPosts, type PostCard } from "./company.functions";
import { httpsUrl, maxItems, parseLogos, parseSteps, secondaryCta, type ClientLogo, type ProcessStep } from "./home-closing";
import { parseMediaItems, type SectionMediaItem } from "./section-media";
import { parsePlans, parseSnapshotItems, type PricingPlan } from "./home-engage";
import { parseStats, publicFundedBy, showLogos, type FundedBy, type TrustStat } from "./trust";

type Intro = { eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string };
export type HomeClosing = {
  process: (Intro & { steps: ProcessStep[]; media: SectionMediaItem | null }) | null;
  clients: (Intro & { logos: ClientLogo[] }) | null;
  insights: (Intro & { maxItems: number; posts: PostCard[] }) | null;
  careers: (Intro & { media: SectionMediaItem | null }) | null;
  finalCta: (Intro & { secondary: { label: string; url: string }; background: SectionMediaItem | null }) | null;
  /** trust_proof section; logos reuse the client_logos section data. */
  trust: (Intro & { logos: ClientLogo[]; stats: TrustStat[]; fundedBy: FundedBy | null }) | null;
  services: (Intro & { items: { label: string; description: string; url: string }[] }) | null;
  pricing: (Intro & { plans: PricingPlan[] }) | null;
  bookCall: (Intro & { secondary: { label: string; url: string } }) | null;
};
const EMPTY: HomeClosing = { process: null, clients: null, insights: null, careers: null, finalCta: null, trust: null, services: null, pricing: null, bookCall: null };
const TYPES = ["process", "client_logos", "insights_teaser", "careers_teaser", "final_cta", "trust_proof", "services_snapshot", "pricing", "book_call_cta"];

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
      process: p && steps.length ? { ...intro(p), steps, media: parseMediaItems(p.config, true, "4:3")[0] ?? null } : null,
      // No real logos yet → hide publicly (admin shows the empty state).
      clients: c && logos.length ? { ...intro(c), logos } : null,
      insights: i ? { ...intro(i), maxItems: maxItems(i.config), posts: await listPublishedPosts(maxItems(i.config)).catch(() => []) } : null,
      careers: k ? { ...intro(k), media: parseMediaItems(k.config, true, "4:3")[0] ?? (httpsUrl(k.media_url)
        ? { id: "legacy", type: "image", url: httpsUrl(k.media_url), poster_url: "", alt: k.title ?? "Branta team", label: "", caption: "", enabled: true, sort_order: 0, autoplay: false, muted: true, loop: false, aspect: "4:3", position: "center", priority: "auto", sound_control: true }
        : null) } : null,
      finalCta: f ? { ...intro(f), secondary: secondaryCta(f.config), background: parseMediaItems(f.config, true, "full")[0] ?? null } : null,
      trust: (() => {
        const t = get("trust_proof");
        if (!t) return null;
        const tl = showLogos(t.config) ? logos : [], stats = parseStats(t.config, true), fundedBy = publicFundedBy(t.config);
        return tl.length || stats.length || fundedBy ? { ...intro(t), logos: tl, stats, fundedBy } : null;
      })(),
      services: await (async () => {
        const s = get("services_snapshot");
        if (!s) return null;
        const items = parseSnapshotItems(s.config).filter((i) => i.enabled && i.label);
        const [sv, gr] = await Promise.all([
          sb.from("services").select("slug,short_description").eq("status", "published"),
          sb.from("service_groups").select("slug,short_description").eq("status", "published"),
        ]);
        const known = new Map([...(gr.data ?? []), ...(sv.data ?? [])].map((r) => [r.slug, r.short_description ?? ""]));
        const out = items.map((i) => ({ label: i.label, description: i.description || known.get(i.slug) || "", url: i.slug ? `/services/${i.slug}` : "" }));
        return out.length ? { ...intro(s), items: out } : null;
      })(),
      pricing: (() => {
        const s = get("pricing");
        const plans = s ? parsePlans(s.config).filter((p) => p.enabled && p.name) : [];
        return s && plans.length ? { ...intro(s), plans } : null;
      })(),
      bookCall: (() => {
        const s = get("book_call_cta");
        return s ? { ...intro(s), secondary: secondaryCta(s.config) } : null;
      })(),
    };
  } catch {
    return EMPTY;
  }
});

export const homeClosingQuery = queryOptions({ queryKey: ["public", "home-closing"], queryFn: () => getHomeClosing(), staleTime: 5 * 60 * 1000 });
