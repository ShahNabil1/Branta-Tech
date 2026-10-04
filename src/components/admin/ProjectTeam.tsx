import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { must } from "@/lib/supabase/cms";
import { AdminButton, ConfirmButton, EmptyState, ErrorNote, LoadingRow, Panel, TextInput, friendlyError, isSafeUrl, nullIfEmpty, swapped, useFormState } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";

type Row = Tables<"portfolio_project_team">;

/** Public project credits (not linked to user accounts). */
export function ProjectTeam({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["cms", "project_team", projectId];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("portfolio_project_team").select("*").eq("project_id", projectId).order("sort_order")) });
  const [open, setOpen] = useState<string | "new" | null>(null);
  const rows = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function move(i: number, d: -1 | 1) {
    const order = swapped(rows.map((r) => r.id), i, i + d);
    const res = await Promise.all(order.map((id, idx) => supabase.from("portfolio_project_team").update({ sort_order: (idx + 1) * 10 }).eq("id", id)));
    const err = res.find((r) => r.error)?.error;
    if (err) toast.error(friendlyError(err));
    refresh();
  }
  async function toggle(r: Row) {
    const { error } = await supabase.from("portfolio_project_team").update({ is_visible: !r.is_visible }).eq("id", r.id);
    if (error) toast.error(friendlyError(error));
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("portfolio_project_team").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Credit removed");
    refresh();
  }

  return (
    <Panel title="Team & credits" description="People credited on the public case study, in this order."
      actions={<AdminButton size="sm" variant="primary" onClick={() => setOpen("new")}><Plus className="size-3.5" aria-hidden /> Add credit</AdminButton>}>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {open === "new" && <CreditForm projectId={projectId} row={null} order={Math.max(0, ...rows.map((r) => r.sort_order)) + 10} onDone={() => { setOpen(null); refresh(); }} />}
      {!q.isLoading && rows.length === 0 && open !== "new" && <EmptyState>No credits yet.</EmptyState>}
      <ul className="mt-2 grid gap-2">
        {rows.map((r, i) => (
          <li key={r.id} className={`rounded-sm border border-border ${r.is_visible ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {r.photo_url ? <img src={r.photo_url} alt="" className="size-9 rounded-full object-cover" /> : <span className="size-9 rounded-full bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="text-small truncate font-medium">{r.member_name}</p>
                <p className="text-caption text-muted-foreground">{r.role}</p>
              </div>
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label={r.is_visible ? "Hide" : "Show"} onClick={() => toggle(r)}>{r.is_visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</AdminButton>
              <AdminButton size="sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Close" : "Edit"}</AdminButton>
              <ConfirmButton title="Remove this credit?" confirmLabel="Remove" onConfirm={() => remove(r.id)}>Remove</ConfirmButton>
            </div>
            {open === r.id && <CreditForm projectId={projectId} row={r} order={r.sort_order} onDone={() => { setOpen(null); refresh(); }} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CreditForm({ projectId, row, order, onDone }: { projectId: string; row: Row | null; order: number; onDone: () => void }) {
  const f = useFormState({ member_name: row?.member_name ?? "", role: row?.role ?? "", photo_url: row?.photo_url ?? "", profile_url: row?.profile_url ?? "" });
  const v = f.values;
  const urlErr = (u: string) => (isSafeUrl(u, { allowInternal: false }) ? null : "Use a full https:// URL.");
  async function save() {
    if (f.state === "saving") return;
    if (!v.member_name.trim() || !v.role.trim()) return f.fail("Name and role are required.");
    if (urlErr(v.photo_url) || urlErr(v.profile_url)) return f.fail("Fix the URL fields.");
    f.begin();
    const payload = { member_name: v.member_name.trim(), role: v.role.trim(), photo_url: nullIfEmpty(v.photo_url), profile_url: nullIfEmpty(v.profile_url) };
    const { error } = row
      ? await supabase.from("portfolio_project_team").update(payload).eq("id", row.id)
      : await supabase.from("portfolio_project_team").insert({ ...payload, project_id: projectId, sort_order: order });
    if (error) return f.fail(friendlyError(error));
    f.markSaved(v);
    toast.success("Credit saved");
    onDone();
  }
  return (
    <div className="grid gap-4 border-t border-border bg-background/60 p-4 md:grid-cols-2">
      <TextInput label="Name" required value={v.member_name} onChange={(e) => f.set("member_name", e.target.value)} />
      <TextInput label="Role" required placeholder="Creative Direction" value={v.role} onChange={(e) => f.set("role", e.target.value)} />
      <div className="flex items-end gap-2">
        <TextInput label="Photo URL (optional)" className="flex-1" value={v.photo_url} error={urlErr(v.photo_url)} onChange={(e) => f.set("photo_url", e.target.value)} />
        <UploadImageButton label="Upload" onUploaded={(u) => f.set("photo_url", u)} />
      </div>
      <TextInput label="Profile URL (optional)" value={v.profile_url} error={urlErr(v.profile_url)} onChange={(e) => f.set("profile_url", e.target.value)} />
      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" onClick={save} disabled={f.state === "saving"}>{f.state === "saving" ? "Saving…" : "Save credit"}</AdminButton>
        <AdminButton variant="ghost" onClick={onDone}>Cancel</AdminButton>
        {f.state === "error" && <span className="text-caption text-destructive" role="alert">{f.error}</span>}
      </div>
    </div>
  );
}
