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

export const Route = createFileRoute("/control-centre/_admin/team")({
  head: () => adminHead("Team"),
  component: TeamAdmin,
});

type M = Tables<"team_members">;

function TeamAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cms", "team"], queryFn: () => must(supabase.from("team_members").select("*").order("sort_order").order("name")) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["cms", "team"] });
  async function patch(id: string, p: Partial<M>, msg: string) {
    const { error } = await supabase.from("team_members").update(p).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg); refresh();
  }
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Company" title="Team" description="Only published members appear on the Team and About pages." />
      <SimpleCrud<M>
        rows={q.data} loading={q.isLoading} error={q.error} empty="No team members yet." newLabel="Add member"
        renderRow={(m) => (
          <div className="flex items-center gap-3">
            {m.photo_url && isHttps(m.photo_url) ? <img src={m.photo_url} alt="" className="size-10 rounded-sm object-cover" /> : <span className="grid size-10 place-items-center rounded-sm bg-muted text-small">{m.name.charAt(0)}</span>}
            <div className="min-w-0">
              <p className="text-small font-medium">{m.name}</p>
              <p className="text-caption flex flex-wrap items-center gap-2 text-muted-foreground">{m.role ?? "—"} <StatusBadge status={m.status} />{m.featured && <FeaturedBadge />}</p>
            </div>
            <div className="ml-auto flex gap-1">
              <AdminButton size="sm" variant="ghost" onClick={() => patch(m.id, { status: m.status === "published" ? "draft" : "published" }, m.status === "published" ? "Unpublished" : "Published")}>{m.status === "published" ? "Unpublish" : "Publish"}</AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => patch(m.id, { featured: !m.featured }, m.featured ? "Unfeatured" : "Featured")}>{m.featured ? "Unfeature" : "Feature"}</AdminButton>
            </div>
          </div>
        )}
        renderForm={(m, close) => <MemberForm m={m} nextOrder={(q.data?.length ?? 0) * 10} onSaved={() => { refresh(); close(); }} />}
        onDelete={async (m) => { const { error } = await supabase.from("team_members").delete().eq("id", m.id); if (error) toast.error(friendlyError(error)); else { toast.success("Member deleted"); refresh(); } }}
        onMove={async (i, d) => {
          const rows = q.data ?? []; const a = rows[i], b = rows[i + d]; if (!a || !b) return;
          await Promise.all([supabase.from("team_members").update({ sort_order: (i + d) * 10 }).eq("id", a.id), supabase.from("team_members").update({ sort_order: i * 10 }).eq("id", b.id)]);
          refresh();
        }}
      />
    </div>
  );
}

function MemberForm({ m, onSaved, nextOrder }: { m: M | null; onSaved: () => void; nextOrder: number }) {
  const [v, setV] = useState({
    name: m?.name ?? "", role: m?.role ?? "", photo_url: m?.photo_url ?? "", short_bio: m?.short_bio ?? "", full_bio: m?.full_bio ?? "",
    linkedin_url: m?.linkedin_url ?? "", email: m?.email ?? "", status: m?.status ?? "draft", featured: m?.featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const errs = {
    photo: v.photo_url && !isHttps(v.photo_url) ? "Must start with https://" : null,
    linkedin: v.linkedin_url && !/^https:\/\/(www\.)?linkedin\.com\/\S+$/.test(v.linkedin_url) ? "Use a linkedin.com link" : null,
    email: v.email && !/^\S+@\S+\.\S+$/.test(v.email) ? "Enter a valid email" : null,
  };
  async function save() {
    if (!v.name.trim() || Object.values(errs).some(Boolean)) return void toast.error("Check the fields.");
    setBusy(true);
    const payload = {
      name: v.name.trim(), role: nullIfEmpty(v.role), photo_url: nullIfEmpty(v.photo_url), short_bio: nullIfEmpty(v.short_bio), full_bio: nullIfEmpty(v.full_bio),
      linkedin_url: nullIfEmpty(v.linkedin_url), email: nullIfEmpty(v.email), status: v.status, featured: v.featured,
    };
    const { error } = m ? await supabase.from("team_members").update(payload).eq("id", m.id) : await supabase.from("team_members").insert({ ...payload, sort_order: nextOrder });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Member saved"); onSaved();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Name" value={v.name} onChange={(e) => set("name", e.target.value)} />
      <TextInput label="Role" value={v.role} onChange={(e) => set("role", e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <TextInput className="min-w-0 flex-1" label="Photo URL" value={v.photo_url} error={errs.photo} onChange={(e) => set("photo_url", e.target.value)} />
        <UploadImageButton label="Upload" onUploaded={(u) => set("photo_url", u)} />
      </div>
      <TextArea label="Short bio" value={v.short_bio} onChange={(e) => set("short_bio", e.target.value)} />
      <TextArea label="Full bio (optional)" hint="If set, visitors can open a detail view." value={v.full_bio} onChange={(e) => set("full_bio", e.target.value)} />
      <TextInput label="LinkedIn (optional)" value={v.linkedin_url} error={errs.linkedin} onChange={(e) => set("linkedin_url", e.target.value)} />
      <TextInput label="Email (optional, internal)" hint="Not shown on the public site." value={v.email} error={errs.email} onChange={(e) => set("email", e.target.value)} />
      <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => set("status", e.target.value)} />
      <CheckboxInput label="Featured" hint="Featured members appear in the About page preview." checked={v.featured} onChange={(c) => set("featured", c)} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save member"}</AdminButton>
    </div>
  );
}
