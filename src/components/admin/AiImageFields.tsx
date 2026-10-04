import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { AdminButton, SelectInput, TextInput, swapped } from "@/components/admin/cms";
import { IMAGE_SIZES, parseImageConfig, safeImg, type ImageItem } from "@/lib/ai-image";

const LABELS = ["AI Product", "AI Fashion", "Lifestyle", "Campaign", "Virtual Model", "E-commerce", "Restoration"];

/** Editor for the AI Image showcase config: image list + optional real before/after pair. */
export function AiImageFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown>;
  try {
    const p = JSON.parse(config || "{}");
    obj = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return <p className="text-caption text-destructive md:col-span-2">AI Image settings unavailable: advanced config is not valid JSON.</p>;
  }
  const cfg = parseImageConfig(obj);
  const items = cfg.media_items;
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const writeItems = (list: ImageItem[]) => write({ media_items: list.map((m, i) => ({ ...m, sort_order: (i + 1) * 10 })) });
  const setItem = (i: number, patch: Partial<ImageItem>) => writeItems(items.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const pair = (obj["before_after_pair"] ?? {}) as Record<string, string>;
  const setPair = (k: string, v: string) => write({ before_after_pair: { ...pair, [k]: v } });

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">AI Image showcase</p>
      <p className="text-caption text-muted-foreground">Eyebrow, Title (use a new line for the second line), Body and button above are the intro. Copy image addresses from Media. Up to 6 images show.</p>
      {items.map((m, i) => (
        <div key={i} className="grid gap-3 rounded-sm border border-border p-3 md:grid-cols-2">
          <TextInput label="Image URL" value={m.url} error={m.url && !safeImg(m.url) ? "Use an https or site address" : undefined} onChange={(e) => setItem(i, { url: e.target.value })} className="md:col-span-2" />
          <TextInput label="Alt text" hint="Describe the picture; the label doesn't count." value={m.alt} onChange={(e) => setItem(i, { alt: e.target.value })} className="md:col-span-2" />
          <TextInput label="Label" list="ai-image-labels" value={m.label} onChange={(e) => setItem(i, { label: e.target.value })} />
          <SelectInput label="Size" value={m.size_variant} options={IMAGE_SIZES.map((s) => ({ value: s, label: s }))} onChange={(e) => setItem(i, { size_variant: e.target.value as ImageItem["size_variant"] })} />
          <div className="flex gap-1 md:col-span-2">
            <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => writeItems(swapped(items, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
            <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => writeItems(swapped(items, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
            <AdminButton size="sm" variant="ghost" onClick={() => writeItems(items.filter((_, j) => j !== i))}>Remove</AdminButton>
          </div>
        </div>
      ))}
      <datalist id="ai-image-labels">{LABELS.map((l) => <option key={l} value={l} />)}</datalist>
      <AdminButton size="sm" variant="outline" onClick={() => writeItems([...items, { url: "", alt: "", label: "", project_id: null, size_variant: "medium", sort_order: 0 }])}>
        <Plus className="size-3.5" /> Add image
      </AdminButton>
      <details className="rounded-sm border border-border p-3">
        <summary className="cursor-pointer text-small font-medium">Before / after (optional — real pairs only)</summary>
        <div className="mt-3 grid gap-3">
          <TextInput label="Original image URL" value={pair["before_url"] ?? ""} onChange={(e) => setPair("before_url", e.target.value)} />
          <TextInput label="Branta output URL" value={pair["after_url"] ?? ""} onChange={(e) => setPair("after_url", e.target.value)} />
          <TextInput label="Alt text" value={pair["alt"] ?? ""} onChange={(e) => setPair("alt", e.target.value)} />
          <AdminButton size="sm" variant="ghost" onClick={() => write({ before_after_pair: null })}>Clear pair</AdminButton>
        </div>
      </details>
    </div>
  );
}
