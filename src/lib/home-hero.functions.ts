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
    if (!data) return null;
    // Fill missing Vimeo posters from Vimeo's public thumbnail metadata (server-side, cached).
    const cfg = data.config && typeof data.config === "object" && !Array.isArray(data.config) ? { ...(data.config as Record<string, unknown>) } : null;
    const items = cfg && Array.isArray(cfg["media_items"]) ? (cfg["media_items"] as Record<string, unknown>[]) : null;
    if (cfg && items) {
      const { vimeoId } = await import("./hero");
      const { vimeoThumb } = await import("./vimeo.server");
      cfg["media_items"] = await Promise.all(items.map(async (m) => {
        if (!m || typeof m !== "object") return m;
        const id = typeof m["url"] === "string" ? vimeoId(m["url"]) : null;
        const poster = typeof m["poster_url"] === "string" ? m["poster_url"] : "";
        const posterOk = /^https:\/\/|^\/(?!\/)/.test(poster) && !vimeoId(poster) && !/\.(mp4|webm|m4v|mov)(\?|$)/i.test(poster);
        if (!id || posterOk) return m;
        return { ...m, poster_url: (await vimeoThumb(id)) ?? "" };
      }));
      return { ...data, config: cfg as typeof data.config };
    }
    return data;
  } catch {
    return null;
  }
});

export const homeHeroQuery = queryOptions({
  queryKey: ["public", "home-hero"],
  queryFn: () => getHomeHero(),
  staleTime: 5 * 60 * 1000,
});
