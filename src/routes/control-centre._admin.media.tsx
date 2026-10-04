import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, MEDIA_BUCKET, publicUrl } from "@/lib/supabase/cms";
import { PageHeader, AdminButton, ConfirmButton, LoadingRow, ErrorNote, EmptyState, friendlyError } from "@/components/admin/cms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/media")({
  head: () => adminHead("Media"),
  component: MediaPage,
});

const FOLDERS = ["brand", "services", "portfolio"] as const;
const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as Record<string, string>;
const MAX_BYTES = 10 * 1024 * 1024;

function safeName(name: string, ext: string) {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
  return `${base}-${Date.now().toString(36)}.${ext}`;
}

function MediaPage() {
  const qc = useQueryClient();
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]>("brand");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const key = ["cms", "media", folder];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data ?? []).filter((o) => o.id && !o.name.startsWith("."));
    },
  });
  const missingBucket = q.error && /not found/i.test((q.error as Error).message);

  async function onFiles(files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const ext = ALLOWED[file.type];
      if (!ext) { toast.error(`${file.name}: only JPG, PNG, WebP or AVIF images are allowed.`); continue; }
      if (file.size > MAX_BYTES) { toast.error(`${file.name}: larger than 10 MB.`); continue; }
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(`${folder}/${safeName(file.name, ext)}`, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
      if (error) toast.error(`${file.name}: ${friendlyError(error)}`);
      else ok++;
    }
    setUploading(false);
    if (input.current) input.current.value = "";
    if (ok) toast.success(`${ok} image${ok > 1 ? "s" : ""} uploaded`);
    qc.invalidateQueries({ queryKey: key });
  }

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success("Public URL copied"); }
    catch { toast.error("Couldn't copy. Select and copy the URL manually."); }
  }

  async function remove(name: string) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([`${folder}/${name}`]);
    if (error) return void toast.error(friendlyError(error));
    toast.success("File deleted");
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Website"
        title="Media"
        description="Public images for the website only. Never upload private client or applicant documents here."
        actions={
          <>
            <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <AdminButton variant="primary" disabled={uploading || !!missingBucket} onClick={() => input.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {uploading ? "Uploading…" : `Upload to ${folder}/`}
            </AdminButton>
          </>
        }
      />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-border">
        {FOLDERS.map((f) => (
          <button key={f} role="tab" aria-selected={folder === f} onClick={() => setFolder(f)}
            className={cn("text-small -mb-px border-b-2 px-3 py-2", folder === f ? "border-accent font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {f}/
          </button>
        ))}
      </div>
      <p className="text-caption mb-4 text-muted-foreground">JPG, PNG, WebP or AVIF · max 10 MB. SVG is not accepted because SVG files can contain scripts.</p>
      {q.isLoading && <LoadingRow />}
      {missingBucket && (
        <ErrorNote>The "site-public" storage bucket doesn't exist. Create it in Supabase → Storage as a Public bucket, then reload.</ErrorNote>
      )}
      {q.error && !missingBucket && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data?.length === 0 && <EmptyState>No images in {folder}/ yet.</EmptyState>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {q.data?.map((o) => {
          const url = publicUrl(`${folder}/${o.name}`);
          const size = (o.metadata as { size?: number } | null)?.size;
          return (
            <li key={o.id} className="overflow-hidden rounded-md border border-border bg-surface">
              <button className="block aspect-square w-full bg-muted" onClick={() => setPreview(url)} aria-label={`Preview ${o.name}`}>
                <img src={url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
              <div className="p-2.5">
                <p className="text-caption truncate font-medium" title={o.name}>{o.name}</p>
                {size ? <p className="text-caption text-muted-foreground">{Math.round(size / 1024)} KB</p> : null}
                <div className="mt-2 flex gap-1.5">
                  <AdminButton size="sm" onClick={() => copy(url)}><Copy className="size-3.5" aria-hidden /> URL</AdminButton>
                  <ConfirmButton title="Delete this image?" description="Anything on the website using this URL will show a broken image." onConfirm={() => remove(o.name)}>Delete</ConfirmButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {preview && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-6" onClick={() => setPreview(null)}>
          <div className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt="" className="max-h-[75vh] rounded-sm object-contain" />
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm bg-surface p-2">
              <code className="text-caption min-w-0 flex-1 truncate">{preview}</code>
              <AdminButton size="sm" onClick={() => copy(preview)}><Copy className="size-3.5" aria-hidden /> Copy URL</AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => setPreview(null)}>Close</AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
