import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { publicItems, type PricingContentItem } from "./pricing-page";
import { getPublicPricing } from "./pricing.functions";
import type { WorkCard } from "./work.functions";

type Block = { eyebrow: string; title: string; body: string; items: PricingContentItem[] } | null;
export type PricingPageContent = { included: Block; faq: Block; notes: Block; work: WorkCard[] };

const WORK_CATEGORY_HINT = /(commercial|motion|ugc|product|tvc|ovc|film|video)/i;

/** CMS sections of the "pricing" site page + related published portfolio cards. Anon RLS, never throws. */
export const getPricingContent = createServerFn({ method: "GET" }).handler(async (): Promise<PricingPageContent> => {
  const empty: PricingPageContent = { included: null, faq: null, notes: null, work: [] };
  const { client, buildCards, PROJ_COLS } = await import("./work.functions");
  const sb = client();
  if (!sb) return empty;
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "pricing").eq("status", "published").maybeSingle();
    const secs = page.data
      ? (await sb.from("page_sections").select("section_type,eyebrow,title,body,config").eq("page_id", page.data.id).eq("is_visible", true).in("section_type", ["pricing_included", "pricing_faq", "pricing_notes"]).order("sort_order")).data ?? []
      : [];
    const block = (t: string): Block => {
      const s = secs.find((x) => x.section_type === t);
      const items = s ? publicItems(s.config) : [];
      return s && items.length ? { eyebrow: s.eyebrow ?? "", title: s.title ?? "", body: s.body ?? "", items } : null;
    };
    const [{ data: projects }, { data: cats }] = await Promise.all([
      sb.from("portfolio_projects").select(`${PROJ_COLS},is_featured`).eq("status", "published").order("is_featured", { ascending: false }).order("sort_order").limit(60),
      sb.from("portfolio_categories").select("id,name,homepage_group").eq("status", "published"),
    ]);
    const videoCats = new Set((cats ?? []).filter((c) => WORK_CATEGORY_HINT.test(`${c.name} ${c.homepage_group ?? ""}`)).map((c) => c.id));
    const picked = (projects ?? []).filter((p) => p.category_id && videoCats.has(p.category_id)).slice(0, 6);
    const { cards } = await buildCards(sb, picked);
    return { included: block("pricing_included"), faq: block("pricing_faq"), notes: block("pricing_notes"), work: cards };
  } catch {
    return empty;
  }
});

export const pricingContentQuery = queryOptions({ queryKey: ["public", "pricing-content"], queryFn: () => getPricingContent(), staleTime: 5 * 60 * 1000 });
export const publicPricingQuery = queryOptions({ queryKey: ["public", "pricing"], queryFn: () => getPublicPricing(), staleTime: 60 * 1000 });
