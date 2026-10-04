import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/supabase/cms";
import { Panel, AdminButton, TextInput, ConfirmButton, EmptyState, formatDate, friendlyError } from "@/components/admin/cms";
import { formatSize, openSignedFile } from "@/lib/client-data";

/** Share files privately with one client account (client-private/files/<client id>/...). */
export function ClientFilesPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ["cms", "client-files", clientId];
  const q = useQuery({ queryKey: key, queryFn: () => must(supabase.from("client_files").select("*").eq("client_user_id", clientId).order("created_at", { ascending: false })) });

  async function upload() {
    if (!file || !title.trim() || busy) return;
    if (file.size > 25 * 1024 * 1024) return void toast.error("Maximum size is 25 MB");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `files/${clientId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("client-private").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (up.error) { setBusy(false); return void toast.error(friendlyError(up.error)); }
    const ins = await supabase.from("client_files").insert({ client_user_id: clientId, title: title.trim().slice(0, 200), storage_path: path, file_name: file.name.slice(0, 200), mime_type: file.type || null, file_size: file.size, uploaded_by: u.user?.id ?? null });
    setBusy(false);
    if (ins.error) { await supabase.storage.from("client-private").remove([path]); return void toast.error(friendlyError(ins.error)); }
    setTitle(""); setFile(null);
    toast.success("File shared");
    qc.invalidateQueries({ queryKey: key });
  }
  async function remove(id: string, path: string) {
    const { error } = await supabase.from("client_files").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    await supabase.storage.from("client-private").remove([path]);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Panel title="Shared files" description="Only this client and sales staff can open these.">
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="file" aria-label="File" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-small" />
        <AdminButton variant="primary" disabled={busy || !file || !title.trim()} onClick={upload}>{busy ? "Uploading…" : "Share"}</AdminButton>
      </div>
      {q.data?.length === 0 && <EmptyState>No files shared yet.</EmptyState>}
      <ul className="divide-y divide-border">
        {(q.data ?? []).map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="text-small font-medium">{f.title}</p><p className="text-caption text-muted-foreground">{f.file_name} · {formatSize(f.file_size)} · {formatDate(f.created_at)}</p></div>
            <div className="flex gap-2">
              <AdminButton size="sm" onClick={() => openSignedFile(f.storage_path).catch(() => toast.error("Couldn't open the file."))}>Open</AdminButton>
              <ConfirmButton title="Remove this file?" description="The client will no longer be able to download it." confirmLabel="Remove" onConfirm={() => remove(f.id, f.storage_path)}>Remove</ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
