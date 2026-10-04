import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { AdminButton, SelectInput, TextArea, TextInput, swapped } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { isHttps, type Block } from "@/lib/rich-text";

type Draft = { type: Block["type"]; text: string; level: 2 | 3; cite: string; ordered: boolean; items: string; url: string; alt: string; caption: string };
const blank = (type: Block["type"]): Draft => ({ type, text: "", level: 2, cite: "", ordered: false, items: "", url: "", alt: "", caption: "" });

export function toDrafts(blocks: Block[]): Draft[] {
  return blocks.map((b) => ({
    ...blank(b.type),
    ...(b.type === "heading" ? { text: b.text, level: b.level } : {}),
    ...(b.type === "paragraph" ? { text: b.text } : {}),
    ...(b.type === "quote" ? { text: b.text, cite: b.cite ?? "" } : {}),
    ...(b.type === "list" ? { ordered: b.ordered, items: b.items.join("\n") } : {}),
    ...(b.type === "image" ? { url: b.url, alt: b.alt, caption: b.caption ?? "" } : {}),
  }));
}

/** Converts editor drafts to stored JSON { blocks }. Empty blocks are dropped. */
export function fromDrafts(d: Draft[]): { blocks: Block[] } {
  const blocks: Block[] = [];
  for (const b of d) {
    if (b.type === "heading" && b.text.trim()) blocks.push({ type: "heading", level: b.level, text: b.text.trim() });
    if (b.type === "paragraph" && b.text.trim()) blocks.push({ type: "paragraph", text: b.text.trim() });
    if (b.type === "quote" && b.text.trim()) blocks.push({ type: "quote", text: b.text.trim(), ...(b.cite.trim() ? { cite: b.cite.trim() } : {}) });
    if (b.type === "list") {
      const items = b.items.split("\n").map((s) => s.trim()).filter(Boolean);
      if (items.length) blocks.push({ type: "list", ordered: b.ordered, items });
    }
    if (b.type === "image" && isHttps(b.url)) blocks.push({ type: "image", url: b.url.trim(), alt: b.alt.trim(), ...(b.caption.trim() ? { caption: b.caption.trim() } : {}) });
  }
  return { blocks };
}

export type { Draft as BlockDraft };

const ADD: { type: Block["type"]; label: string }[] = [
  { type: "paragraph", label: "Paragraph" }, { type: "heading", label: "Heading" }, { type: "list", label: "List" }, { type: "quote", label: "Quote" }, { type: "image", label: "Image" },
];

/** Structured content editor: ordered blocks with **bold**, *italic* and [link](https://…) inline markup. No raw HTML. */
export function BlocksEditor({ value, onChange }: { value: Draft[]; onChange: (v: Draft[]) => void }) {
  const set = (i: number, patch: Partial<Draft>) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-muted-foreground">Inline formatting: **bold**, *italic*, [link text](https://example.com).</p>
      {value.length === 0 && <p className="text-small rounded-sm border border-dashed border-border px-4 py-6 text-center text-muted-foreground">No content yet. Add a block below.</p>}
      {value.map((b, i) => (
        <div key={i} className="rounded-sm border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-caption rounded-sm bg-muted px-1.5 py-0.5 font-mono">{b.type}</span>
            <div className="flex gap-1">
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => onChange(swapped(value, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === value.length - 1} onClick={() => onChange(swapped(value, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Remove block" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></AdminButton>
            </div>
          </div>
          {b.type === "heading" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <TextInput label="Heading" value={b.text} onChange={(e) => set(i, { text: e.target.value })} />
              <SelectInput label="Level" value={String(b.level)} options={[{ value: "2", label: "Large (H2)" }, { value: "3", label: "Small (H3)" }]} onChange={(e) => set(i, { level: e.target.value === "3" ? 3 : 2 })} />
            </div>
          )}
          {b.type === "paragraph" && <TextArea label="Paragraph" value={b.text} rows={4} onChange={(e) => set(i, { text: e.target.value })} />}
          {b.type === "quote" && (
            <div className="grid gap-3">
              <TextArea label="Quote" value={b.text} onChange={(e) => set(i, { text: e.target.value })} />
              <TextInput label="Attribution (optional)" value={b.cite} onChange={(e) => set(i, { cite: e.target.value })} />
            </div>
          )}
          {b.type === "list" && (
            <div className="grid gap-3">
              <TextArea label="Items (one per line)" value={b.items} onChange={(e) => set(i, { items: e.target.value })} />
              <label className="text-small flex items-center gap-2"><input type="checkbox" checked={b.ordered} onChange={(e) => set(i, { ordered: e.target.checked })} /> Numbered list</label>
            </div>
          )}
          {b.type === "image" && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <TextInput className="min-w-0 flex-1" label="Image URL (https)" value={b.url} error={b.url && !isHttps(b.url) ? "Must start with https://" : null} onChange={(e) => set(i, { url: e.target.value })} />
                <UploadImageButton onUploaded={(url) => set(i, { url })} />
              </div>
              <TextInput label="Alt text" hint="Describe the image for people who can't see it." value={b.alt} onChange={(e) => set(i, { alt: e.target.value })} />
              <TextInput label="Caption (optional)" value={b.caption} onChange={(e) => set(i, { caption: e.target.value })} />
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {ADD.map((a) => <AdminButton key={a.type} size="sm" onClick={() => onChange([...value, blank(a.type)])}>+ {a.label}</AdminButton>)}
      </div>
    </div>
  );
}
