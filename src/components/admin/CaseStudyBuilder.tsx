import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { must } from "@/lib/supabase/cms";
import {
  AdminButton, CheckboxInput, ConfirmButton, EmptyState, ErrorNote, LoadingRow, Panel, SelectInput, TextArea, TextInput, friendlyError, swapped, useFormState,
} from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { LAYOUTS, SECTION_TYPES, TONES, editableConfig, parseCaseConfig, sectionMeta, type CaseConfig, type CaseMedia } from "@/lib/case-study";

type Row = Tables<"portfolio_case_sections">;
const typeLabel = (t: string) => sectionMeta(t)?.label ?? t;

/** Modular case-study builder: ordered sections per project, each with a validated config. */
export function CaseStudyBuilder({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["cms", "case_sections", projectId];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("portfolio_case_sections").select("*").eq("project_id", projectId).order("sort_order")) });
  const [open, setOpen] = useState<string | null>(null);
  const [newType, setNewType] = useState<string>("rich_text");
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const rows = q.data ?? [];

  async function add(type: string, from?: Row) {
    const max = Math.max(0, ...rows.map((r) => r.sort_order));
    const { data, error } = await supabase.from("portfolio_case_sections").insert({
      project_id: projectId, section_type: type, sort_order: max + 10, is_visible: from ? from.is_visible : true,
      eyebrow: from?.eyebrow ?? null, title: from?.title ?? null, body: from?.body ?? null, config: (from?.config ?? {}) as Json,
    }).select("id").single();
    if (error) return void toast.error(friendlyError(error));
    await refresh();
    setOpen(data.id);
    toast.success(from ? "Section duplicated" : "Section added");
  }
  async function move(i: number, d: -1 | 1) {
    const order = swapped(rows.map((r) => r.id), i, i + d);
    const res = await Promise.all(order.map((id, idx) => supabase.from("portfolio_case_sections").update({ sort_order: (idx + 1) * 10 }).eq("id", id)));
    const err = res.find((r) => r.error)?.error;
    if (err) toast.error(friendlyError(err));
    refresh();
  }
  async function toggle(r: Row) {
    const { error } = await supabase.from("portfolio_case_sections").update({ is_visible: !r.is_visible }).eq("id", r.id);
    if (error) toast.error(friendlyError(error));
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("portfolio_case_sections").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Section deleted");
    refresh();
  }

  return (
    <Panel title="Case study sections" description="Shown on the public page in this order. Only sections you add appear. If there are none, the older text fields and project media are used.">
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {!q.isLoading && rows.length === 0 && <EmptyState>No sections yet. Add the first one below.</EmptyState>}
      <ol className="grid gap-2">
        {rows.map((r, i) => (
          <li key={r.id} className={`rounded-sm border border-border ${r.is_visible ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="text-caption w-6 font-mono text-muted-foreground">{i + 1}</span>
              <span className="text-caption rounded-sm bg-muted px-1.5 py-0.5 font-mono">{typeLabel(r.section_type)}</span>
              <span className="text-small min-w-0 flex-1 truncate font-medium">{r.title || r.eyebrow || "Untitled"}</span>
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label={r.is_visible ? "Hide" : "Show"} onClick={() => toggle(r)}>{r.is_visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Duplicate" onClick={() => add(r.section_type, r)}><Copy className="size-3.5" /></AdminButton>
              <AdminButton size="sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Close" : "Edit"}</AdminButton>
              <ConfirmButton title="Delete this section?" description="It is removed from the case study. This can't be undone." confirmLabel="Delete" onConfirm={() => remove(r.id)}>Delete</ConfirmButton>
            </div>
            {open === r.id && <SectionForm row={r} onDone={() => { refresh(); }} />}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <SelectInput label="Section type" className="min-w-60 flex-1" value={newType} onChange={(e) => setNewType(e.target.value)} options={SECTION_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <AdminButton variant="primary" onClick={() => add(newType)}><Plus className="size-4" aria-hidden /> Add section</AdminButton>
      </div>
    </Panel>
  );
}

function SectionForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const meta = sectionMeta(row.section_type);
  const f = useFormState({ eyebrow: row.eyebrow ?? "", title: row.title ?? "", body: row.body ?? "", is_visible: row.is_visible, config: editableConfig(row.config) });
  const v = f.values;
  const c = v.config;
  const setC = (patch: Partial<CaseConfig>) => f.set("config", { ...c, ...patch });
  const setMedia = (media: CaseMedia[]) => setC({ media });
  const maxMedia = meta?.media ?? 0;

  async function save() {
    if (f.state === "saving") return;
    const bad = c.media.find((m) => m.url && !parseCaseConfig({ media: [m] }).media.length);
    if (bad) return f.fail(`Media URL must be https${bad.type === "vimeo" ? " and a valid Vimeo link" : ""}.`);
    f.begin();
    const clean = parseCaseConfig(c, row.section_type);
    const { error } = await supabase.from("portfolio_case_sections").update({
      eyebrow: v.eyebrow.trim() || null, title: v.title.trim() || null, body: v.body.trim() || null, is_visible: v.is_visible, config: clean as unknown as Json,
    }).eq("id", row.id);
    if (error) return f.fail(friendlyError(error));
    f.markSaved({ ...v, config: clean });
    toast.success("Section saved");
    onDone();
  }

  return (
    <div className="grid gap-4 border-t border-border bg-background/60 p-4 md:grid-cols-2">
      <TextInput label="Eyebrow" value={v.eyebrow} onChange={(e) => f.set("eyebrow", e.target.value)} />
      <TextInput label="Title" value={v.title} onChange={(e) => f.set("title", e.target.value)} />
      <TextArea label={meta?.quote ? "Quote (exact words from the client)" : "Text"} rows={5} value={v.body} onChange={(e) => f.set("body", e.target.value)} className="md:col-span-2" />
      <SelectInput label="Layout" value={c.layout} options={LAYOUTS.map((l) => ({ value: l, label: l }))} onChange={(e) => setC({ layout: e.target.value as CaseConfig["layout"] })} />
      <SelectInput label="Background" value={c.tone} options={TONES.map((t) => ({ value: t, label: t }))} onChange={(e) => setC({ tone: e.target.value as CaseConfig["tone"] })} />
      <CheckboxInput label="Visible on website" checked={v.is_visible} onChange={(b) => f.set("is_visible", b)} />

      {meta?.quote && (
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <TextInput label="Client name" value={c.quote_name} onChange={(e) => setC({ quote_name: e.target.value })} />
          <TextInput label="Designation" value={c.quote_role} onChange={(e) => setC({ quote_role: e.target.value })} />
          <TextInput label="Company" value={c.quote_company} onChange={(e) => setC({ quote_company: e.target.value })} />
          <div className="flex items-end gap-2">
            <TextInput label="Avatar / logo URL (optional)" className="flex-1" value={c.quote_avatar} onChange={(e) => setC({ quote_avatar: e.target.value })} />
            <UploadImageButton label="Upload" onUploaded={(u) => setC({ quote_avatar: u })} />
          </div>
          <p className="text-caption text-muted-foreground md:col-span-2">Only publish real feedback the client has approved.</p>
        </div>
      )}

      {meta?.beforeAfter && (
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <div className="flex items-end gap-2"><TextInput label="Before image URL" className="flex-1" value={c.before_url} onChange={(e) => setC({ before_url: e.target.value })} /><UploadImageButton label="Upload" onUploaded={(u) => setC({ before_url: u })} /></div>
          <div className="flex items-end gap-2"><TextInput label="After image URL" className="flex-1" value={c.after_url} onChange={(e) => setC({ after_url: e.target.value })} /><UploadImageButton label="Upload" onUploaded={(u) => setC({ after_url: u })} /></div>
          <TextInput label="Before alt text" value={c.before_alt} onChange={(e) => setC({ before_alt: e.target.value })} />
          <TextInput label="After alt text" value={c.after_alt} onChange={(e) => setC({ after_alt: e.target.value })} />
        </div>
      )}

      {meta?.items && (
        <div className="grid gap-2 md:col-span-2">
          <p className="text-small font-medium">{meta.items === "steps" ? "Steps" : "Facts"}</p>
          {meta.items === "facts" && <p className="text-caption text-muted-foreground">Leave empty to show the project's client, industry, services, timeline and year automatically.</p>}
          {c.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
              <TextInput label={meta.items === "steps" ? "Step" : "Label"} value={it.label} onChange={(e) => setC({ items: c.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <TextInput label={meta.items === "steps" ? "Description" : "Value"} value={it.value} onChange={(e) => setC({ items: c.items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <div className="flex gap-1 pb-1">
                <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => setC({ items: swapped(c.items, i, i - 1) })}><ArrowUp className="size-3.5" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Remove" onClick={() => setC({ items: c.items.filter((_, j) => j !== i) })}><X className="size-3.5" /></AdminButton>
              </div>
            </div>
          ))}
          {c.items.length < 12 && <AdminButton size="sm" onClick={() => setC({ items: [...c.items, { label: "", value: "" }] })}><Plus className="size-3.5" aria-hidden /> Add</AdminButton>}
        </div>
      )}

      {maxMedia > 0 && (
        <div className="grid gap-2 md:col-span-2">
          <p className="text-small font-medium">Media <span className="text-caption text-muted-foreground">(up to {maxMedia})</span></p>
          {c.media.map((m, i) => (
            <div key={i} className="grid gap-2 rounded-sm border border-border p-3 md:grid-cols-[8rem_1fr_auto]">
              <div className="grid size-full min-h-16 place-items-center overflow-hidden rounded-sm bg-muted">
                {m.type === "image" && m.url ? <img src={m.url} alt="" className="max-h-24 w-full object-cover" /> : m.poster ? <img src={m.poster} alt="" className="max-h-24 w-full object-cover" /> : <span className="text-caption font-mono">{m.type}</span>}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <SelectInput label="Type" value={m.type} options={[{ value: "image", label: "image" }, { value: "vimeo", label: "vimeo" }, { value: "video", label: "video file" }]} onChange={(e) => setMedia(c.media.map((x, j) => (j === i ? { ...x, type: e.target.value as CaseMedia["type"] } : x)))} />
                <div className="flex items-end gap-2">
                  <TextInput label={m.type === "vimeo" ? "Vimeo link" : "URL"} className="flex-1" value={m.url} onChange={(e) => setMedia(c.media.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  {m.type === "image" && <UploadImageButton label="Upload" onUploaded={(u) => setMedia(c.media.map((x, j) => (j === i ? { ...x, url: u } : x)))} />}
                </div>
                {m.type !== "image" && <TextInput label="Poster URL (optional)" value={m.poster} onChange={(e) => setMedia(c.media.map((x, j) => (j === i ? { ...x, poster: e.target.value } : x)))} />}
                <TextInput label="Alt text" value={m.alt} onChange={(e) => setMedia(c.media.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                <TextInput label="Caption" value={m.caption} onChange={(e) => setMedia(c.media.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
              </div>
              <div className="flex gap-1 md:flex-col">
                <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => setMedia(swapped(c.media, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === c.media.length - 1} onClick={() => setMedia(swapped(c.media, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Remove" onClick={() => setMedia(c.media.filter((_, j) => j !== i))}><X className="size-3.5" /></AdminButton>
              </div>
            </div>
          ))}
          {c.media.length < maxMedia && (
            <AdminButton size="sm" onClick={() => setMedia([...c.media, { type: row.section_type === "full_video" ? "vimeo" : "image", url: "", poster: "", alt: "", caption: "" }])}><Plus className="size-3.5" aria-hidden /> Add media</AdminButton>
          )}
        </div>
      )}

      {row.section_type === "credits" && <p className="text-caption text-muted-foreground md:col-span-2">Shows the people from the Team & Credits tab.</p>}

      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" onClick={save} disabled={f.state === "saving" || !f.dirty}>{f.state === "saving" ? "Saving…" : "Save section"}</AdminButton>
        {f.state === "error" && <span className="text-caption text-destructive" role="alert">{f.error}</span>}
      </div>
    </div>
  );
}
