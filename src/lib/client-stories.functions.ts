import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

export type Story = {
  id: string; name: string; role: string | null; company: string | null; photo: string | null; quote: string | null;
  service: string | null; projectSlug: string | null;
  video: { kind: "vimeo" | "video"; url: string; poster: string | null } | null;
};
export type ClientStories = {
  eyebrow: string; title: string; body: string; videoEyebrow: string; videoBody: string; speed: number;
  text: Story[]; videos: Story[];
} | null;

const https = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : null);

/** Homepage Client Stories: published testimonials only (anon RLS). Hidden entirely when there are none. */
export const getClientStories = createServerFn({ method: "GET" }).handler(async (): Promise<ClientStories> => {
  const { client, withPoster } = await import("./work.functions");
  const sb = client();
  if (!sb) return null;
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data: sec } = await sb.from("page_sections").select("eyebrow,title,body,config")
      .eq("page_id", page.data.id).eq("section_type", "client_stories").eq("is_visible", true).order("sort_order").limit(1).maybeSingle();
    if (!sec) return null;
    const { data: rows } = await sb.from("testimonials").select("*").eq("status", "published")
      .order("featured", { ascending: false }).order("sort_order").limit(60);
    const list = rows ?? [];
    const pids = [...new Set(list.map((r) => r.project_id).filter((x): x is string => !!x))];
    const slugs = new Map<string, string>();
    if (pids.length) {
      const { data: ps } = await sb.from("portfolio_projects").select("id,slug").in("id", pids).eq("status", "published");
      for (const p of ps ?? []) slugs.set(p.id, p.slug);
    }
    const stories = await Promise.all(list.map(async (r): Promise<Story & { kind: string }> => {
      let video: Story["video"] = null;
      const vt = r.video_type === "vimeo" || r.video_type === "video" ? r.video_type : null;
      if (r.kind === "video" && vt && r.video_url && (vt === "vimeo" || https(r.video_url))) {
        const m = await withPoster({ type: vt, url: r.video_url, poster: https(r.video_poster_url) ?? https(r.photo_url), alt: r.client_name } as never);
        video = { kind: vt, url: r.video_url, poster: (m as { poster?: string | null } | null)?.poster ?? null };
      }
      return {
        kind: r.kind, id: r.id, name: r.client_name, role: r.client_role, company: r.company, photo: https(r.photo_url),
        quote: r.quote, service: r.service_label, projectSlug: r.project_id ? slugs.get(r.project_id) ?? null : null, video,
      };
    }));
    const text = stories.filter((s) => s.kind === "text" && s.quote?.trim());
    const videos = stories.filter((s) => s.kind === "video" && s.video);
    if (!text.length && !videos.length) return null;
    const cfg = (sec.config ?? {}) as Record<string, unknown>;
    const str = (k: string, d: string) => (typeof cfg[k] === "string" ? (cfg[k] as string) : d);
    const speed = Number(cfg["speed"]);
    return {
      eyebrow: sec.eyebrow || "CLIENT STORIES", title: sec.title || "What People Say About Working With Branta.", body: sec.body || "",
      videoEyebrow: str("video_eyebrow", "VIDEO STORIES"), videoBody: str("video_body", ""),
      speed: Number.isFinite(speed) && speed >= 20 && speed <= 120 ? speed : 48, text, videos,
    };
  } catch {
    return null;
  }
});

export const clientStoriesQuery = queryOptions({ queryKey: ["public", "client-stories"], queryFn: () => getClientStories(), staleTime: 5 * 60 * 1000 });
