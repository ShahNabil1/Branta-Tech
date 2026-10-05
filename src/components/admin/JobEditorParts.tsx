import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { AdminButton, CheckboxInput, SelectInput, TextInput, swapped } from "@/components/admin/cms";
import { uid, type Item } from "@/lib/job-details";
import { cn } from "@/lib/utils";

/** Repeatable list with add, delete, drag reorder (plus keyboard up/down) and per-row content. */
export function RepeatList<T extends { id: string }>({ rows, onChange, render, make, addLabel, empty, extraActions }: {
  rows: T[]; onChange: (rows: T[]) => void; render: (r: T, set: (p: Partial<T>) => void) => ReactNode; make: () => T; addLabel: string; empty?: string; extraActions?: ReactNode;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const set = (i: number) => (p: Partial<T>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div>
      {rows.length === 0 && empty && <p className="text-small mb-3 text-muted-foreground">{empty}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.id} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
            onDragOver={(e) => { e.preventDefault(); if (drag === null || drag === i) return; const next = [...rows]; const [m] = next.splice(drag, 1); next.splice(i, 0, m!); onChange(next); setDrag(i); }}
            className={cn("flex items-start gap-2 rounded-sm border border-border bg-surface p-2", drag === i && "opacity-50")}>
            <GripVertical className="mt-2.5 size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">{render(r, set(i))}</div>
            <div className="flex shrink-0 gap-0.5">
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => onChange(swapped(rows, i, i - 1))}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => onChange(swapped(rows, i, i + 1))}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Delete" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></AdminButton>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <AdminButton size="sm" onClick={() => onChange([...rows, make()])}><Plus className="size-3.5" aria-hidden /> {addLabel}</AdminButton>
        {extraActions}
      </div>
    </div>
  );
}

/** Plain text items (responsibilities, requirements, offer items, growth steps). */
export function ItemList({ rows, onChange, addLabel, placeholder }: { rows: Item[]; onChange: (r: Item[]) => void; addLabel: string; placeholder?: string }) {
  return (
    <RepeatList rows={rows} onChange={onChange} addLabel={addLabel} make={() => ({ id: uid(), text: "", enabled: true })}
      render={(r, set) => (
        <div className="flex flex-wrap items-center gap-3">
          <input aria-label="Text" value={r.text} placeholder={placeholder} onChange={(e) => set({ text: e.target.value })} className="text-small h-9 min-w-0 flex-1 rounded-sm border border-input bg-surface px-3 outline-none focus:border-foreground" />
          <EnabledToggle on={r.enabled} set={(v) => set({ enabled: v } as Partial<Item>)} />
        </div>
      )} />
  );
}

export function EnabledToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="text-caption flex items-center gap-1.5 text-muted-foreground">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Shown
    </label>
  );
}

/** Small typed field helpers bound to an object section. */
export function sectionFields<S extends Record<string, unknown>>(value: S, onChange: (v: S) => void) {
  const put = (k: keyof S, v: unknown) => onChange({ ...value, [k]: v });
  return {
    text: (k: keyof S, label: string, extra: { hint?: string; type?: string; placeholder?: string; className?: string } = {}) => (
      <TextInput label={label} value={String(value[k] ?? "")} onChange={(e) => put(k, e.target.value)} {...extra} />
    ),
    select: (k: keyof S, label: string, options: readonly (readonly [string, string])[] | string[], className?: string) => (
      <SelectInput label={label} className={className} value={String(value[k] ?? "")} onChange={(e) => put(k, e.target.value)}
        options={[{ value: "", label: "—" }, ...options.map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o[0], label: o[1] }))]} />
    ),
    check: (k: keyof S, label: string, hint?: string) => <CheckboxInput label={label} {...(hint ? { hint } : {})} checked={value[k] === true} onChange={(v) => put(k, v)} />,
    area: (k: keyof S, label: string, hint?: string, className?: string) => (
      <label className={cn("block", className)}>
        <span className="text-small mb-1.5 block font-medium">{label}</span>
        <textarea value={String(value[k] ?? "")} onChange={(e) => put(k, e.target.value)} rows={3} className="text-small min-h-20 w-full rounded-sm border border-input bg-surface px-3 py-2 outline-none focus:border-foreground" />
        {hint && <span className="text-caption mt-1 block text-muted-foreground">{hint}</span>}
      </label>
    ),
  };
}
