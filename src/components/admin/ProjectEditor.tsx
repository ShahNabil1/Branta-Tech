import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowDown, ArrowUp, ExternalLink, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, SaveBar, ConfirmButton, AdminButton, LoadingRow, ErrorNote, EmptyState,
  STATUS_OPTIONS, MEDIA_TYPE_OPTIONS, SLUG_RE, useAutoSlug, useFormState, useUnsavedWarning, friendlyError, isSafeUrl, nullIfEmpty,
  swapped,
} from "@/components/admin/cms";
import { SeoFields, seoFrom, seoPayload, seoErrors, emptySeo, type SeoValues } from "@/components/admin/SeoFields";

export function ProjectEditorLoader({ id }: { id: string | null }) {
  const cats = useQuery({ queryKey: ["cms", "portfolio_categories"], queryFn: () => must(supabase.from("portfolio_categories").select("id,name").order("sort_order")) });
  const q = useQuery({ queryKey: ["cms", "project", id], enabled: !!id, queryFn: () => must(supabase.from("portfolio_projects").select("*").eq("id", id!).maybeSingle()) });
  if (cats.isLoading || (id && q.isLoading)) return <LoadingRow />;
  if (cats.error || q.error) return <ErrorNote>{friendlyError(cats.error ?? q.error)}</ErrorNote>;
  if (id && !q.data) return <ErrorNote>Project not found.</ErrorNote>;
  return <ProjectEditor key={id ?? "new"} project={id ? q.data! : null} categories={cats.data ?? []} />;
}

type Form = {
  title: string; client_name: string; category_id: string; industry: string; project_year: string;
  short_description: string; overview: string; challenge: string; approach: string; execution: string; result: string;
  cover_url: string; cover_type: string; is_featured: boolean; status: string; sort_order: string; seo: SeoValues;
};

function ProjectEditor({ project, categories }: { project: Tables<"portfolio_projects"> | null; categories: { id: string; name: string }[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !project;
  const s = (x: string | null | undefined) => x ?? "";
  const f = useFormState<Form>({
    title: s(project?.title), client_name: s(project?.client_name), category_id: s(project?.category_id), industry: s(project?.industry),
    project_year: project?.project_year ? String(project.project_year) : "",
    short_description: s(project?.short_description), overview: s(project?.overview), challenge: s(project?.challenge),
    approach: s(project?.approach), execution: s(project?.execution), result: s(project?.result),
    cover_url: s(project?.cover_url), cover_type: s(project?.cover_type), is_featured: project?.is_featured ?? false,
    status: project?.status ?? "draft", sort_order: String(project?.sort_order ?? 0), seo: project ? seoFrom(project) : emptySeo,
  });
  const slug = useAutoSlug(project?.slug ?? "", isNew);
  const [savedSlug, setSavedSlug] = useState(project?.slug ?? "");
  const dirty = f.dirty || slug.slug !== savedSlug;
  useUnsavedWarning(dirty && f.state !== "saving");
  const v = f.values;
  const slugError = slug.slug && !SLUG_RE.test(slug.slug) ? "Use lowercase letters, numbers and hyphens." : null;
  const coverError = isSafeUrl(v.cover_url) ? null : "Unsafe or invalid URL.";
  const year = v.project_year ? Number(v.project_year) : null;
  const yearError = year !== null && (!Number.isInteger(year) || year < 1990 || year > 2100) ? "Year must be between 1990 and 2100." : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.state === "saving") return;
    if (!v.title.trim()) return f.fail("Title is required.");
    if (!slug.slug || slugError) return f.fail(slugError ?? "Slug is required.");
    if (coverError || yearError) return f.fail(coverError ?? yearError!);
    const se = seoErrors(v.seo);
    if (se.canonical_url || se.og_image_url) return f.fail("Fix the SEO URL fields.");
    f.begin();
    const payload = {
      title: v.title.trim(), slug: slug.slug, client_name: nullIfEmpty(v.client_name), category_id: v.category_id || null,
      industry: nullIfEmpty(v.industry), project_year: year, short_description: nullIfEmpty(v.short_description),
      overview: nullIfEmpty(v.overview), challenge: nullIfEmpty(v.challenge), approach: nullIfEmpty(v.approach),
      execution: nullIfEmpty(v.execution), result: nullIfEmpty(v.result), cover_url: nullIfEmpty(v.cover_url),
      cover_type: v.cover_type || null, is_featured: v.is_featured, status: v.status, sort_order: Math.round(Number(v.sort_order) || 0),
      ...seoPayload(v.seo),
    };
    const res = isNew
      ? await supabase.from("portfolio_projects").insert(payload).select("id").single()
      : await supabase.from("portfolio_projects").update(payload).eq("id", project.id).select("id").single();
    if (res.error) return f.fail(friendlyError(res.error));
    f.markSaved(v);
    setSavedSlug(slug.slug);
    qc.invalidateQueries({ queryKey: ["cms"] });
    toast.success("Project saved");
    if (isNew) setTimeout(() => navigate({ to: "/control-centre/portfolio/projects/$id", params: { id: res.data.id }, replace: true }), 0);
  }

  const text = (k: keyof Form, label: string, rows = 4) => (
    <TextArea label={label} rows={rows} value={v[k] as string} onChange={(e) => f.set(k, e.target.value as never)} className="md:col-span-2" />
  );

  return (
    <div className="max-w-4xl">
      <Link to="/control-centre/portfolio" className="text-small mb-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Portfolio
      </Link>
      <PageHeader
        eyebrow="Website · Project"
        title={isNew ? "Create project" : project.title}
        actions={!isNew && <a href={`/work/${savedSlug}`} target="_blank" rel="noreferrer"><AdminButton><ExternalLink className="size-4" aria-hidden /> Preview</AdminButton></a>}
      />
      <form onSubmit={save} className="grid gap-6">
        <Panel title="Details">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Title" required value={v.title} onChange={(e) => { f.set("title", e.target.value); slug.syncFrom(e.target.value); }} />
            <TextInput label="Slug" required value={slug.slug} error={slugError} hint="Generated from the title until you edit it." onChange={(e) => slug.setSlug(e.target.value)} />
            <TextInput label="Client name" value={v.client_name} onChange={(e) => f.set("client_name", e.target.value)} />
            <SelectInput label="Category" value={v.category_id} options={[{ value: "", label: "Uncategorised" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} onChange={(e) => f.set("category_id", e.target.value)} />
            <TextInput label="Industry" value={v.industry} onChange={(e) => f.set("industry", e.target.value)} />
            <TextInput label="Project year" type="number" value={v.project_year} error={yearError} onChange={(e) => f.set("project_year", e.target.value)} />
            {text("short_description", "Short description", 3)}
          </div>
        </Panel>
        <Panel title="Case study" description="All optional.">
          <div className="grid gap-4 md:grid-cols-2">
            {text("overview", "Overview")}
            {text("challenge", "Challenge")}
            {text("approach", "Approach")}
            {text("execution", "Execution")}
            {text("result", "Result")}
          </div>
        </Panel>
        <Panel title="Cover & display">
          <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
            <TextInput label="Cover URL" value={v.cover_url} error={coverError} onChange={(e) => f.set("cover_url", e.target.value)} />
            <SelectInput label="Cover type" value={v.cover_type} options={MEDIA_TYPE_OPTIONS} onChange={(e) => f.set("cover_type", e.target.value)} />
            <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => f.set("status", e.target.value)} />
            <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", e.target.value)} />
            <CheckboxInput label="Featured" checked={v.is_featured} onChange={(b) => f.set("is_featured", b)} />
          </div>
        </Panel>
        <SeoFields values={v.seo} onChange={(k, val) => f.set("seo", { ...v.seo, [k]: val })} />
        <SaveBar state={f.state} dirty={dirty} error={f.error} />
      </form>
      {isNew ? (
        <p className="text-small mt-8 text-muted-foreground">Save the project first to add services and media.</p>
      ) : (
        <div className="mt-10 grid gap-6">
          <ProjectServices projectId={project.id} />
          <ProjectMedia projectId={project.id} />
        </div>
      )}
    </div>
  );
}

/* ---------------- services assignment ---------------- */

function ProjectServices({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const all = useQuery({ queryKey: ["cms", "services", "picker"], queryFn: () => must(supabase.from("services").select("id,name,service_groups(name)").order("name")) });
  const linked = useQuery({
    queryKey: ["cms", "project_services", projectId],
    queryFn: () => must(supabase.from("portfolio_project_services").select("service_id,sort_order").eq("project_id", projectId).order("sort_order")),
  });
  const [list, setList] = useState<string[] | null>(null);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const current = list ?? (linked.data ?? []).map((r) => r.service_id);
  const dirty = list !== null && JSON.stringify(list) !== JSON.stringify((linked.data ?? []).map((r) => r.service_id));
  const nameOf = (id: string) => {
    const s = all.data?.find((x) => x.id === id);
    return s ? `${s.name}${s.service_groups?.name ? ` · ${s.service_groups.name}` : ""}` : "Unknown service";
  };

  const move = (i: number, d: -1 | 1) => {
    const next = [...current];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setList(next);
  };

  async function save() {
    if (saving) return;
    setSaving(true);
    const del = await supabase.from("portfolio_project_services").delete().eq("project_id", projectId);
    if (del.error) { setSaving(false); return void toast.error(friendlyError(del.error)); }
    if (current.length) {
      const ins = await supabase.from("portfolio_project_services").insert(current.map((service_id, i) => ({ project_id: projectId, service_id, sort_order: (i + 1) * 10 })));
      if (ins.error) { setSaving(false); return void toast.error(friendlyError(ins.error)); }
    }
    await qc.invalidateQueries({ queryKey: ["cms", "project_services", projectId] });
    setList(null);
    setSaving(false);
    toast.success("Services saved");
  }

  const available = (all.data ?? []).filter((s) => !current.includes(s.id));

  return (
    <Panel title="Services" description="Services delivered in this project, in display order.">
      {(all.isLoading || linked.isLoading) && <LoadingRow />}
      {(all.error || linked.error) && <ErrorNote>{friendlyError(all.error ?? linked.error)}</ErrorNote>}
      {current.length === 0 && !linked.isLoading && <EmptyState>No services assigned.</EmptyState>}
      <ol className="grid gap-1.5">
        {current.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-sm border border-border px-3 py-2">
            <span className="text-caption font-mono text-muted-foreground">{i + 1}</span>
            <span className="text-small flex-1 font-medium">{nameOf(id)}</span>
            <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
            <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === current.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
            <AdminButton size="sm" variant="ghost" aria-label="Remove" onClick={() => setList(current.filter((x) => x !== id))}><X className="size-3.5" /></AdminButton>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <SelectInput label="Add service" className="min-w-60 flex-1" value={pick} onChange={(e) => setPick(e.target.value)}
          options={[{ value: "", label: available.length ? "Choose a service…" : "No more services" }, ...available.map((s) => ({ value: s.id, label: nameOf(s.id) }))]} />
        <AdminButton disabled={!pick} onClick={() => { setList([...current, pick]); setPick(""); }}><Plus className="size-4" aria-hidden /> Add</AdminButton>
        <AdminButton variant="primary" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save services"}</AdminButton>
      </div>
    </Panel>
  );
}

/* ---------------- media ---------------- */

type Media = Tables<"portfolio_media">;

function ProjectMedia({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["cms", "project_media", projectId];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("portfolio_media").select("*").eq("project_id", projectId).order("sort_order")) });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function move(i: number, d: -1 | 1) {
    const order = q.data!.map((m) => m.id);
    order = swapped(order, i, i + d);
    const res = await Promise.all(order.map((id, idx) => supabase.from("portfolio_media").update({ sort_order: (idx + 1) * 10 }).eq("id", id)));
    const err = res.find((r) => r.error)?.error;
    if (err) toast.error(friendlyError(err));
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("portfolio_media").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Media removed");
    refresh();
  }
  const nextOrder = (Math.max(0, ...(q.data ?? []).map((m) => m.sort_order)) + 10);

  return (
    <Panel title="Media" description="Gallery items for this project." actions={<AdminButton size="sm" variant="primary" onClick={() => setEditing("new")}><Plus className="size-3.5" aria-hidden /> Add media</AdminButton>}>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {editing === "new" && <MediaForm projectId={projectId} media={null} defaultOrder={nextOrder} onDone={() => { setEditing(null); refresh(); }} />}
      {q.data?.length === 0 && editing !== "new" && <EmptyState>No media yet.</EmptyState>}
      <ul className="mt-2 grid gap-2">
        {q.data?.map((m, i) => (
          <li key={m.id} className="rounded-sm border border-border">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              {m.media_type === "image" ? (
                <img src={m.url} alt={m.alt_text ?? ""} className="size-12 rounded-sm bg-muted object-cover" loading="lazy" />
              ) : (
                <span className="text-caption grid size-12 place-items-center rounded-sm bg-muted font-mono">{m.media_type}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-small truncate font-medium">{m.caption || m.alt_text || m.url}</p>
                <p className="text-caption text-muted-foreground">{m.media_type} · {m.orientation}</p>
              </div>
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === q.data.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" onClick={() => setEditing(editing === m.id ? null : m.id)}>{editing === m.id ? "Close" : "Edit"}</AdminButton>
              <ConfirmButton title="Remove this media item?" description="It is removed from the project. Uploaded files stay in the Media library." confirmLabel="Remove" onConfirm={() => remove(m.id)}>Remove</ConfirmButton>
            </div>
            {editing === m.id && <MediaForm projectId={projectId} media={m} defaultOrder={m.sort_order} onDone={() => { setEditing(null); refresh(); }} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const ORIENTATIONS = ["auto", "landscape", "portrait", "square"].map((v) => ({ value: v, label: v }));

function MediaForm({ projectId, media, defaultOrder, onDone }: { projectId: string; media: Media | null; defaultOrder: number; onDone: () => void }) {
  const f = useFormState({
    media_type: media?.media_type ?? "image",
    url: media?.url ?? "",
    poster_url: media?.poster_url ?? "",
    alt_text: media?.alt_text ?? "",
    caption: media?.caption ?? "",
    orientation: media?.orientation ?? "auto",
    sort_order: String(defaultOrder),
  });
  const v = f.values;
  const urlErr = !v.url ? null : isSafeUrl(v.url, { allowInternal: false }) ? null : "Use a full https:// URL.";
  const posterErr = isSafeUrl(v.poster_url, { allowInternal: false }) ? null : "Use a full https:// URL.";

  async function save() {
    if (f.state === "saving") return;
    if (!v.url.trim()) return f.fail("URL is required.");
    if (urlErr || posterErr) return f.fail("Fix the URL fields.");
    f.begin();
    const payload = {
      media_type: v.media_type, url: v.url.trim(), poster_url: nullIfEmpty(v.poster_url), alt_text: nullIfEmpty(v.alt_text),
      caption: nullIfEmpty(v.caption), orientation: v.orientation, sort_order: Math.round(Number(v.sort_order) || 0),
    };
    const { error } = media
      ? await supabase.from("portfolio_media").update(payload).eq("id", media.id)
      : await supabase.from("portfolio_media").insert({ ...payload, project_id: projectId });
    if (error) return f.fail(friendlyError(error));
    f.markSaved(v);
    toast.success("Media saved");
    onDone();
  }

  return (
    <div className="grid gap-4 border-t border-border bg-background/60 p-4 md:grid-cols-2">
      <SelectInput label="Media type" value={v.media_type} options={MEDIA_TYPE_OPTIONS.filter((o) => o.value)} onChange={(e) => f.set("media_type", e.target.value)} />
      <SelectInput label="Orientation" value={v.orientation} options={ORIENTATIONS} onChange={(e) => f.set("orientation", e.target.value)} />
      <TextInput label="URL" required value={v.url} error={urlErr} hint={v.media_type === "vimeo" ? "Vimeo video link" : "Copy a URL from the Media library"} onChange={(e) => f.set("url", e.target.value)} className="md:col-span-2" />
      <TextInput label="Poster URL" value={v.poster_url} error={posterErr} onChange={(e) => f.set("poster_url", e.target.value)} />
      <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", e.target.value)} />
      <TextInput label="Alt text" value={v.alt_text} onChange={(e) => f.set("alt_text", e.target.value)} />
      <TextInput label="Caption" value={v.caption} onChange={(e) => f.set("caption", e.target.value)} />
      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" onClick={save} disabled={f.state === "saving"}>{f.state === "saving" ? "Saving…" : "Save media"}</AdminButton>
        <AdminButton variant="ghost" onClick={onDone}>Cancel</AdminButton>
        {f.state === "error" && <span className="text-caption text-destructive" role="alert">{f.error}</span>}
      </div>
    </div>
  );
}
