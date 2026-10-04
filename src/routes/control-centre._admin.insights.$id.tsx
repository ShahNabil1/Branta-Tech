import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, SaveBar, LoadingRow, ErrorNote, AdminButton,
  STATUS_OPTIONS, SLUG_RE, friendlyError, nullIfEmpty, useAutoSlug, useFormState, useUnsavedWarning,
} from "@/components/admin/cms";
import { SeoFields, emptySeo, seoErrors, seoFrom, seoPayload, type SeoValues } from "@/components/admin/SeoFields";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { BlocksEditor, fromDrafts, toDrafts, type BlockDraft } from "@/components/admin/BlocksEditor";
import { RichText } from "@/components/content/RichText";
import { isHttps, parseBlocks } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/insights/$id")({
  head: () => adminHead("Edit article"),
  component: PostEditor,
});

type Form = {
  title: string; excerpt: string; category: string; cover_url: string; cover_alt: string; author_id: string;
  status: string; featured: boolean; published_at: string; sort_order: number; blocks: BlockDraft[]; seo: SeoValues;
};
const EMPTY: Form = { title: "", excerpt: "", category: "", cover_url: "", cover_alt: "", author_id: "", status: "draft", featured: false, published_at: "", sort_order: 0, blocks: [], seo: emptySeo };
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function PostEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"content" | "settings" | "seo" | "preview">("content");
  const f = useFormState<Form>(EMPTY);
  const slug = useAutoSlug("", isNew);
  const [loadedSlug, setLoadedSlug] = useState("");
  useUnsavedWarning(f.dirty || slug.slug !== loadedSlug);

  const authors = useQuery({ queryKey: ["cms", "authors"], queryFn: () => must(supabase.from("authors").select("id,name,is_active").order("sort_order").order("name")) });
  const q = useQuery({ queryKey: ["cms", "post", id], enabled: !isNew, queryFn: () => must(supabase.from("posts").select("*").eq("id", id).single()) });

  useEffect(() => {
    const r = q.data;
    if (!r) return;
    f.markSaved({
      title: r.title, excerpt: r.excerpt ?? "", category: r.category ?? "", cover_url: r.cover_url ?? "", cover_alt: r.cover_alt ?? "",
      author_id: r.author_id ?? "", status: r.status, featured: r.featured, published_at: toLocal(r.published_at), sort_order: r.sort_order,
      blocks: toDrafts(parseBlocks(r.content_json)), seo: seoFrom(r),
    });
    slug.reset(r.slug);
    setLoadedSlug(r.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const v = f.values;
  const errs = {
    title: v.title.trim() ? null : "Title is required",
    slug: SLUG_RE.test(slug.slug) ? null : "Use lowercase letters, numbers and dashes",
    cover_url: !v.cover_url || isHttps(v.cover_url) ? null : "Must start with https://",
    cover_alt: v.cover_url && !v.cover_alt.trim() ? "Describe the cover image" : null,
    ...seoErrors(v.seo),
  };

  async function save() {
    const firstErr = Object.values(errs).find(Boolean);
    if (firstErr) return f.fail(firstErr);
    f.begin();
    const published_at = v.published_at ? new Date(v.published_at).toISOString() : v.status === "published" ? new Date().toISOString() : null;
    const payload = {
      title: v.title.trim(), slug: slug.slug, excerpt: nullIfEmpty(v.excerpt), category: nullIfEmpty(v.category), cover_url: nullIfEmpty(v.cover_url), cover_alt: nullIfEmpty(v.cover_alt),
      author_id: v.author_id || null, status: v.status, featured: v.featured, published_at, sort_order: Number(v.sort_order) || 0,
      content_json: fromDrafts(v.blocks), ...seoPayload(v.seo),
    };
    const res = isNew ? await supabase.from("posts").insert(payload).select("id").single() : await supabase.from("posts").update(payload).eq("id", id).select("id").single();
    if (res.error) return f.fail(friendlyError(res.error));
    qc.invalidateQueries({ queryKey: ["cms"] });
    f.markSaved({ ...v, published_at: toLocal(published_at) });
    setLoadedSlug(slug.slug);
    toast.success("Article saved");
    if (isNew) navigate({ to: "/control-centre/insights/$id", params: { id: res.data.id }, replace: true });
  }

  if (!isNew && q.isLoading) return <LoadingRow />;
  if (q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  const preview = parseBlocks(fromDrafts(v.blocks));
  const tabs = [["content", "Content"], ["settings", "Settings"], ["seo", "SEO"], ["preview", "Preview"]] as const;

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Insights" title={isNew ? "New article" : v.title || "Edit article"} actions={
        <>
          <Link to="/control-centre/insights"><AdminButton>Back</AdminButton></Link>
          {!isNew && v.status === "published" && <a href={`/insights/${loadedSlug}`} target="_blank" rel="noreferrer"><AdminButton>View live</AdminButton></a>}
        </>
      } />
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("text-small -mb-px border-b-2 px-3 py-2", tab === k ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab === "content" && (
        <div className="grid gap-6">
          <Panel>
            <div className="grid gap-4">
              <TextInput label="Title" value={v.title} error={errs.title && v.title !== "" ? errs.title : null} onChange={(e) => { f.set("title", e.target.value); slug.syncFrom(e.target.value); }} />
              <TextInput label="Slug" value={slug.slug} error={slug.slug ? errs.slug : null} hint={`/insights/${slug.slug || "…"}`} onChange={(e) => slug.setSlug(e.target.value)} />
              <TextArea label="Excerpt" hint="Short summary shown on cards and in search results." value={v.excerpt} onChange={(e) => f.set("excerpt", e.target.value)} />
            </div>
          </Panel>
          <Panel title="Body"><BlocksEditor value={v.blocks} onChange={(b) => f.set("blocks", b)} /></Panel>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-6">
          <Panel title="Publishing">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => f.set("status", e.target.value)} />
              <TextInput label="Publish date" type="datetime-local" hint="Left empty, it's set when first published." value={v.published_at} onChange={(e) => f.set("published_at", e.target.value)} />
              <TextInput label="Category" placeholder="e.g. AI, Design, Automation" value={v.category} onChange={(e) => f.set("category", e.target.value)} />
              <SelectInput label="Author" value={v.author_id} options={[{ value: "", label: "No author" }, ...(authors.data ?? []).map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (inactive)` }))]} onChange={(e) => f.set("author_id", e.target.value)} />
              <TextInput label="Order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", Number(e.target.value))} />
              <div className="self-end"><CheckboxInput label="Featured" hint="Featured articles lead the Insights page." checked={v.featured} onChange={(c) => f.set("featured", c)} /></div>
            </div>
          </Panel>
          <Panel title="Cover image">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <TextInput className="min-w-0 flex-1" label="Cover URL (https)" value={v.cover_url} error={errs.cover_url} onChange={(e) => f.set("cover_url", e.target.value)} />
                <UploadImageButton onUploaded={(u) => f.set("cover_url", u)} />
              </div>
              <TextInput label="Cover alt text" value={v.cover_alt} error={errs.cover_alt} onChange={(e) => f.set("cover_alt", e.target.value)} />
              {isHttps(v.cover_url) && <img src={v.cover_url} alt="" className="aspect-[16/9] w-full max-w-md rounded-sm object-cover" />}
            </div>
          </Panel>
        </div>
      )}

      {tab === "seo" && <SeoFields values={v.seo} onChange={(k, val) => f.set("seo", { ...v.seo, [k]: val })} />}

      {tab === "preview" && (
        <Panel title="Preview" description="How the article body will read. Only published articles appear on the site.">
          {v.category && <p className="text-eyebrow text-accent">{v.category}</p>}
          <h1 className="text-h1 mt-2">{v.title || "Untitled"}</h1>
          {v.excerpt && <p className="text-body-lg mt-4 text-muted-foreground">{v.excerpt}</p>}
          {isHttps(v.cover_url) && <img src={v.cover_url} alt={v.cover_alt} className="mt-6 aspect-[16/9] w-full rounded-sm object-cover" />}
          <div className="mt-8 max-w-[68ch]">{preview.length ? <RichText blocks={preview} /> : <p className="text-muted-foreground">No body content yet.</p>}</div>
        </Panel>
      )}

      <SaveBar state={f.state} dirty={f.dirty || slug.slug !== loadedSlug} error={f.error} onSave={save} />
    </div>
  );
}
