import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { AdminButton, TextInput, SelectInput, isSafeUrl, swapped } from "@/components/admin/cms";
import { HERO_MEDIA_TYPES, HERO_ROLES, HERO_SIZES, parseMediaItems, type HeroMediaItem } from "@/lib/hero";

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
  const sec = (obj.secondary_cta ?? {}) as { label?: string; url?: string };
  const caps = Array.isArray(obj.capabilities) ? (obj.capabilities as string[]) : [];
  const items = parseMediaItems(obj.media_items);

  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const writeItems = (list: HeroMediaItem[]) => write({ media_items: list.map((m, i) => ({ ...m, sort_order: (i + 1) * 10 })) });
  const setItem = (i: number, patch: Partial<HeroMediaItem>) => writeItems(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2 md:grid-cols-2">
      <p className="text-eyebrow text-muted-foreground md:col-span-2">Hero settings</p>
      <p className="text-caption text-muted-foreground md:col-span-2">
        Headline: the last line's full stop shows in orange. Put each line on its own row with a line break, or leave it as one sentence to split into pairs of words.
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
          <AdminButton
            size="sm"
            onClick={() => writeItems([...items, { role: "product", type: "image", url: "", poster_url: "", label: "", alt: "", size_variant: "small", sort_order: 0 }])}
          >
            <Plus className="size-3.5" aria-hidden /> Add media
          </AdminButton>
        </div>
        <p className="text-caption text-muted-foreground">Each role fills one slot in the hero. Items without a URL stay hidden. Leave alt text empty only for purely decorative images.</p>
        {items.map((m, i) => (
          <div key={i} className="grid gap-3 rounded-sm border border-border bg-background/60 p-3 md:grid-cols-4">
            <SelectInput label="Role" value={m.role} options={HERO_ROLES} onChange={(e) => setItem(i, { role: e.target.value as HeroMediaItem["role"] })} />
            <SelectInput label="Media type" value={m.type} options={HERO_MEDIA_TYPES} onChange={(e) => setItem(i, { type: e.target.value as HeroMediaItem["type"] })} />
            <SelectInput label="Display size" value={m.size_variant} options={HERO_SIZES} onChange={(e) => setItem(i, { size_variant: e.target.value as HeroMediaItem["size_variant"] })} />
            <TextInput label="Label" value={m.label} onChange={(e) => setItem(i, { label: e.target.value })} />
            <TextInput label="URL" className="md:col-span-2" value={m.url} error={isSafeUrl(m.url, {}) ? null : "Unsafe or invalid URL."} onChange={(e) => setItem(i, { url: e.target.value })} />
            <TextInput label="Poster URL" className="md:col-span-2" hint={m.type === "image" ? "Not needed for images." : "Shown until the video plays."} value={m.poster_url} error={isSafeUrl(m.poster_url) ? null : "Unsafe or invalid URL."} onChange={(e) => setItem(i, { poster_url: e.target.value })} />
            <TextInput label="Alt text" className="md:col-span-3" value={m.alt} onChange={(e) => setItem(i, { alt: e.target.value })} />
            <div className="flex items-end gap-1">
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => writeItems(swapped(items, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => writeItems(swapped(items, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => writeItems(items.filter((_, j) => j !== i))}>Remove</AdminButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
