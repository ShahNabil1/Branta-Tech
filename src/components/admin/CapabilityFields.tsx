import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, CheckboxInput, SelectInput, TextArea, TextInput, isSafeUrl, swapped } from "@/components/admin/cms";
import { CAP_MEDIA_TYPES, parseCapConfig, safeMediaUrl, type CapItem, type CapMedia } from "@/lib/capabilities";
import { vimeoId } from "@/lib/hero";

type Svc = { id: string; name: string; status: string };

/** Structured editor for the Capability Explorer config; writes the section's config JSON. */
export function CapabilityFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  const [services, setServices] = useState<Svc[]>([]);
  useEffect(() => {
    void supabase.from("services").select("id,name,status").order("sort_order").then(({ data }) => setServices(data ?? []));
  }, []);

  let obj: Record<string, unknown>;
  try {
    const p = JSON.parse(config || "{}");
    obj = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return <p className="text-caption text-destructive md:col-span-2">Capability settings unavailable: advanced config is not valid JSON.</p>;
  }
  const cfg = parseCapConfig(obj);
  const items = cfg.items;
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const writeItems = (list: CapItem[]) => write({ items: list.map((m, i) => ({ ...m, sort_order: (i + 1) * 10 })) });
  const setItem = (i: number, patch: Partial<CapItem>) => writeItems(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const keys = items.map((i) => ({ value: i.key, label: i.label || i.key }));

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">Capability Explorer</p>
      <p className="text-caption text-muted-foreground">Eyebrow, Title and Body above are the section intro. Linked services replace the typed labels once they are published.</p>
      <SelectInput label="Default active capability" value={cfg.default_key} options={keys} onChange={(e) => write({ default_key: e.target.value })} />
      {items.map((m, i) => (
        <details key={m.key} className="rounded-sm border border-border bg-background/60">
          <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 text-small font-medium">
            <span>{m.label || "Untitled"} {!m.enabled && <span className="text-caption text-muted-foreground">(hidden)</span>}</span>
            <span className="flex gap-1" onClick={(e) => e.preventDefault()}>
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => writeItems(swapped(items, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => writeItems(swapped(items, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
            </span>
          </summary>
          <div className="grid gap-3 border-t border-border p-3 md:grid-cols-2">
            <CheckboxInput label="Enabled" checked={m.enabled} onChange={(b) => setItem(i, { enabled: b })} />
            <TextInput label="Public label" value={m.label} onChange={(e) => setItem(i, { label: e.target.value })} />
            <TextInput label="Headline" className="md:col-span-2" value={m.headline} onChange={(e) => setItem(i, { headline: e.target.value })} />
            <TextArea label="Description" className="md:col-span-2" value={m.description} onChange={(e) => setItem(i, { description: e.target.value })} />
            <TextInput label="CTA label" value={m.cta_label} onChange={(e) => setItem(i, { cta_label: e.target.value })} />
            <TextInput label="CTA URL" value={m.cta_url} error={isSafeUrl(m.cta_url) ? null : "Use /path or https:// URL."} onChange={(e) => setItem(i, { cta_url: e.target.value })} />
            <SelectInput label="Media type" value={m.media.type} options={CAP_MEDIA_TYPES} onChange={(e) => setItem(i, { media: { ...m.media, type: e.target.value as CapItem["media"]["type"] } })} />
            <TextInput label={m.media.type === "vimeo" ? "Vimeo URL" : m.media.type === "image" ? "Image URL" : "Video URL"} value={m.media.url}
              hint={m.media.type === "vimeo" ? "Any normal link, e.g. https://vimeo.com/123456789" : m.media.type === "video" ? "https link to an .mp4 or .webm file" : "From Media library, real Branta work only."}
              error={!isSafeUrl(m.media.url, {}) ? "Unsafe or invalid URL." : m.media.type === "vimeo" && m.media.url && !vimeoId(m.media.url) ? "Not a recognisable Vimeo link." : m.media.type === "video" && m.media.url && !/\.(mp4|webm)(\?|#|$)/i.test(m.media.url) ? "Use an .mp4 or .webm link." : null}
              onChange={(e) => setItem(i, { media: { ...m.media, url: e.target.value } })} />
            <TextInput label="Poster URL" value={m.media.poster_url} error={isSafeUrl(m.media.poster_url) ? null : "Unsafe or invalid URL."} onChange={(e) => setItem(i, { media: { ...m.media, poster_url: e.target.value } })} />
            <TextInput label="Alt / accessibility description" value={m.media.alt} onChange={(e) => setItem(i, { media: { ...m.media, alt: e.target.value } })} />
            {(m.media.type === "video" || m.media.type === "vimeo") && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 md:col-span-2">
                <CheckboxInput label="Autoplay" checked={m.media.autoplay} onChange={(b) => setItem(i, { media: { ...m.media, autoplay: b } })} />
                <CheckboxInput label="Loop" checked={m.media.loop} onChange={(b) => setItem(i, { media: { ...m.media, loop: b } })} />
                <CheckboxInput label="Muted" hint="Browsers only autoplay muted video." checked={m.media.muted} onChange={(b) => setItem(i, { media: { ...m.media, muted: b } })} />
              </div>
            )}
            <CapMediaPreview label={m.label} media={m.media} />
            <TextInput
              label="Related labels (fallback)"
              className="md:col-span-2"
              hint="Comma separated. Shown when no published linked service exists."
              value={m.related_labels.join(", ")}
              onChange={(e) => setItem(i, { related_labels: e.target.value.split(",").map((x) => x.trimStart()) })}
              onBlur={(e) => setItem(i, { related_labels: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
            />
            <fieldset className="md:col-span-2">
              <legend className="text-small mb-2 font-medium">Linked services</legend>
              {services.length === 0 ? (
                <p className="text-caption text-muted-foreground">No services yet. Add them under Services to link them here.</p>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {services.map((s) => (
                    <CheckboxInput
                      key={s.id}
                      label={s.status === "published" ? s.name : `${s.name} (${s.status})`}
                      checked={m.service_ids.includes(s.id)}
                      onChange={(b) => setItem(i, { service_ids: b ? [...m.service_ids, s.id] : m.service_ids.filter((x) => x !== s.id) })}
                    />
                  ))}
                </div>
              )}
            </fieldset>
            <div className="md:col-span-2">
              <AdminButton size="sm" variant="ghost" onClick={() => writeItems(items.filter((_, j) => j !== i))}>Remove capability</AdminButton>
            </div>
          </div>
        </details>
      ))}
      <div>
        <AdminButton size="sm" onClick={() => writeItems([...items, { key: `cap-${Date.now().toString(36)}`, label: "", enabled: false, sort_order: 0, headline: "", description: "", related_labels: [], service_ids: [], cta_label: "", cta_url: "", media: { type: "video", url: "", poster_url: "", alt: "", autoplay: true, loop: true, muted: true } }])}>
          <Plus className="size-3.5" aria-hidden /> Add capability
        </AdminButton>
      </div>
    </div>
  );
}

/** Admin preview: poster plus a click-to-load player, so nothing autoplays inside the editor. */
function CapMediaPreview({ label, media }: { label: string; media: CapMedia }) {
  const [play, setPlay] = useState(false);
  const url = safeMediaUrl(media.url), poster = safeMediaUrl(media.poster_url);
  const vid = media.type === "vimeo" ? vimeoId(url) : null;
  const canPlay = (media.type === "video" && !!url) || !!vid;
  return (
    <div className="md:col-span-2">
      <p className="text-small mb-2 font-medium">Preview — {label || "Untitled"}</p>
      <div className="relative w-full max-w-md overflow-hidden rounded-sm bg-muted" style={{ aspectRatio: "4/3" }}>
        {play && vid ? (
          <iframe title={`${label} preview`} src={`https://player.vimeo.com/video/${vid}?autoplay=1&muted=1&dnt=1`} allow="autoplay; fullscreen" className="absolute inset-0 size-full border-0" />
        ) : play && media.type === "video" ? (
          <video src={url} poster={poster || undefined} controls autoPlay muted playsInline className="absolute inset-0 size-full object-cover" />
        ) : poster || (media.type === "image" && url) ? (
          <img src={poster || url} alt="" className="absolute inset-0 size-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <span className="text-caption absolute inset-0 grid place-items-center text-muted-foreground">{media.type === "workflow" ? "Workflow diagram" : "No poster yet"}</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        {canPlay && <AdminButton size="sm" onClick={() => setPlay((p) => !p)}>{play ? "Show poster" : "Play preview"}</AdminButton>}
        {(media.type === "video" || media.type === "vimeo") && !poster && <span className="text-caption self-center text-muted-foreground">{vid ? "Vimeo thumbnail used when no poster is set." : "Add a poster so something shows before the video loads."}</span>}
      </div>
    </div>
  );
}
