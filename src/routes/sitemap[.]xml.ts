import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SITE_URL } from "@/lib/seo";
import { applicationWindow, parseDetails } from "@/lib/job-details";

const ALWAYS_PUBLIC = ["/", "/work", "/services", "/ai-studio", "/insights", "/start-a-project", "/book-a-call", "/pricing", "/privacy", "/terms"];
const CMS_PUBLIC = ["about", "team", "careers"] as const;
const PAGE_SIZE = 1000;
const validDate = (value: string | null | undefined) => {
  const date = value?.slice(0, 10);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
};
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

async function allRows<T>(label: string, fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await fetchPage(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

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
            const [pages, work, services, groups, posts, jobs] = await Promise.all([
              allRows("site pages", (from, to) => sb.from("site_pages").select("slug,updated_at,noindex").in("slug", [...CMS_PUBLIC]).eq("status", "published").range(from, to)),
              allRows("work", (from, to) => sb.from("portfolio_projects").select("slug,updated_at,noindex").eq("status", "published").range(from, to)),
              allRows("services", (from, to) => sb.from("services").select("slug,updated_at,noindex").eq("status", "published").range(from, to)),
              allRows("service groups", (from, to) => sb.from("service_groups").select("slug,updated_at").eq("status", "published").range(from, to)),
              allRows("insights", (from, to) => sb.from("posts").select("slug,updated_at,noindex").eq("status", "published").range(from, to)),
              allRows("careers", (from, to) => sb.from("jobs").select("slug,updated_at,status,open_at,deadline_at,details").eq("status", "published").range(from, to)),
            ]);
            pages.filter((row) => CMS_PUBLIC.includes(row.slug as typeof CMS_PUBLIC[number])).forEach((row) => {
              if (row.noindex) entries.delete(`${SITE_URL}/${row.slug}`);
              else add(`/${row.slug}`, row.updated_at);
            });
            work.filter((row) => !row.noindex).forEach((row) => add(`/work/${row.slug}`, row.updated_at));
            groups.forEach((row) => add(`/services/${row.slug}`, row.updated_at));
            services.filter((row) => !row.noindex).forEach((row) => add(`/services/${row.slug}`, row.updated_at));
            posts.filter((row) => !row.noindex).forEach((row) => add(`/insights/${row.slug}`, row.updated_at));
            jobs.filter((row) => applicationWindow(row, parseDetails(row.details)) === "open").forEach((row) => add(`/careers/${row.slug}`, row.updated_at));
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
