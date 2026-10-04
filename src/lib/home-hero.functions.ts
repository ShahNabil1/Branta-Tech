import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import type { HeroSectionRow } from "./hero";

/** Reads the visible hero section of the published Home page (anon RLS). Never throws. */
export const getHomeHero = createServerFn({ method: "GET" }).handler(async (): Promise<HeroSectionRow | null> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data } = await sb
      .from("page_sections")
      .select("eyebrow,title,body,cta_label,cta_url,config")
      .eq("page_id", page.data.id)
      .eq("section_type", "hero")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
});

export const homeHeroQuery = queryOptions({
  queryKey: ["public", "home-hero"],
  queryFn: () => getHomeHero(),
  staleTime: 5 * 60 * 1000,
});
