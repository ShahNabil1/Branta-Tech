import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SITE_URL } from "@/lib/seo";
import { applicationWindow, parseDetails } from "@/lib/job-details";

const ALWAYS_PUBLIC = ["/", "/work", "/services", "/ai-studio", "/insights", "/start-a-project", "/book-a-call", "/pricing", "/privacy", "/terms"];
const CMS_PUBLIC = ["about", "team", "careers"] as const;
const validDate = (value: string | null | undefined) => {
  const date = value?.slice(0, 10);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
};
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Sitemap of published, indexable pages only (anon RLS = published rows only). */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = new Map<string, string | undefined>();
        const add = (path: string, updatedAt?: string | null) => {
          const loc = `${SITE_URL}${path}`;
          const lastmod = validDate(updatedAt);
          const previous = entries.get(loc);
          if (!entries.has(loc) || (lastmod && (!previous || lastmod > previous))) entries.set(loc, lastmod);
        };
        ALWAYS_PUBLIC.forEach((path) => add(path));
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (url && key) {
          try {
            const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
            const results = await Promise.all([
              sb.from("site_pages").select("slug,updated_at,noindex").in("slug", [...CMS_PUBLIC]).eq("status", "published"),
              sb.from("portfolio_projects").select("slug,updated_at,noindex").eq("status", "published"),
              sb.from("services").select("slug,updated_at,noindex").eq("status", "published"),
              sb.from("service_groups").select("slug,updated_at").eq("status", "published"),
              sb.from("posts").select("slug,updated_at,noindex").eq("status", "published"),
              sb.from("jobs").select("slug,updated_at,status,open_at,deadline_at,details").eq("status", "published"),
            ]);
            const names = ["site pages", "work", "services", "service groups", "insights", "careers"];
            results.forEach((result, index) => {
              if (result.error) console.error(`Sitemap ${names[index]} query failed:`, result.error.message);
            });
            const [pages, work, services, groups, posts, jobs] = results;
            (pages.data ?? []).filter((row) => !row.noindex && CMS_PUBLIC.includes(row.slug as typeof CMS_PUBLIC[number])).forEach((row) => add(`/${row.slug}`, row.updated_at));
            (work.data ?? []).filter((row) => !row.noindex).forEach((row) => add(`/work/${row.slug}`, row.updated_at));
            (groups.data ?? []).forEach((row) => add(`/services/${row.slug}`, row.updated_at));
            (services.data ?? []).filter((row) => !row.noindex).forEach((row) => add(`/services/${row.slug}`, row.updated_at));
            (posts.data ?? []).filter((row) => !row.noindex).forEach((row) => add(`/insights/${row.slug}`, row.updated_at));
            (jobs.data ?? []).filter((row) => applicationWindow(row, parseDetails(row.details)) === "open").forEach((row) => add(`/careers/${row.slug}`, row.updated_at));
          } catch (error) {
            console.error("Sitemap dynamic content failed; serving verified static URLs only.", error);
          }
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...entries]
          .map(([loc, lastmod]) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
          .join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
