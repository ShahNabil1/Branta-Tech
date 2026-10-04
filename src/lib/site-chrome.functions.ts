import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type SiteChrome = {
  navigation: Json | null;
  brand: { logo_url?: string; logo_dark_url?: string } | null;
  contact: { email?: string; phone?: string; address?: string } | null;
  company: { company_name?: string; short_description?: string } | null;
  social: Partial<Record<"facebook" | "instagram" | "linkedin" | "youtube" | "x", string>> | null;
  featured: { title: string; slug: string; image: string; category: string | null } | null;
};

/**
 * Public, read-only data for the header: navigation + brand settings and one
 * featured project poster. Uses the publishable key (RLS applies as anon).
 * Never throws — the header falls back to defaults if anything fails.
 */
export const getSiteChrome = createServerFn({ method: "GET" }).handler(async (): Promise<SiteChrome> => {
  const empty: SiteChrome = { navigation: null, brand: null, contact: null, company: null, social: null, featured: null };
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return empty;
  const sb = createClient<Database>(url, key, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });
  try {
    const [settings, featured] = await Promise.all([
      sb.from("site_settings").select("setting_group,settings").in("setting_group", ["navigation", "brand", "contact", "company", "social"]),
      sb
        .from("portfolio_projects")
        .select("title,slug,cover_url,cover_type,portfolio_categories(name)")
        .eq("status", "published")
        .eq("is_featured", true)
        .eq("cover_type", "image")
        .not("cover_url", "is", null)
        .order("sort_order")
        .limit(1)
        .maybeSingle(),
    ]);
    const get = (g: string) => settings.data?.find((r) => r.setting_group === g)?.settings ?? null;
    const f = featured.data;
    return {
      navigation: get("navigation"),
      brand: get("brand") as SiteChrome["brand"],
      contact: get("contact") as SiteChrome["contact"],
      company: get("company") as SiteChrome["company"],
      social: get("social") as SiteChrome["social"],
      featured:
        f && f.cover_url && /^https:\/\//.test(f.cover_url)
          ? { title: f.title, slug: f.slug, image: f.cover_url, category: f.portfolio_categories?.name ?? null }
          : null,
    };
  } catch {
    return empty;
  }
});
