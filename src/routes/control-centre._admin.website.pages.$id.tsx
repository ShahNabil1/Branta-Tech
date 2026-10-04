import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowDown, ArrowUp, Eye, EyeOff, Plus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, SaveBar, ConfirmButton, AdminButton,
  LoadingRow, ErrorNote, EmptyState, StatusBadge, STATUS_OPTIONS, MEDIA_TYPE_OPTIONS, SLUG_RE,
  useAutoSlug, useFormState, useUnsavedWarning, friendlyError, isSafeUrl, nullIfEmpty,
  swapped,
} from "@/components/admin/cms";
import { HeroFields } from "@/components/admin/HeroFields";
import { CapabilityFields } from "@/components/admin/CapabilityFields";
import { AiFilmFields } from "@/components/admin/AiFilmFields";
import { AiImageFields } from "@/components/admin/AiImageFields";
import { WebSoftwareFields } from "@/components/admin/WebSoftwareFields";
import { AutomationFields } from "@/components/admin/AutomationFields";
import { HomeClosingFields } from "@/components/admin/HomeClosingFields";
import { SeoFields, seoFrom, seoPayload, seoErrors, emptySeo, type SeoValues } from "@/components/admin/SeoFields";

export const Route = createFileRoute("/control-centre/_admin/website/pages/$id")({
  head: () => adminHead("Edit page"),
  component: PageEditorRoute,
});

const PAGE_TYPES = ["standard", "home", "landing", "legal", "contact"].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

function PageEditorRoute() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const q = useQuery({
    queryKey: ["cms", "page", id],
    enabled: !isNew,
    queryFn: () => must(supabase.from("site_pages").select("*").eq("id", id).maybeSingle()),
  });
  if (!isNew && q.isLoading) return <LoadingRow />;
  if (!isNew && q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  if (!isNew && !q.data) return <ErrorNote>Page not found.</ErrorNote>;
  return <PageEditor key={id} page={isNew ? null : q.data!} />;
}

type Form = { title: string; page_type: string; status: string; seo: SeoValues };

function PageEditor({ page }: { page: Tables<"site_pages"> | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !page;
  const f = useFormState<Form>({
    title: page?.title ?? "",
    page_type: page?.page_type ?? "standard",
    status: page?.status ?? "draft",
    seo: page ? seoFrom(page) : emptySeo,
  });
  const slug = useAutoSlug(page?.slug ?? "", isNew);
  const [savedSlug, setSavedSlug] = useState(page?.slug ?? "");
  const dirty = f.dirty || slug.slug !== savedSlug;
  useUnsavedWarning(dirty && f.state !== "saving");

  const slugError = slug.slug && !SLUG_RE.test(slug.slug) ? "Use lowercase letters, numbers and hyphens." : null;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (f.state === "saving") return;
    if (!f.values.title.trim()) return f.fail("Title is required.");
    if (!slug.slug || slugError) return f.fail(slugError ?? "Slug is required.");
    const se = seoErrors(f.values.seo);
    if (se.canonical_url || se.og_image_url) return f.fail("Fix the SEO URL fields.");
    f.begin();
    const payload = {
      title: f.values.title.trim(),
      slug: slug.slug,
      page_type: f.values.page_type,
      status: f.values.status,
      ...seoPayload(f.values.seo),
    };
    const res = isNew
      ? await supabase.from("site_pages").insert(payload).select("id").single()
      : await supabase.from("site_pages").update(payload).eq("id", page.id).select("id").single();
    if (res.error) return f.fail(friendlyError(res.error));
    f.markSaved(f.values);
    setSavedSlug(slug.slug);
    qc.invalidateQueries({ queryKey: ["cms"] });
    toast.success("Page saved");
    if (isNew) setTimeout(() => navigate({ to: "/control-centre/website/pages/$id", params: { id: res.data.id }, replace: true }), 0);
  }

  return (
    <div className="max-w-4xl">
      <Link to="/control-centre/website/pages" className="text-small mb-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Pages
      </Link>
      <PageHeader
        eyebrow="Website · Page"
        title={isNew ? "Create page" : page.title}
        actions={!isNew && (
          <a href={savedSlug === "home" ? "/" : `/${savedSlug}`} target="_blank" rel="noreferrer">
            <AdminButton><ExternalLink className="size-4" aria-hidden /> Preview</AdminButton>
          </a>
        )}
      />
      <form onSubmit={save} className="grid gap-6">
        <Panel title="Details">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Title" required value={f.values.title} onChange={(e) => { f.set("title", e.target.value); slug.syncFrom(e.target.value); }} className="md:col-span-2" />
            <TextInput label="Slug" required value={slug.slug} error={slugError} hint="Generated from the title until you edit it." onChange={(e) => slug.setSlug(e.target.value)} />
            <SelectInput label="Page type" value={f.values.page_type} options={PAGE_TYPES} onChange={(e) => f.set("page_type", e.target.value)} />
            <SelectInput label="Status" value={f.values.status} options={STATUS_OPTIONS} onChange={(e) => f.set("status", e.target.value)} />
          </div>
        </Panel>
        <SeoFields values={f.values.seo} onChange={(k, v) => f.set("seo", { ...f.values.seo, [k]: v })} />
        <SaveBar state={f.state} dirty={dirty} error={f.error} />
      </form>
      {!isNew && <Sections pageId={page.id} />}
    </div>
  );
}

/* ---------------- sections ---------------- */

type Section = Tables<"page_sections">;

function Sections({ pageId }: { pageId: string }) {
  const qc = useQueryClient();
  const key = ["cms", "sections", pageId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => must(supabase.from("page_sections").select("*").eq("page_id", pageId).order("sort_order")),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function add() {
    const max = Math.max(0, ...(q.data ?? []).map((s) => s.sort_order));
    const { data, error } = await supabase.from("page_sections")
      .insert({ page_id: pageId, section_type: "text", sort_order: max + 10, is_visible: false })
      .select("id").single();
    if (error) return void toast.error(friendlyError(error));
    await refresh();
    setEditing(data.id);
  }

  async function move(i: number, dir: -1 | 1) {
    const list = q.data!;
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    // Renumber to avoid ties, then swap.
    let order = list.map((s) => s.id);
    order = swapped(order, i, i + dir);
    const results = await Promise.all(order.map((id, idx) => supabase.from("page_sections").update({ sort_order: (idx + 1) * 10 }).eq("id", id)));
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error(friendlyError(err));
    refresh();
  }

  async function toggle(s: Section) {
    const { error } = await supabase.from("page_sections").update({ is_visible: !s.is_visible }).eq("id", s.id);
    if (error) return void toast.error(friendlyError(error));
    refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("page_sections").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Section deleted");
    refresh();
  }

  return (
    <Panel
      className="mt-10"
      title="Sections"
      description="Shown on the page in this order. New sections start hidden."
      actions={<AdminButton size="sm" variant="primary" onClick={add}><Plus className="size-3.5" aria-hidden /> Add section</AdminButton>}
    >
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data?.length === 0 && <EmptyState>No sections yet.</EmptyState>}
      <ul className="grid gap-2">
        {q.data?.map((s, i) => (
          <li key={s.id} className="rounded-sm border border-border">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="text-caption font-mono text-muted-foreground">{i + 1}</span>
              <span className="text-caption rounded-sm bg-muted px-1.5 py-0.5 font-mono">{s.section_type}</span>
              <span className="text-small min-w-0 flex-1 truncate font-medium">{s.title || <span className="text-muted-foreground">Untitled</span>}</span>
              {!s.is_visible && <span className="text-caption text-muted-foreground">Hidden</span>}
              <div className="flex gap-1">
                <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === q.data.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label={s.is_visible ? "Hide" : "Show"} onClick={() => toggle(s)}>
                  {s.is_visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </AdminButton>
                <AdminButton size="sm" onClick={() => setEditing(editing === s.id ? null : s.id)}>{editing === s.id ? "Close" : "Edit"}</AdminButton>
                <ConfirmButton title="Delete this section?" description="This permanently removes the section from the page." onConfirm={() => remove(s.id)}>Delete</ConfirmButton>
              </div>
            </div>
            {editing === s.id && <SectionForm section={s} onSaved={refresh} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const SECTION_TYPES = ["hero", "capability_explorer", "featured_work", "ai_film_showcase", "ai_image_showcase", "web_software_showcase", "automation_showcase", "process", "client_logos", "insights_teaser", "careers_teaser", "final_cta", "studio_hero", "studio_entry", "text", "media", "cta", "services", "portfolio", "logos", "custom"].map((v) => ({ value: v, label: v }));

function SectionForm({ section, onSaved }: { section: Section; onSaved: () => void }) {
  const init = {
    section_type: section.section_type,
    eyebrow: section.eyebrow ?? "",
    title: section.title ?? "",
    body: section.body ?? "",
    media_url: section.media_url ?? "",
    media_type: section.media_type ?? "",
    cta_label: section.cta_label ?? "",
    cta_url: section.cta_url ?? "",
    is_visible: section.is_visible,
    sort_order: String(section.sort_order),
    config: JSON.stringify(section.config ?? {}, null, 2),
  };
  const f = useFormState(init);
  const [advanced, setAdvanced] = useState(false);
  const v = f.values;
  const errs = {
    media_url: isSafeUrl(v.media_url) ? null : "Unsafe or invalid URL.",
    cta_url: isSafeUrl(v.cta_url) ? null : "Use /path or https:// URL.",
  };

  async function save() {
    if (f.state === "saving") return;
    if (errs.media_url || errs.cta_url) return f.fail("Fix the URL fields.");
    let config: unknown;
    try { config = JSON.parse(v.config || "{}"); } catch { return f.fail("Advanced config must be valid JSON."); }
    if (!Number.isFinite(Number(v.sort_order))) return f.fail("Sort order must be a number.");
    f.begin();
    const { error } = await supabase.from("page_sections").update({
      section_type: v.section_type,
      eyebrow: nullIfEmpty(v.eyebrow),
      title: nullIfEmpty(v.title),
      body: nullIfEmpty(v.body),
      media_url: nullIfEmpty(v.media_url),
      media_type: v.media_type || null,
      cta_label: nullIfEmpty(v.cta_label),
      cta_url: nullIfEmpty(v.cta_url),
      is_visible: v.is_visible,
      sort_order: Math.round(Number(v.sort_order)),
      config: config as never,
    }).eq("id", section.id);
    if (error) return f.fail(friendlyError(error));
    f.markSaved(v);
    toast.success("Section saved");
    onSaved();
  }

  return (
    <div className="grid gap-4 border-t border-border bg-background/60 p-4 md:grid-cols-2">
      <SelectInput label="Section type" value={v.section_type} options={SECTION_TYPES} onChange={(e) => f.set("section_type", e.target.value)} />
      <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", e.target.value)} />
      <TextInput label="Eyebrow" value={v.eyebrow} onChange={(e) => f.set("eyebrow", e.target.value)} />
      <TextInput label="Title" value={v.title} onChange={(e) => f.set("title", e.target.value)} />
      <TextArea label="Body" value={v.body} onChange={(e) => f.set("body", e.target.value)} className="md:col-span-2" />
      <TextInput label="Media URL" value={v.media_url} error={errs.media_url} onChange={(e) => f.set("media_url", e.target.value)} />
      <SelectInput label="Media type" value={v.media_type} options={MEDIA_TYPE_OPTIONS} onChange={(e) => f.set("media_type", e.target.value)} />
      <TextInput label="CTA label" value={v.cta_label} onChange={(e) => f.set("cta_label", e.target.value)} />
      <TextInput label="CTA URL" value={v.cta_url} error={errs.cta_url} placeholder="/contact" onChange={(e) => f.set("cta_url", e.target.value)} />
      <CheckboxInput label="Visible" checked={v.is_visible} onChange={(b) => f.set("is_visible", b)} />
      {v.section_type === "hero" && <HeroFields config={v.config} onChange={(c) => f.set("config", c)} />}
      {v.section_type === "web_software_showcase" && <WebSoftwareFields config={v.config} onChange={(c) => f.set("config", c)} />}
      {["process", "client_logos", "insights_teaser", "careers_teaser", "final_cta"].includes(v.section_type) && <HomeClosingFields type={v.section_type} config={v.config} onChange={(c) => f.set("config", c)} />}
      {v.section_type === "automation_showcase" && <AutomationFields config={v.config} onChange={(c) => f.set("config", c)} />}
      {v.section_type === "ai_image_showcase" && <AiImageFields config={v.config} onChange={(c) => f.set("config", c)} />}
      {v.section_type === "ai_film_showcase" && <AiFilmFields config={v.config} onChange={(c) => f.set("config", c)} />}
      {v.section_type === "capability_explorer" && <CapabilityFields config={v.config} onChange={(c) => f.set("config", c)} />}
      <div className="md:col-span-2">
        <button type="button" className="text-caption text-muted-foreground underline underline-offset-4" onClick={() => setAdvanced((a) => !a)}>
          {advanced ? "Hide" : "Show"} advanced settings
        </button>
        {advanced && <TextArea label="Config (JSON)" className="mt-3" value={v.config} onChange={(e) => f.set("config", e.target.value)} />}
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" onClick={save} disabled={f.state === "saving"}>{f.state === "saving" ? "Saving…" : "Save section"}</AdminButton>
        <span className="text-caption" role="status">
          {f.state === "saved" && !f.dirty && "Saved"}
          {f.state === "error" && <span className="text-destructive">{f.error}</span>}
          {f.dirty && f.state !== "error" && f.state !== "saving" && <span className="text-muted-foreground">Unsaved changes</span>}
        </span>
      </div>
    </div>
  );
}
