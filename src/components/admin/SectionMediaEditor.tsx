import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET, publicUrl } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, ConfirmButton, SelectInput, TextInput, friendlyError } from "@/components/admin/cms";
import { SectionMedia } from "@/components/media/SectionMedia";
import { PRIORITY_OPTIONS } from "@/components/media/BrantaVideo";
import { vimeoId } from "@/lib/hero";
import { ASPECTS, POSITIONS, isDirectVideo, isImageUrl, isRenderable, newMediaItem, type Aspect, type SectionMediaItem } from "@/lib/section-media";

const IMG: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const VID: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const FOLDERS = ["home", "portfolio", "brand", "services"];
const ASPECT_LABEL: Record<string, string> = { "16:9": "16:9", "4:5": "4:5", "1:1": "1:1 square", "4:3": "4:3", portrait: "Portrait 9:16", wide: "Wide 21:9", full: "Fill area" };

async function uploadFile(file: File, kind: "image" | "video"): Promise<string | null> {
  const ext = (kind === "image" ? IMG : VID)[file.type];
  if (!ext) { toast.error(kind === "image" ? "Only JPG, PNG, WebP or AVIF images." : "Only MP4 or WebM videos."); return null; }
  if (file.size > (kind === "image" ? 10 : 50) * 1024 * 1024) { toast.error(kind === "image" ? "Image is larger than 10 MB." : "Video is larger than 50 MB — use Vimeo for longer films."); return null; }
  const base = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || kind;
  const path = `home/${base}-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) { toast.error(friendlyError(error)); return null; }
  toast.success("Uploaded");
  return publicUrl(path);
}

function UploadBtn({ kind, label, onDone }: { kind: "image" | "video"; label: string; onDone: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" className="sr-only" tabIndex={-1} accept={Object.keys(kind === "image" ? IMG : VID).join(",")}
        onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); const u = await uploadFile(f, kind); setBusy(false); if (ref.current) ref.current.value = ""; if (u) onDone(u); }} />
      <AdminButton size="sm" variant="ghost" disabled={busy} onClick={() => ref.current?.click()}><Upload className="size-3.5" aria-hidden /> {busy ? "Uploading…" : label}</AdminButton>
    </>
  );
}

/** Pick an existing file from the site media library (site-public). */
function LibraryPicker({ kind, onPick }: { kind: "image" | "video"; onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState("home");
  const [files, setFiles] = useState<string[] | null>(null);
  async function load(f: string) {
    setFolder(f); setFiles(null);
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(f, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) { toast.error(friendlyError(error)); setFiles([]); return; }
    const re = kind === "image" ? /\.(jpe?g|png|webp|avif|gif|svg)$/i : /\.(mp4|webm)$/i;
    setFiles((data ?? []).filter((o) => o.id && re.test(o.name)).map((o) => publicUrl(`${f}/${o.name}`)));
  }
  if (!open) return <AdminButton size="sm" variant="ghost" onClick={() => { setOpen(true); load(folder); }}><Images className="size-3.5" aria-hidden /> Choose from library</AdminButton>;
  return (
    <div className="grid w-full gap-2 rounded-sm border border-border p-3">
      <div className="flex flex-wrap items-center gap-1">
        {FOLDERS.map((f) => <AdminButton key={f} size="sm" variant={f === folder ? "primary" : "ghost"} onClick={() => load(f)}>{f}</AdminButton>)}
        <AdminButton size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</AdminButton>
      </div>
      {files === null ? <p className="text-caption text-muted-foreground">Loading…</p> : files.length === 0 ? <p className="text-caption text-muted-foreground">No {kind === "image" ? "images" : "videos"} in this folder.</p> : (
        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
          {files.map((u) => (
            <button key={u} type="button" onClick={() => { onPick(u); setOpen(false); }} className="aspect-video overflow-hidden rounded-sm border border-border bg-muted hover:border-accent" title={u.split("/").pop()}>
              {kind === "image" ? <img src={u} alt="" loading="lazy" className="size-full object-cover" /> : <span className="text-caption block truncate p-2">{u.split("/").pop()}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Reusable Control Centre editor for a section's config.media_items (image / video / Vimeo).
 * Add, switch type, upload or pick from library, preview, reorder, hide/show, delete (config only — storage files are kept).
 */
export function SectionMediaEditor({ items, onChange, max = 12, defaultAspect = "16:9", aspects, title = "Media", hint }: {
  items: SectionMediaItem[]; onChange: (items: SectionMediaItem[]) => void; max?: number; defaultAspect?: Aspect;
  aspects?: readonly Aspect[]; title?: string; hint?: string;
}) {
  const set = (n: SectionMediaItem[]) => onChange(n.map((m, i) => ({ ...m, sort_order: i })));
  const upd = (i: number, p: Partial<SectionMediaItem>) => set(items.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const move = (i: number, j: number) => { const n = [...items]; [n[i], n[j]] = [n[j]!, n[i]!]; set(n); };
  const aspectOpts = (aspects ?? ASPECTS).map((a) => ({ value: a, label: ASPECT_LABEL[a] ?? a }));

  return (
    <div className="grid gap-3 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">{title}</p>
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
      {items.length === 0 && <p className="text-small rounded-sm border border-dashed border-border p-4 text-muted-foreground">No media yet. Click "Add media".</p>}
      {items.map((m, i) => {
        const urlErr = m.url && (m.type === "vimeo" ? !vimeoId(m.url) && "Not a recognised Vimeo link." : m.type === "video" ? !isDirectVideo(m.url) && "Use an https .mp4 or .webm link." : !isImageUrl(m.url) && "Use an HTTPS image or a bundled image path.");
        return (
          <div key={m.id} className="grid gap-3 rounded-sm border border-border p-3 md:grid-cols-[220px_1fr]">
            <div className="grid content-start gap-2">
              {isRenderable(m) ? <SectionMedia item={{ ...m, aspect: "16:9", autoplay: false }} className="rounded-sm" /> : <div className="text-caption flex aspect-video items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground">No preview</div>}
              {m.type !== "image" && isRenderable(m) && <a href={m.type === "vimeo" ? `https://vimeo.com/${vimeoId(m.url)}` : m.url} target="_blank" rel="noreferrer" className="text-caption text-accent underline">Open video</a>}
              {!m.enabled && <span className="text-caption text-muted-foreground">Hidden on website</span>}
            </div>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-small font-medium">{m.label || `Media ${i + 1}`}</p>
                <div className="flex flex-wrap gap-1">
                  <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, i - 1)}>Up</AdminButton>
                  <AdminButton size="sm" variant="ghost" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>Down</AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={() => upd(i, { enabled: !m.enabled })}>{m.enabled ? "Hide" : "Show"}</AdminButton>
                  <ConfirmButton title="Remove this media item?" description="It is removed from this section after you save. The uploaded file stays in the media library and other content is not affected." confirmLabel="Remove" onConfirm={() => set(items.filter((_, j) => j !== i))}>Delete</ConfirmButton>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectInput label="Media type" value={m.type} onChange={(e) => upd(i, { type: e.target.value as SectionMediaItem["type"] })}
                  options={[{ value: "image", label: "Image" }, { value: "video", label: "Direct video (.mp4/.webm)" }, { value: "vimeo", label: "Vimeo" }]} />
                <SelectInput label="Display size" value={m.aspect} onChange={(e) => upd(i, { aspect: e.target.value as Aspect })} options={aspectOpts} />
                <SelectInput label="Focal point" value={m.position} onChange={(e) => upd(i, { position: e.target.value as SectionMediaItem["position"] })} options={POSITIONS.map((p) => ({ value: p, label: p[0]!.toUpperCase() + p.slice(1) }))} />
              </div>
              <TextInput label={m.type === "vimeo" ? "Vimeo URL" : m.type === "video" ? "Video URL" : "Image URL"} value={m.url} error={urlErr || undefined}
                placeholder={m.type === "vimeo" ? "https://vimeo.com/123456789" : "https://…"} onChange={(e) => upd(i, { url: e.target.value })} />
              {m.type !== "vimeo" && <div className="flex flex-wrap gap-2">
                <UploadBtn kind={m.type === "video" ? "video" : "image"} label={m.url ? "Replace file" : "Upload"} onDone={(url) => upd(i, { url })} />
                <LibraryPicker kind={m.type === "video" ? "video" : "image"} onPick={(url) => upd(i, { url })} />
              </div>}
              {m.type !== "image" && <>
                <TextInput label="Poster / thumbnail URL" hint="Shown immediately and kept if the video can't play." value={m.poster_url} error={m.poster_url && !isImageUrl(m.poster_url) ? "Use an HTTPS image or a bundled image path." : undefined} onChange={(e) => upd(i, { poster_url: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <UploadBtn kind="image" label="Upload poster" onDone={(poster_url) => upd(i, { poster_url })} />
                  <LibraryPicker kind="image" onPick={(poster_url) => upd(i, { poster_url })} />
                </div>
                <div className="flex flex-wrap gap-4">
                  <CheckboxInput label="Autoplay (always muted)" checked={m.autoplay} onChange={(autoplay) => upd(i, { autoplay, muted: autoplay ? true : m.muted })} />
                  <CheckboxInput label="Loop" checked={m.loop} onChange={(loop) => upd(i, { loop })} />
                  <CheckboxInput label="Muted" checked={m.muted || m.autoplay} onChange={(muted) => upd(i, { muted })} />
                  <CheckboxInput label="Show sound control" checked={m.sound_control} onChange={(sound_control) => upd(i, { sound_control })} />
                </div>
                <SelectInput label="Loading" hint="Automatic picks the best option for this section." value={m.priority} onChange={(e) => upd(i, { priority: e.target.value as SectionMediaItem["priority"] })}
                  options={PRIORITY_OPTIONS.map(([value, label]) => ({ value, label }))} />
              </>}
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="Alt text" hint="Describe the image for screen readers. Leave empty only if purely decorative." value={m.alt} onChange={(e) => upd(i, { alt: e.target.value })} />
                <TextInput label="Label (optional)" value={m.label} onChange={(e) => upd(i, { label: e.target.value })} />
              </div>
              <TextInput label="Caption (optional)" value={m.caption} onChange={(e) => upd(i, { caption: e.target.value })} />
              <CheckboxInput label="Visible on website" checked={m.enabled} onChange={(enabled) => upd(i, { enabled })} />
            </div>
          </div>
        );
      })}
      {items.length < max && <AdminButton size="sm" variant="ghost" onClick={() => set([...items, newMediaItem(defaultAspect)])}>+ Add media</AdminButton>}
    </div>
  );
}
