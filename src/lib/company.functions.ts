import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { isHttps, parseBlocks, type Block } from "./rich-text";
import { toPublicJob, type JobRowLike, type PublicJob } from "./job-details";

/** Public reads for Insights, About, Team and Careers — publishable key, anon RLS (published only). */
function pub() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  return url && key ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
const img = (u: string | null | undefined) => (u && isHttps(u) ? u.trim() : null);

export type Author = { name: string; role: string | null; photo: string | null; bio: string | null; profileUrl: string | null };
export type PostCard = {
  slug: string; title: string; excerpt: string | null; category: string | null; cover: string | null; coverAlt: string;
  publishedAt: string | null; featured: boolean; author: Author | null;
};
export type Post = PostCard & {
  blocks: Block[];
  seo: { title: string | null; description: string | null; canonical: string | null; ogImage: string | null; noindex: boolean };
};

const POST_COLS = "slug,title,excerpt,category,cover_url,cover_alt,published_at,featured,authors(name,role,photo_url,bio,profile_url,is_active)";
type PostRow = {
  slug: string; title: string; excerpt: string | null; category: string | null; cover_url: string | null; cover_alt: string | null;
  published_at: string | null; featured: boolean;
  authors: { name: string; role: string | null; photo_url: string | null; bio: string | null; profile_url: string | null; is_active: boolean } | null;
};
function toCard(r: PostRow): PostCard {
  const a = r.authors && r.authors.is_active ? r.authors : null;
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt, category: r.category, cover: img(r.cover_url), coverAlt: r.cover_alt || r.title,
    publishedAt: r.published_at, featured: r.featured,
    author: a ? { name: a.name, role: a.role, photo: img(a.photo_url), bio: a.bio, profileUrl: a.profile_url && /^https?:\/\//.test(a.profile_url) ? a.profile_url : null } : null,
  };
}

export const getInsights = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number } | undefined) => z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}))
  .handler(({ data }) => listPublishedPosts(data.limit ?? 60));

/** Server-only helper (call from server handlers, not the browser). Featured first, then newest. */
export async function listPublishedPosts(limit: number): Promise<PostCard[]> {
  const sb = pub();
  if (!sb) return [];
  const { data: rows } = await sb.from("posts").select(POST_COLS).eq("status", "published")
    .order("featured", { ascending: false }).order("published_at", { ascending: false, nullsFirst: false }).order("sort_order").limit(limit);
  return ((rows ?? []) as unknown as PostRow[]).map(toCard);
}

export const getPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<{ post: Post | null; related: PostCard[] }> => {
    const sb = pub();
    if (!sb) return { post: null, related: [] };
    const { data: r } = await sb.from("posts").select(`${POST_COLS},content_json,meta_title,meta_description,canonical_url,og_image_url,noindex`)
      .eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!r) return { post: null, related: [] };
    const row = r as unknown as PostRow & { content_json: unknown; meta_title: string | null; meta_description: string | null; canonical_url: string | null; og_image_url: string | null; noindex: boolean };
    const { data: more } = await sb.from("posts").select(POST_COLS).eq("status", "published").neq("slug", data.slug)
      .order("published_at", { ascending: false, nullsFirst: false }).limit(3);
    return {
      post: {
        ...toCard(row), blocks: parseBlocks(row.content_json),
        seo: { title: row.meta_title, description: row.meta_description, canonical: row.canonical_url && /^https:\/\//.test(row.canonical_url) ? row.canonical_url : null, ogImage: img(row.og_image_url), noindex: row.noindex },
      },
      related: ((more ?? []) as unknown as PostRow[]).map(toCard),
    };
  });

export type TeamMember = {
  id: string; name: string; role: string | null; photo: string | null; shortBio: string | null; fullBio: string | null; linkedin: string | null; featured: boolean;
  department: string | null; level: number; managerId: string | null;
};
export const getTeam = createServerFn({ method: "GET" }).handler(async (): Promise<TeamMember[]> => {
  const sb = pub();
  if (!sb) return [];
  const { data } = await sb.from("team_members").select("id,name,role,photo_url,short_bio,full_bio,linkedin_url,featured,department,leadership_level,manager_id")
    .eq("status", "published").order("leadership_level").order("sort_order").order("name");
  return (data ?? []).map((m) => ({
    id: m.id, name: m.name, role: m.role, photo: img(m.photo_url), shortBio: m.short_bio, fullBio: m.full_bio,
    linkedin: m.linkedin_url && /^https:\/\/(www\.)?linkedin\.com\//.test(m.linkedin_url) ? m.linkedin_url : null, featured: m.featured,
    department: m.department?.trim() || null, level: m.leadership_level, managerId: m.manager_id,
  }));
});

/** CMS sections of a company page (about/team/careers). A "hero" section overrides the default hero copy. */
export type CompanySection = { id: string; type: string; eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string; media: string | null };
export type CompanyPage = { hero: CompanySection | null; sections: CompanySection[]; seo: { title: string | null; description: string | null; ogImage: string | null; noindex: boolean } };
export const getCompanyPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.enum(["about", "team", "careers"]) }).parse(d))
  .handler(async ({ data }): Promise<CompanyPage> => {
    const empty: CompanyPage = { hero: null, sections: [], seo: { title: null, description: null, ogImage: null, noindex: false } };
    const sb = pub();
    if (!sb) return empty;
    const { data: page } = await sb.from("site_pages").select("id,meta_title,meta_description,og_image_url,noindex").eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!page) return empty;
    const { data: rows } = await sb.from("page_sections").select("id,section_type,eyebrow,title,body,cta_label,cta_url,media_url,media_type")
      .eq("page_id", page.id).eq("is_visible", true).order("sort_order");
    const all = (rows ?? []).map((s) => ({
      id: s.id, type: s.section_type, eyebrow: s.eyebrow ?? "", title: s.title ?? "", body: s.body ?? "", ctaLabel: s.cta_label ?? "", ctaUrl: s.cta_url ?? "",
      media: s.media_type === "image" || !s.media_type ? img(s.media_url) : null,
    }));
    return {
      hero: all.find((s) => s.type === "hero") ?? null,
      sections: all.filter((s) => s.type !== "hero" && (s.title || s.body)),
      seo: { title: page.meta_title, description: page.meta_description, ogImage: img(page.og_image_url), noindex: page.noindex },
    };
  });

export type JobCard = Pick<PublicJob, "slug" | "title" | "department" | "type" | "location" | "workMode" | "summary" | "featured" | "urgent" | "deadlineAt" | "salary" | "window" | "vacancies">;
export type Job = PublicJob;
const JOB_COLS = "slug,title,department,employment_type,location,work_mode,summary,featured,urgent,vacancies,job_code,open_at,deadline_at,published_at,details,status";
export const isInternship = (j: { type: string | null }) => /intern/i.test(j.type ?? "");

export const getJobs = createServerFn({ method: "GET" }).handler(async (): Promise<JobCard[]> => {
  const sb = pub();
  if (!sb) return [];
  const { data } = await sb.from("jobs").select(JOB_COLS).eq("status", "published").order("featured", { ascending: false }).order("sort_order").order("published_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map((r) => {
    const j = toPublicJob(r as JobRowLike);
    // "Auto close" jobs drop off the listing once the deadline passes.
    const hide = j.window === "closed" && j.details.application.after_deadline === "auto_close";
    return hide ? null : { slug: j.slug, title: j.title, department: j.department, type: j.type, location: j.location, workMode: j.workMode, summary: j.summary, featured: j.featured, urgent: j.urgent, deadlineAt: j.deadlineAt, salary: j.salary, window: j.window, vacancies: j.vacancies };
  }).filter((x): x is JobCard => !!x);
});

/** Published job by slug; an old slug of a published job resolves to { redirect }. */
export const getJob = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<Job | { redirect: string } | null> => {
    const sb = pub();
    if (!sb) return null;
    const { data: j } = await sb.from("jobs").select(`${JOB_COLS},description_json,requirements_json,seo`).eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (j) return toPublicJob(j as JobRowLike);
    const { data: r } = await sb.from("job_slug_redirects" as never).select("job_id").eq("old_slug", data.slug).maybeSingle();
    const jobId = (r as { job_id: string } | null)?.job_id;
    if (!jobId) return null;
    const { data: target } = await sb.from("jobs").select("slug").eq("id", jobId).eq("status", "published").maybeSingle();
    return target ? { redirect: target.slug } : null;
  });

const FIVE = 5 * 60_000;
export const insightsQuery = queryOptions({ queryKey: ["public", "insights"], queryFn: () => getInsights({ data: {} }), staleTime: FIVE });
export const postQuery = (slug: string) => queryOptions({ queryKey: ["public", "post", slug], queryFn: () => getPost({ data: { slug } }), staleTime: FIVE });
export const teamQuery = queryOptions({ queryKey: ["public", "team"], queryFn: () => getTeam(), staleTime: FIVE });
export const companyPageQuery = (slug: "about" | "team" | "careers") => queryOptions({ queryKey: ["public", "company-page", slug], queryFn: () => getCompanyPage({ data: { slug } }), staleTime: FIVE });
export const jobsQuery = queryOptions({ queryKey: ["public", "jobs"], queryFn: () => getJobs(), staleTime: 30_000 });
export const jobQuery = (slug: string) => queryOptions({ queryKey: ["public", "job", slug], queryFn: () => getJob({ data: { slug } }), staleTime: 30_000 });

export function formatPostDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
}
