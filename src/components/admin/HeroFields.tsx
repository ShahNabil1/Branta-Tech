import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { AdminButton, TextInput, SelectInput, CheckboxInput, ConfirmButton, isSafeUrl, swapped } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { HERO_MEDIA_TYPES, HERO_ROLES, HERO_SIZES, mediaItemError, parseMediaItems, vimeoId, type HeroMediaItem } from "@/lib/hero";

const blank: HeroMediaItem = { role: "product", type: "image", url: "", poster_url: "", label: "", alt: "", size_variant: "small", sort_order: 0, autoplay: true, loop: true, muted: true };

/** Admin preview: image, poster, or Vimeo's own thumbnail when no poster is set. Never shows a broken icon. */
function Preview({ m }: { m: HeroMediaItem }) {
  const [vthumb, setVthumb] = useState("");
  const [bad, setBad] = useState(false);
  const id = m.type === "vimeo" ? vimeoId(m.url) : null;
  useEffect(() => {
    setVthumb("");
    if (!id || m.poster_url) return;
    let off = false;
    fetch(`https://vimeo.com/api/oembed.json?width=640&url=${encodeURIComponent(`https://vimeo.com/${id}`)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { thumbnail_url?: string } | null) => { if (!off && j?.thumbnail_url) setVthumb(j.thumbnail_url); })
      .catch(() => {});
    return () => { off = true; };
  }, [id, m.poster_url]);
  const src = m.type === "image" ? m.url : m.poster_url || vthumb;
  useEffect(() => setBad(false), [src]);
  const note = !m.url ? "No media yet — hidden on site" : bad || !src ? (m.type === "image" ? "Media unavailable" : "No poster — neutral frame shown until playback") : m.type === "vimeo" && !m.poster_url ? "Vimeo thumbnail (auto)" : m.type !== "image" ? "Poster" : "";
  return (
    <div className="grid gap-1">
      <div className="relative aspect-video overflow-hidden rounded-sm bg-muted">
        {m.type === "video" && m.url && !mediaItemError(m) ? (
          <video src={m.url} poster={src || undefined} muted loop playsInline controls preload="metadata" className="absolute inset-0 size-full object-cover" />
        ) : src && !bad ? (
          <img src={src} alt="" onError={() => setBad(true)} className="absolute inset-0 size-full object-cover" />
        ) : null}
      </div>
      {note && <p className="text-caption text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * Structured editor for hero-specific config (secondary CTA, capabilities, media items).
 * Reads/writes the section's config JSON string so the advanced JSON view stays in sync.
 */
export function HeroFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown>;
  try {
    const p = JSON.parse(config || "{}");
    obj = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return <p className="text-caption text-destructive md:col-span-2">Hero settings unavailable: advanced config is not valid JSON.</p>;
  }
  const sec = (obj["secondary_cta"] ?? {}) as { label?: string; url?: string };
  const caps = Array.isArray(obj["capabilities"]) ? (obj["capabilities"] as string[]) : [];
  const items = parseMediaItems(obj["media_items"]);

  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const writeItems = (list: HeroMediaItem[]) => write({ media_items: list.map((m, i) => ({ ...m, sort_order: (i + 1) * 10 })) });
  const setItem = (i: number, patch: Partial<HeroMediaItem>) => writeItems(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2 md:grid-cols-2">
      <p className="text-eyebrow text-muted-foreground md:col-span-2">Hero settings</p>
      <p className="text-caption text-muted-foreground md:col-span-2">
        The headline (Title) is split into lines of two words; a final full stop shows in orange.
      </p>
      <TextInput label="Secondary CTA label" value={sec.label ?? ""} onChange={(e) => write({ secondary_cta: { ...sec, label: e.target.value } })} />
      <TextInput
        label="Secondary CTA URL"
        value={sec.url ?? ""}
        placeholder="/contact"
        error={isSafeUrl(sec.url ?? "") ? null : "Use /path or https:// URL."}
        onChange={(e) => write({ secondary_cta: { ...sec, url: e.target.value } })}
      />
      <TextInput
        label="Capability labels"
        className="md:col-span-2"
        hint="Comma separated, shown in this order."
        value={caps.join(", ")}
        onChange={(e) => write({ capabilities: e.target.value.split(",").map((x) => x.trimStart()) })}
        onBlur={(e) => write({ capabilities: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
      />

      <div className="grid gap-3 md:col-span-2">
        <div className="flex items-center justify-between">
          <p className="text-small font-medium">Media items</p>
          <AdminButton size="sm" onClick={() => writeItems([...items, { ...blank }])}>
            <Plus className="size-3.5" aria-hidden /> Add media
          </AdminButton>
        </div>
        <p className="text-caption text-muted-foreground">
          Role picks the slot in the hero; Media type is independent, so any slot can be an image, a video file or a Vimeo film. Items without a URL stay hidden. Video uploads aren't supported here — paste an https .mp4/.webm link or use Vimeo.
        </p>
        {items.map((m, i) => {
          const err = mediaItemError(m) ?? {};
          const isVideo = m.type !== "image";
          return (
            <div key={i} className="grid gap-3 rounded-sm border border-border bg-background/60 p-3 md:grid-cols-[1fr_220px]">
              <div className="grid gap-3 md:grid-cols-3">
                <SelectInput label="Role / slot" value={m.role} options={HERO_ROLES} onChange={(e) => setItem(i, { role: e.target.value as HeroMediaItem["role"] })} />
                <SelectInput label="Media type" value={m.type} options={HERO_MEDIA_TYPES} onChange={(e) => setItem(i, { type: e.target.value as HeroMediaItem["type"] })} />
                <SelectInput label="Display size" value={m.size_variant} options={HERO_SIZES} onChange={(e) => setItem(i, { size_variant: e.target.value as HeroMediaItem["size_variant"] })} />
                <TextInput
                  label={m.type === "image" ? "Image URL" : m.type === "vimeo" ? "Vimeo URL" : "Video URL (.mp4 / .webm)"}
                  className="md:col-span-3"
                  placeholder={m.type === "vimeo" ? "https://vimeo.com/123456789" : "https://…"}
                  value={m.url}
                  error={err.url ?? null}
                  onChange={(e) => setItem(i, { url: e.target.value })}
                />
                {m.type === "image" && (
                  <div className="md:col-span-3"><UploadImageButton onUploaded={(url) => setItem(i, { url })} /></div>
                )}
                {isVideo && (
                  <>
                    <TextInput
                      label={m.type === "vimeo" ? "Poster URL (optional)" : "Poster URL"}
                      className="md:col-span-2"
                      hint={m.type === "vimeo" ? "Empty uses Vimeo's own thumbnail." : "Shown until the video plays."}
                      value={m.poster_url}
                      error={err.poster ?? null}
                      onChange={(e) => setItem(i, { poster_url: e.target.value })}
                    />
                    <div className="flex items-end"><UploadImageButton label="Upload poster" onUploaded={(url) => setItem(i, { poster_url: url })} /></div>
                    <CheckboxInput label="Autoplay" hint="Always muted when on." checked={m.autoplay} onChange={(v) => setItem(i, { autoplay: v, ...(v ? { muted: true } : {}) })} />
                    <CheckboxInput label="Loop" checked={m.loop} onChange={(v) => setItem(i, { loop: v })} />
                    <CheckboxInput label="Muted" hint={m.autoplay ? "Required for autoplay." : ""} checked={m.autoplay || m.muted} onChange={(v) => !m.autoplay && setItem(i, { muted: v })} />
                  </>
                )}
                <TextInput label="Label" value={m.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                <TextInput label="Alt text" className="md:col-span-2" hint="Describe the image or film; leave empty only if purely decorative." value={m.alt} onChange={(e) => setItem(i, { alt: e.target.value })} />
                <div className="flex items-end gap-1 md:col-span-3">
                  <span className="text-caption mr-2 text-muted-foreground">Order {i + 1}</span>
                  <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => writeItems(swapped(items, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
                  <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => writeItems(swapped(items, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
                  <ConfirmButton title="Remove this media item?" description="It will disappear from the hero after you save the section." confirmLabel="Remove" variant="ghost" onConfirm={() => writeItems(items.filter((_, j) => j !== i))}>Remove</ConfirmButton>
                </div>
              </div>
              <Preview m={m} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
