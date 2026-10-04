import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, SaveBar, LoadingRow, ErrorNote, AdminButton,
  SLUG_RE, friendlyError, nullIfEmpty, useAutoSlug, useFormState, useUnsavedWarning,
} from "@/components/admin/cms";
import { BlocksEditor, fromDrafts, toDrafts, type BlockDraft } from "@/components/admin/BlocksEditor";
import { parseBlocks } from "@/lib/rich-text";

export const Route = createFileRoute("/control-centre/_admin/careers/jobs/$id")({
  head: () => adminHead("Edit role"),
  component: JobEditor,
});

const JOB_STATUS = [{ value: "draft", label: "Draft" }, { value: "published", label: "Published (open)" }, { value: "closed", label: "Closed" }, { value: "archived", label: "Archived" }];
type Form = {
  title: string; department: string; employment_type: string; location: string; work_mode: string; summary: string;
  requirements: string; status: string; featured: boolean; sort_order: number; blocks: BlockDraft[];
};
const EMPTY: Form = { title: "", department: "", employment_type: "", location: "", work_mode: "", summary: "", requirements: "", status: "draft", featured: false, sort_order: 0, blocks: [] };

function JobEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const f = useFormState<Form>(EMPTY);
  const slug = useAutoSlug("", isNew);
  const [loadedSlug, setLoadedSlug] = useState("");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  useUnsavedWarning(f.dirty || slug.slug !== loadedSlug);
  const q = useQuery({ queryKey: ["cms", "job", id], enabled: !isNew, queryFn: () => must(supabase.from("jobs").select("*").eq("id", id).single()) });

  useEffect(() => {
    const r = q.data;
    if (!r) return;
    const reqs = Array.isArray(r.requirements_json) ? r.requirements_json.filter((x) => typeof x === "string") : [];
    f.markSaved({
      title: r.title, department: r.department ?? "", employment_type: r.employment_type ?? "", location: r.location ?? "", work_mode: r.work_mode ?? "",
      summary: r.summary ?? "", requirements: reqs.join("\n"), status: r.status, featured: r.featured, sort_order: r.sort_order, blocks: toDrafts(parseBlocks(r.description_json)),
    });
    slug.reset(r.slug); setLoadedSlug(r.slug); setPublishedAt(r.published_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const v = f.values;
  async function save() {
    if (!v.title.trim()) return f.fail("Title is required");
    if (!SLUG_RE.test(slug.slug)) return f.fail("Slug: use lowercase letters, numbers and dashes");
    f.begin();
    const pub = v.status === "published" && !publishedAt ? new Date().toISOString() : publishedAt;
    const payload = {
      title: v.title.trim(), slug: slug.slug, department: nullIfEmpty(v.department), employment_type: nullIfEmpty(v.employment_type), location: nullIfEmpty(v.location),
      work_mode: nullIfEmpty(v.work_mode), summary: nullIfEmpty(v.summary), requirements_json: v.requirements.split("\n").map((s) => s.trim()).filter(Boolean),
      status: v.status, featured: v.featured, sort_order: Number(v.sort_order) || 0, description_json: fromDrafts(v.blocks), published_at: pub,
    };
    const res = isNew ? await supabase.from("jobs").insert(payload).select("id").single() : await supabase.from("jobs").update(payload).eq("id", id).select("id").single();
    if (res.error) return f.fail(friendlyError(res.error));
    qc.invalidateQueries({ queryKey: ["cms"] });
    f.markSaved(v); setLoadedSlug(slug.slug); setPublishedAt(pub);
    toast.success("Role saved");
    if (isNew) navigate({ to: "/control-centre/careers/jobs/$id", params: { id: res.data.id }, replace: true });
  }

  if (!isNew && q.isLoading) return <LoadingRow />;
  if (q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Careers" title={isNew ? "New role" : v.title || "Edit role"} actions={<>
        <Link to="/control-centre/careers/jobs"><AdminButton>Back</AdminButton></Link>
        {!isNew && <Link to="/control-centre/careers/applications" search={{ job: id }}><AdminButton>Applications</AdminButton></Link>}
      </>} />
      <div className="grid gap-6">
        <Panel title="Role">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput className="sm:col-span-2" label="Title" value={v.title} onChange={(e) => { f.set("title", e.target.value); slug.syncFrom(e.target.value); }} />
            <TextInput className="sm:col-span-2" label="Slug" value={slug.slug} hint={`/careers/${slug.slug || "…"}`} onChange={(e) => slug.setSlug(e.target.value)} />
            <TextInput label="Department" value={v.department} onChange={(e) => f.set("department", e.target.value)} />
            <TextInput label="Employment type" hint='e.g. Full-time, Contract, Internship ("Internship" lists it under internships)' value={v.employment_type} onChange={(e) => f.set("employment_type", e.target.value)} />
            <TextInput label="Location" value={v.location} onChange={(e) => f.set("location", e.target.value)} />
            <TextInput label="Work mode" hint="e.g. On-site, Hybrid, Remote" value={v.work_mode} onChange={(e) => f.set("work_mode", e.target.value)} />
            <TextArea className="sm:col-span-2" label="Summary" value={v.summary} onChange={(e) => f.set("summary", e.target.value)} />
          </div>
        </Panel>
        <Panel title="Description"><BlocksEditor value={v.blocks} onChange={(b) => f.set("blocks", b)} /></Panel>
        <Panel title="Requirements"><TextArea label="One per line" value={v.requirements} rows={6} onChange={(e) => f.set("requirements", e.target.value)} /></Panel>
        <Panel title="Publishing">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput label="Status" value={v.status} options={JOB_STATUS} onChange={(e) => f.set("status", e.target.value)} />
            <TextInput label="Order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", Number(e.target.value))} />
            <div className="self-end"><CheckboxInput label="Featured" checked={v.featured} onChange={(c) => f.set("featured", c)} /></div>
          </div>
        </Panel>
      </div>
      <SaveBar state={f.state} dirty={f.dirty || slug.slug !== loadedSlug} error={f.error} onSave={save} />
    </div>
  );
}
