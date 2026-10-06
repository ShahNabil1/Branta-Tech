import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SITE_URL } from "@/lib/seo";

const STATIC = ["/", "/work", "/services", "/ai-studio", "/insights", "/about", "/team", "/careers", "/start-a-project", "/book-a-call", "/pricing"];

/** Sitemap of published, indexable pages only (anon RLS = published rows only). */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls: Array<{ loc: string; lastmod?: string | undefined }> = STATIC.map((p) => ({ loc: `${SITE_URL}${p}` }));
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (url && key) {
          const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
          const [work, svc, grp, posts, jobs] = await Promise.all([
            sb.from("portfolio_projects").select("slug,updated_at,noindex").eq("status", "published"),
            sb.from("services").select("slug,updated_at,noindex").eq("status", "published"),
            sb.from("service_groups").select("slug,updated_at").eq("status", "published"),
            sb.from("posts").select("slug,updated_at,noindex").eq("status", "published"),
            sb.from("jobs").select("slug,updated_at").eq("status", "published"),
          ]);
          const add = (base: string, rows: Array<{ slug: string; updated_at?: string | null; noindex?: boolean | null }> | null) =>
            (rows ?? []).filter((r) => !r.noindex && r.slug).forEach((r) => urls.push({ loc: `${SITE_URL}${base}${r.slug}`, lastmod: r.updated_at?.slice(0, 10) }));
          add("/work/", work.data);
          add("/services/", grp.data);
          add("/services/", svc.data);
          add("/insights/", posts.data);
          add("/careers/", jobs.data);
        }
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
          .join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
