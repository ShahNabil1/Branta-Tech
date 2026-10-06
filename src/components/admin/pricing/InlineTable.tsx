import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, ConfirmButton, DataTable, EmptyState, Td, friendlyError } from "@/components/admin/cms";
import { Pill } from "./PricingKit";
import { cn } from "@/lib/utils";

export type Col = {
  key: string; label: string;
  type: "text" | "money" | "int" | "pct" | "bool" | "select";
  options?: { value: string; label: string }[]; nullable?: boolean; width?: string;
};
type Row = { id: string; published?: boolean; [k: string]: unknown };
type TableName = "pricing_photo_categories" | "pricing_photo_views" | "pricing_photo_packages" | "pricing_photo_addons" | "pricing_photo_bulk_tiers" | "pricing_video_types";

const inp = "text-small h-9 w-full min-w-0 rounded-sm border border-input bg-surface px-2 tabular-nums outline-none focus:border-foreground";

function parse(c: Col, raw: unknown): { ok: true; v: unknown } | { ok: false; msg: string } {
  if (c.type === "bool") return { ok: true, v: !!raw };
  const s = String(raw ?? "").trim();
  if (c.type === "text" || c.type === "select") return s || c.nullable ? { ok: true, v: s || null } : { ok: false, msg: `${c.label} is required` };
  if (s === "") return c.nullable ? { ok: true, v: null } : { ok: false, msg: `${c.label} is required` };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false, msg: `${c.label} must be 0 or more` };
  if (c.type === "int" && !Number.isInteger(n)) return { ok: false, msg: `${c.label} must be a whole number` };
  if (c.type === "pct" && n > 100) return { ok: false, msg: `${c.label} must be 0–100` };
  if (c.type === "money" && Math.round(n * 100) !== n * 100) return { ok: false, msg: `${c.label}: up to 2 decimals` };
  return { ok: true, v: n };
}

/**
 * Spreadsheet-style editor: every cell editable, row-level Save, publish toggle, add and confirmed delete.
 * Writes go through the browser client — RLS (full CMS admins) is the real gate.
 */
export function InlineTable({ table, rows, cols, onChange, newRow, empty, extra, canDelete = true, publishable = true, slugFrom }: {
  table: TableName; rows: Row[]; cols: Col[]; onChange: () => void; newRow?: Record<string, unknown>; empty: string;
  extra?: (r: Row) => ReactNode; canDelete?: boolean; publishable?: boolean; slugFrom?: string;
}) {
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const val = (r: Row, k: string) => (edits[r.id] && k in edits[r.id]! ? edits[r.id]![k] : r[k]);
  const set = (id: string, k: string, v: unknown) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));

  async function save(r: Row) {
    const e = edits[r.id]; if (!e) return;
    const payload: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(e)) {
      const c = cols.find((x) => x.key === k)!; const p = parse(c, raw);
      if (!p.ok) return void toast.error(p.msg);
      payload[k] = p.v;
    }
    setBusy(r.id);
    const { error } = await supabase.from(table).update(payload as never).eq("id", r.id);
    setBusy(null);
    if (error) return void toast.error(friendlyError(error));
    setEdits((x) => { const n = { ...x }; delete n[r.id]; return n; });
    toast.success("Saved"); onChange();
  }
  async function add() {
    if (!newRow) return;
    const order = rows.reduce((m, r) => Math.max(m, Number(r["sort_order"] ?? 0)), 0) + 1;
    const row: Record<string, unknown> = { ...newRow, sort_order: order };
    if (slugFrom) row["slug"] = `${String(newRow[slugFrom] ?? "new").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const { error } = await supabase.from(table).insert(row as never);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Added as a draft"); onChange();
  }
  async function toggle(r: Row) {
    const { error } = await supabase.from(table).update({ published: !r.published } as never).eq("id", r.id);
    if (error) return void toast.error(friendlyError(error));
    onChange();
  }
  async function remove(r: Row) {
    const { error } = await supabase.from(table).delete().eq("id", r.id);
    if (error) return void toast.error(friendlyError(error));
    onChange();
  }

  return (
    <div className="min-w-0">
      {newRow && <div className="mb-4"><AdminButton variant="primary" onClick={add}>Add row</AdminButton></div>}
      {rows.length === 0 ? <EmptyState>{empty}</EmptyState> : (
        <div className="overflow-x-auto">
          <DataTable head={[...cols.map((c) => c.label), ...(publishable ? ["Status"] : []), ""]}>
            {rows.map((r) => {
              const dirty = !!edits[r.id];
              return (
                <tr key={r.id} className={cn(dirty && "bg-accent/5")}>
                  {cols.map((c) => (
                    <Td key={c.key} className={c.width ?? ""}>
                      {c.type === "bool" ? <input type="checkbox" aria-label={c.label} checked={!!val(r, c.key)} onChange={(e) => set(r.id, c.key, e.target.checked)} className="size-4 accent-[var(--accent)]" />
                        : c.type === "select" ? <select aria-label={c.label} value={String(val(r, c.key) ?? "")} onChange={(e) => set(r.id, c.key, e.target.value)} className={inp}>{c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                        : <input aria-label={c.label} type={c.type === "text" ? "text" : "number"} step={c.type === "money" ? "0.01" : c.type === "pct" ? "0.1" : "1"} min="0"
                            placeholder={c.nullable ? (c.type === "money" ? "Price Required" : "Not set") : ""} value={String(val(r, c.key) ?? "")} onChange={(e) => set(r.id, c.key, e.target.value)} className={inp} />}
                    </Td>
                  ))}
                  {publishable && <Td><Pill on={!!r.published} onLabel="Published" offLabel="Draft" onClick={() => toggle(r)} title="Click to toggle" /></Td>}
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {extra?.(r)}
                      <AdminButton size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty || busy === r.id} onClick={() => save(r)}>{busy === r.id ? "Saving…" : "Save"}</AdminButton>
                      {canDelete && <ConfirmButton title="Delete this row?" description="This permanently removes it. Issued quotations keep their saved snapshot." onConfirm={() => remove(r)}>Delete</ConfirmButton>}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}
    </div>
  );
}
