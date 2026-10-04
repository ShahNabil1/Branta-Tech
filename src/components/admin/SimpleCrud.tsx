import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AdminButton, ConfirmButton, EmptyState, ErrorNote, LoadingRow, Panel, friendlyError } from "@/components/admin/cms";

/**
 * Small list + inline editor for flat tables (authors, team). The caller supplies the form and
 * save/delete/reorder handlers; this only handles layout and selection.
 */
export function SimpleCrud<T extends { id: string }>({
  rows, loading, error, empty, renderRow, renderForm, onDelete, onMove, newLabel,
}: {
  rows: T[] | undefined; loading: boolean; error: unknown; empty: string; newLabel: string;
  renderRow: (r: T) => ReactNode;
  renderForm: (r: T | null, close: () => void) => ReactNode;
  onDelete: (r: T) => Promise<void>;
  onMove: (i: number, dir: -1 | 1) => Promise<void>;
}) {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const close = () => setEditing(null);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div>
        <div className="mb-4"><AdminButton variant="primary" onClick={() => setEditing("new")}>{newLabel}</AdminButton></div>
        {loading && <LoadingRow />}
        {!!error && <ErrorNote>{friendlyError(error)}</ErrorNote>}
        {rows && rows.length === 0 && <EmptyState>{empty}</EmptyState>}
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {(rows ?? []).map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">{renderRow(r)}</div>
              <div className="flex gap-1">
                <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === (rows?.length ?? 0) - 1} onClick={() => onMove(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
                <AdminButton size="sm" onClick={() => setEditing(r)}>Edit</AdminButton>
                <ConfirmButton title="Delete?" description="This permanently removes the entry." onConfirm={() => onDelete(r)}>Delete</ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {editing && (
        <Panel title={editing === "new" ? newLabel : "Edit"} actions={<AdminButton size="sm" variant="ghost" onClick={close}>Close</AdminButton>}>
          <div key={editing === "new" ? "new" : editing.id}>{renderForm(editing === "new" ? null : editing, close)}</div>
        </Panel>
      )}
    </div>
  );
}
