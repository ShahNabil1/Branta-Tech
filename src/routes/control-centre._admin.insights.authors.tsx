import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, PageHeader, TextArea, TextInput, friendlyError, nullIfEmpty } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { SimpleCrud } from "@/components/admin/SimpleCrud";
import { isHttps } from "@/lib/rich-text";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/control-centre/_admin/insights/authors")({
  head: () => adminHead("Authors"),
  component: AuthorsPage,
});

type A = Tables<"authors">;

function AuthorsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cms", "authors-full"], queryFn: () => must(supabase.from("authors").select("*").order("sort_order").order("name")) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["cms"] });
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Insights" title="Authors" description="Authors shown on articles. They don't need a Control Centre account." actions={<Link to="/control-centre/insights"><AdminButton>Back to Insights</AdminButton></Link>} />
      <SimpleCrud<A>
        rows={q.data} loading={q.isLoading} error={q.error} empty="No authors yet." newLabel="Add author"
        renderRow={(a) => <><p className="text-small font-medium">{a.name}{!a.is_active && <span className="text-muted-foreground"> · inactive</span>}</p>{a.role && <p className="text-caption text-muted-foreground">{a.role}</p>}</>}
        renderForm={(a, close) => <AuthorForm a={a} onSaved={() => { refresh(); close(); }} nextOrder={(q.data?.length ?? 0) * 10} />}
        onDelete={async (a) => { const { error } = await supabase.from("authors").delete().eq("id", a.id); if (error) toast.error(friendlyError(error)); else { toast.success("Author deleted"); refresh(); } }}
        onMove={async (i, d) => {
          const rows = q.data ?? []; const a = rows[i], b = rows[i + d]; if (!a || !b) return;
          await Promise.all([supabase.from("authors").update({ sort_order: i + d }).eq("id", a.id), supabase.from("authors").update({ sort_order: i }).eq("id", b.id)]);
          refresh();
        }}
      />
    </div>
  );
}

function AuthorForm({ a, onSaved, nextOrder }: { a: A | null; onSaved: () => void; nextOrder: number }) {
  const [v, setV] = useState({ name: a?.name ?? "", role: a?.role ?? "", photo_url: a?.photo_url ?? "", bio: a?.bio ?? "", profile_url: a?.profile_url ?? "", is_active: a?.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const photoErr = v.photo_url && !isHttps(v.photo_url) ? "Must start with https://" : null;
  const profErr = v.profile_url && !/^https?:\/\/\S+$/.test(v.profile_url) ? "Use a full link" : null;
  async function save() {
    if (!v.name.trim() || photoErr || profErr) return void toast.error("Check the fields.");
    setBusy(true);
    const payload = { name: v.name.trim(), role: nullIfEmpty(v.role), photo_url: nullIfEmpty(v.photo_url), bio: nullIfEmpty(v.bio), profile_url: nullIfEmpty(v.profile_url), is_active: v.is_active };
    const { error } = a ? await supabase.from("authors").update(payload).eq("id", a.id) : await supabase.from("authors").insert({ ...payload, sort_order: nextOrder });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Author saved");
    onSaved();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Name" value={v.name} onChange={(e) => set("name", e.target.value)} />
      <TextInput label="Role" value={v.role} onChange={(e) => set("role", e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <TextInput className="min-w-0 flex-1" label="Photo URL" value={v.photo_url} error={photoErr} onChange={(e) => set("photo_url", e.target.value)} />
        <UploadImageButton label="Upload" onUploaded={(u) => set("photo_url", u)} />
      </div>
      <TextArea label="Bio" value={v.bio} onChange={(e) => set("bio", e.target.value)} />
      <TextInput label="Profile link (optional)" value={v.profile_url} error={profErr} onChange={(e) => set("profile_url", e.target.value)} />
      <CheckboxInput label="Active" hint="Inactive authors are hidden on articles." checked={v.is_active} onChange={(c) => set("is_active", c)} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save author"}</AdminButton>
    </div>
  );
}
