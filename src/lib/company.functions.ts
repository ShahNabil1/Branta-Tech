import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { isHttps, parseBlocks, type Block } from "./rich-text";

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

export type TeamMember = { id: string; name: string; role: string | null; photo: string | null; shortBio: string | null; fullBio: string | null; linkedin: string | null; featured: boolean };
export const getTeam = createServerFn({ method: "GET" }).handler(async (): Promise<TeamMember[]> => {
  const sb = pub();
  if (!sb) return [];
  const { data } = await sb.from("team_members").select("id,name,role,photo_url,short_bio,full_bio,linkedin_url,featured").eq("status", "published").order("sort_order").order("name");
  return (data ?? []).map((m) => ({
    id: m.id, name: m.name, role: m.role, photo: img(m.photo_url), shortBio: m.short_bio, fullBio: m.full_bio,
    linkedin: m.linkedin_url && /^https:\/\/(www\.)?linkedin\.com\//.test(m.linkedin_url) ? m.linkedin_url : null, featured: m.featured,
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

export type JobCard = { slug: string; title: string; department: string | null; type: string | null; location: string | null; workMode: string | null; summary: string | null; featured: boolean };
export type Job = JobCard & { blocks: Block[]; requirements: string[]; publishedAt: string | null };
const JOB_COLS = "slug,title,department,employment_type,location,work_mode,summary,featured";
type JobRow = { slug: string; title: string; department: string | null; employment_type: string | null; location: string | null; work_mode: string | null; summary: string | null; featured: boolean };
const toJob = (j: JobRow): JobCard => ({ slug: j.slug, title: j.title, department: j.department, type: j.employment_type, location: j.location, workMode: j.work_mode, summary: j.summary, featured: j.featured });
export const isInternship = (j: { type: string | null }) => /intern/i.test(j.type ?? "");

export const getJobs = createServerFn({ method: "GET" }).handler(async (): Promise<JobCard[]> => {
  const sb = pub();
  if (!sb) return [];
  const { data } = await sb.from("jobs").select(JOB_COLS).eq("status", "published").order("featured", { ascending: false }).order("sort_order").order("published_at", { ascending: false });
  return (data ?? []).map(toJob);
});

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<Job | null> => {
    const sb = pub();
    if (!sb) return null;
    const { data: j } = await sb.from("jobs").select(`${JOB_COLS},description_json,requirements_json,published_at`).eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!j) return null;
    const reqs = Array.isArray(j.requirements_json) ? j.requirements_json.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
    return { ...toJob(j), blocks: parseBlocks(j.description_json), requirements: reqs, publishedAt: j.published_at };
  });

const FIVE = 5 * 60_000;
export const insightsQuery = queryOptions({ queryKey: ["public", "insights"], queryFn: () => getInsights({ data: {} }), staleTime: FIVE });
export const postQuery = (slug: string) => queryOptions({ queryKey: ["public", "post", slug], queryFn: () => getPost({ data: { slug } }), staleTime: FIVE });
export const teamQuery = queryOptions({ queryKey: ["public", "team"], queryFn: () => getTeam(), staleTime: FIVE });
export const companyPageQuery = (slug: "about" | "team" | "careers") => queryOptions({ queryKey: ["public", "company-page", slug], queryFn: () => getCompanyPage({ data: { slug } }), staleTime: FIVE });
export const jobsQuery = queryOptions({ queryKey: ["public", "jobs"], queryFn: () => getJobs(), staleTime: FIVE });
export const jobQuery = (slug: string) => queryOptions({ queryKey: ["public", "job", slug], queryFn: () => getJob({ data: { slug } }), staleTime: FIVE });

export function formatPostDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
}
