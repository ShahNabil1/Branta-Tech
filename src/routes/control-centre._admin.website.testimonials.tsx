import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, FeaturedBadge, PageHeader, SelectInput, StatusBadge, STATUS_OPTIONS, TextArea, TextInput, friendlyError, nullIfEmpty } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { SimpleCrud } from "@/components/admin/SimpleCrud";
import { isHttps } from "@/lib/rich-text";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/control-centre/_admin/website/testimonials")({
  head: () => adminHead("Testimonials"),
  component: TestimonialsAdmin,
});

type T = Tables<"testimonials">;
const KINDS = [{ value: "text", label: "Text + photo" }, { value: "video", label: "Video (9:16)" }];
const VTYPES = [{ value: "vimeo", label: "Vimeo" }, { value: "video", label: "Direct video file" }];

function TestimonialsAdmin() {
  const qc = useQueryClient();
  const key = ["cms", "testimonials"];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("testimonials").select("*").order("sort_order").order("created_at")) });
  const projects = useQuery({ queryKey: ["cms", "projects-min"], queryFn: () => must(supabase.from("portfolio_projects").select("id,title").order("title")) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["public", "client-stories"] }); };
  async function patch(id: string, p: Partial<T>, msg: string) {
    const { error } = await supabase.from("testimonials").update(p).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg); refresh();
  }
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Website" title="Testimonials"
        description="Published text testimonials fill the moving quote row on the homepage; published video testimonials fill the 9:16 video row. Empty rows are hidden. Section copy is edited under Pages → Home → client_stories." />
      <SimpleCrud<T>
        rows={q.data} loading={q.isLoading} error={q.error} empty="No testimonials yet. The homepage section stays hidden until one is published." newLabel="Add testimonial"
        renderRow={(t) => (
          <div className="flex items-center gap-3">
            {(t.photo_url || t.video_poster_url) && isHttps(t.photo_url || t.video_poster_url || "") ? <img src={(t.photo_url || t.video_poster_url)!} alt="" className="size-10 rounded-sm object-cover" /> : <span className="grid size-10 place-items-center rounded-sm bg-muted text-small">{t.client_name.charAt(0)}</span>}
            <div className="min-w-0">
              <p className="text-small font-medium">{t.client_name}{t.company ? ` · ${t.company}` : ""}</p>
              <p className="text-caption flex flex-wrap items-center gap-2 text-muted-foreground">{t.kind === "video" ? "Video" : "Text"} <StatusBadge status={t.status} />{t.featured && <FeaturedBadge />}</p>
            </div>
            <div className="ml-auto flex gap-1">
              <AdminButton size="sm" variant="ghost" onClick={() => patch(t.id, { status: t.status === "published" ? "draft" : "published" }, t.status === "published" ? "Unpublished" : "Published")}>{t.status === "published" ? "Unpublish" : "Publish"}</AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => patch(t.id, { featured: !t.featured }, t.featured ? "Unfeatured" : "Featured")}>{t.featured ? "Unfeature" : "Feature"}</AdminButton>
            </div>
          </div>
        )}
        renderForm={(t, close) => <Form t={t} projects={projects.data ?? []} nextOrder={((q.data?.length ?? 0) + 1) * 10} onSaved={() => { refresh(); close(); }} />}
        onDelete={async (t) => { const { error } = await supabase.from("testimonials").delete().eq("id", t.id); if (error) toast.error(friendlyError(error)); else { toast.success("Testimonial deleted"); refresh(); } }}
        onMove={async (i, d) => {
          const rows = q.data ?? []; const a = rows[i], b = rows[i + d]; if (!a || !b) return;
          await Promise.all([supabase.from("testimonials").update({ sort_order: (i + d) * 10 }).eq("id", a.id), supabase.from("testimonials").update({ sort_order: i * 10 }).eq("id", b.id)]);
          refresh();
        }}
      />
    </div>
  );
}

function Form({ t, projects, onSaved, nextOrder }: { t: T | null; projects: { id: string; title: string }[]; onSaved: () => void; nextOrder: number }) {
  const [v, setV] = useState({
    kind: t?.kind ?? "text", client_name: t?.client_name ?? "", client_role: t?.client_role ?? "", company: t?.company ?? "",
    photo_url: t?.photo_url ?? "", quote: t?.quote ?? "", video_type: t?.video_type ?? "vimeo", video_url: t?.video_url ?? "",
    video_poster_url: t?.video_poster_url ?? "", project_id: t?.project_id ?? "", service_label: t?.service_label ?? "",
    featured: t?.featured ?? false, status: t?.status ?? "draft", sort_order: String(t?.sort_order ?? nextOrder),
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const video = v.kind === "video";
  const errs = {
    photo: v.photo_url && !isHttps(v.photo_url) ? "Must start with https://" : null,
    poster: v.video_poster_url && !isHttps(v.video_poster_url) ? "Must start with https://" : null,
    video: video && !v.video_url ? "Add the video link." : video && v.video_type === "vimeo" && !/vimeo\.com\/(?:.*\/)?\d+/.test(v.video_url) ? "Use a vimeo.com link" : video && v.video_type === "video" && !isHttps(v.video_url) ? "Must start with https://" : null,
    quote: !video && !v.quote.trim() ? "Text testimonials need a quote." : null,
  };
  async function save() {
    if (!v.client_name.trim()) return void toast.error("Client name is required.");
    const bad = Object.values(errs).find(Boolean);
    if (bad) return void toast.error(bad);
    setBusy(true);
    const payload = {
      kind: v.kind, client_name: v.client_name.trim(), client_role: nullIfEmpty(v.client_role), company: nullIfEmpty(v.company),
      photo_url: nullIfEmpty(v.photo_url), quote: nullIfEmpty(v.quote),
      video_type: video ? v.video_type : null, video_url: video ? nullIfEmpty(v.video_url) : null, video_poster_url: video ? nullIfEmpty(v.video_poster_url) : null,
      project_id: v.project_id || null, service_label: nullIfEmpty(v.service_label), featured: v.featured, status: v.status,
      sort_order: Math.round(Number(v.sort_order) || 0),
    };
    const { error } = t ? await supabase.from("testimonials").update(payload).eq("id", t.id) : await supabase.from("testimonials").insert(payload);
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Testimonial saved"); onSaved();
  }
  return (
    <div className="grid gap-4">
      <SelectInput label="Type" value={v.kind} options={KINDS} onChange={(e) => set("kind", e.target.value)} />
      <TextInput label="Client name" required value={v.client_name} onChange={(e) => set("client_name", e.target.value)} />
      <TextInput label="Role (optional)" value={v.client_role} onChange={(e) => set("client_role", e.target.value)} />
      <TextInput label="Company / brand" value={v.company} onChange={(e) => set("company", e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <TextInput className="min-w-0 flex-1" label={video ? "Client photo (optional)" : "Client photo"} value={v.photo_url} error={errs.photo} onChange={(e) => set("photo_url", e.target.value)} />
        <UploadImageButton label="Upload" onUploaded={(u) => set("photo_url", u)} />
      </div>
      <TextArea label={video ? "Quote (optional)" : "Quote"} value={v.quote} error={errs.quote} onChange={(e) => set("quote", e.target.value)} />
      {video && (
        <>
          <SelectInput label="Video source" value={v.video_type} options={VTYPES} onChange={(e) => set("video_type", e.target.value)} />
          <TextInput label={v.video_type === "vimeo" ? "Vimeo URL" : "Video file URL"} hint="Portrait 9:16 videos look best." value={v.video_url} error={errs.video} onChange={(e) => set("video_url", e.target.value)} />
          <div className="flex flex-wrap items-end gap-3">
            <TextInput className="min-w-0 flex-1" label="Poster (optional)" hint="Shown before playback. Vimeo thumbnails are used if empty." value={v.video_poster_url} error={errs.poster} onChange={(e) => set("video_poster_url", e.target.value)} />
            <UploadImageButton label="Upload" onUploaded={(u) => set("video_poster_url", u)} />
          </div>
        </>
      )}
      <SelectInput label="Related project (optional)" value={v.project_id} options={[{ value: "", label: "— None —" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} onChange={(e) => set("project_id", e.target.value)} />
      <TextInput label="Project / service label (optional)" value={v.service_label} onChange={(e) => set("service_label", e.target.value)} />
      <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
      <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => set("status", e.target.value)} />
      <CheckboxInput label="Featured" hint="Featured testimonials appear first." checked={v.featured} onChange={(c) => set("featured", c)} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save testimonial"}</AdminButton>
    </div>
  );
}
