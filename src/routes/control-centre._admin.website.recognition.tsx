import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, PageHeader, SelectInput, TextArea, TextInput, friendlyError, nullIfEmpty } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { SimpleCrud } from "@/components/admin/SimpleCrud";
import { RECOGNITION_TYPES, defaultLabel, isLogoUrl } from "@/lib/recognition";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/control-centre/_admin/website/recognition")({
  head: () => adminHead("Recognition"),
  component: RecognitionAdmin,
});

type R = Tables<"site_recognitions">;

function RecognitionAdmin() {
  const qc = useQueryClient();
  const key = ["cms", "recognitions"];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("site_recognitions").select("*").order("sort_order").order("created_at")) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["public", "recognition"] }); };
  async function patch(id: string, p: Partial<R>, msg: string) {
    const { error } = await supabase.from("site_recognitions").update(p).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg); refresh();
  }
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Website" title="Recognition"
        description="Published funding, awards and recognition appear on the homepage after Client Stories. The section hides when nothing is published. Heading and CTA are edited under Pages → Home → recognition." />
      <SimpleCrud<R>
        rows={q.data} loading={q.isLoading} error={q.error} empty="No recognitions yet." newLabel="Add recognition"
        renderRow={(r) => (
          <div className="flex items-center gap-3">
            {r.logo_url ? <img src={r.logo_url} alt="" className="h-10 w-16 rounded-sm bg-background object-contain" /> : <span className="grid h-10 w-16 place-items-center rounded-sm bg-muted text-small">{r.organization.charAt(0)}</span>}
            <div className="min-w-0">
              <p className="text-small font-medium">{r.organization}</p>
              <p className="text-caption text-muted-foreground">{r.label || defaultLabel(r.type)} · {r.is_published ? "Published" : "Draft"}</p>
            </div>
            <AdminButton className="ml-auto" size="sm" variant="ghost" onClick={() => patch(r.id, { is_published: !r.is_published }, r.is_published ? "Hidden" : "Published")}>{r.is_published ? "Unpublish" : "Publish"}</AdminButton>
          </div>
        )}
        renderForm={(r, close) => <Form r={r} nextOrder={((q.data?.length ?? 0) + 1) * 10} onSaved={() => { refresh(); close(); }} />}
        onDelete={async (r) => { const { error } = await supabase.from("site_recognitions").delete().eq("id", r.id); if (error) toast.error(friendlyError(error)); else { toast.success("Deleted"); refresh(); } }}
        onMove={async (i, d) => {
          const rows = q.data ?? []; const a = rows[i], b = rows[i + d]; if (!a || !b) return;
          await Promise.all([supabase.from("site_recognitions").update({ sort_order: (i + d + 1) * 10 }).eq("id", a.id), supabase.from("site_recognitions").update({ sort_order: (i + 1) * 10 }).eq("id", b.id)]);
          refresh();
        }}
      />
    </div>
  );
}

function Form({ r, onSaved, nextOrder }: { r: R | null; onSaved: () => void; nextOrder: number }) {
  const [v, setV] = useState({
    type: r?.type ?? "recognition", label: r?.label ?? "", organization: r?.organization ?? "", title: r?.title ?? "",
    description: r?.description ?? "", year: r?.year ?? "", logo_url: r?.logo_url ?? "", external_url: r?.external_url ?? "",
    sort_order: String(r?.sort_order ?? nextOrder), is_published: r?.is_published ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const errs = {
    logo: v.logo_url && !isLogoUrl(v.logo_url) ? "Use an uploaded logo or https:// link" : null,
    link: v.external_url && !/^https:\/\/\S+$/.test(v.external_url) ? "Must start with https://" : null,
  };
  async function save() {
    if (!v.organization.trim()) return void toast.error("Organization is required.");
    if (errs.logo || errs.link) return void toast.error("Check the link fields.");
    setBusy(true);
    const payload = {
      type: v.type, label: nullIfEmpty(v.label), organization: v.organization.trim(), title: nullIfEmpty(v.title),
      description: nullIfEmpty(v.description), year: nullIfEmpty(v.year), logo_url: nullIfEmpty(v.logo_url),
      external_url: nullIfEmpty(v.external_url), sort_order: Math.round(Number(v.sort_order) || 0), is_published: v.is_published,
    };
    const { error } = r ? await supabase.from("site_recognitions").update(payload).eq("id", r.id) : await supabase.from("site_recognitions").insert(payload);
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Recognition saved"); onSaved();
  }
  return (
    <div className="grid gap-4">
      <SelectInput label="Recognition type" value={v.type} options={RECOGNITION_TYPES.map((t) => ({ value: t.value, label: t.label }))} onChange={(e) => set("type", e.target.value)} />
      <TextInput label="Card label (optional)" placeholder={defaultLabel(v.type)} hint={`Shown above the name. Leave empty to use "${defaultLabel(v.type)}". Only use wording that matches the real relationship.`} value={v.label} onChange={(e) => set("label", e.target.value)} />
      <TextInput label="Organization" required value={v.organization} onChange={(e) => set("organization", e.target.value)} />
      <TextInput label="Program / event title (optional)" hint="Use the exact official name." value={v.title} onChange={(e) => set("title", e.target.value)} />
      <TextArea label="Short description (optional)" value={v.description} onChange={(e) => set("description", e.target.value)} />
      <TextInput label="Year (optional)" value={v.year} onChange={(e) => set("year", e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <TextInput className="min-w-0 flex-1" label="Official logo" hint="Only official logos. Without a logo the name is shown in text." value={v.logo_url} error={errs.logo} onChange={(e) => set("logo_url", e.target.value)} />
        <UploadImageButton label="Upload" onUploaded={(u) => set("logo_url", u)} />
      </div>
      <TextInput label="External link (optional)" value={v.external_url} error={errs.link} onChange={(e) => set("external_url", e.target.value)} />
      <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
      <CheckboxInput label="Published" checked={v.is_published} onChange={(c) => set("is_published", c)} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save recognition"}</AdminButton>
    </div>
  );
}
