import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { AdminButton, ConfirmButton, DataTable, EmptyState, ErrorNote, LoadingRow, Panel, Td, friendlyError } from "@/components/admin/cms";
import { CMS_ROLES } from "@/lib/supabase/admin-access";
import { loadAdminPricing, PRICING_KEY, type AdminPricing } from "@/lib/pricing/admin";
import { cn } from "@/lib/utils";

const adminRoute = getRouteApi("/control-centre/_admin");

export function usePricing() {
  return useQuery({ queryKey: PRICING_KEY, queryFn: loadAdminPricing });
}
export function useRefreshPricing() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PRICING_KEY });
}

const TABS = [
  { to: "/control-centre/pricing", label: "Overview" },
  { to: "/control-centre/pricing/rates", label: "Rate matrix" },
  { to: "/control-centre/pricing/video-types", label: "Video types" },
  { to: "/control-centre/pricing/ai-models", label: "AI models" },
  { to: "/control-centre/pricing/production-tiers", label: "Tiers" },
  { to: "/control-centre/pricing/addons", label: "Add-ons" },
  { to: "/control-centre/pricing/simulator", label: "Simulator" },
  { to: "/control-centre/pricing/settings", label: "Settings" },
  { to: "/control-centre/pricing/quotations", label: "Quotations" },
] as const;

/** Page shell: CMS-role gate (UX only — RLS enforces), sub-nav, data loading. */
export function PricingPage({ title, description, actions, children, wide }: {
  title: string; description?: string; actions?: ReactNode; wide?: boolean;
  children: (d: AdminPricing) => ReactNode;
}) {
  const { admin } = adminRoute.useRouteContext();
  const allowed = admin.roles.some((r) => (CMS_ROLES as readonly string[]).includes(r));
  const q = usePricing();
  return (
    <div className={wide ? "max-w-7xl" : "max-w-6xl"}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow text-muted-foreground">Pricing</p>
          <h1 className="text-h3 mt-2">{title}</h1>
          {description && <p className="text-small mt-2 max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <nav aria-label="Pricing sections" className="-mx-1 mb-8 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} activeOptions={{ exact: true }}
            className="text-small whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "!border-accent !text-foreground font-medium" }}>{t.label}</Link>
        ))}
      </nav>
      {!allowed ? <ErrorNote>Pricing is only available to full Control Centre admins.</ErrorNote>
        : q.isLoading ? <LoadingRow />
        : q.error ? <ErrorNote>{friendlyError(q.error)}</ErrorNote>
        : q.data ? children(q.data) : null}
    </div>
  );
}

export function Pill({ on, onLabel, offLabel, onClick, title }: { on: boolean; onLabel: string; offLabel: string; onClick?: () => void; title?: string }) {
  const cls = cn("text-caption inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-medium",
    on ? "border-accent/40 bg-accent/10 text-foreground" : "border-border bg-muted text-muted-foreground",
    onClick && "hover:border-foreground");
  const dot = <span className={cn("size-1.5 rounded-full", on ? "bg-accent" : "bg-muted-foreground/50")} aria-hidden />;
  return onClick
    ? <button type="button" title={title} onClick={onClick} className={cls}>{dot}{on ? onLabel : offLabel}</button>
    : <span className={cls}>{dot}{on ? onLabel : offLabel}</span>;
}

/** Number input that keeps raw text so admins can type freely; parent validates. */
export function NumField({ label, value, onChange, hint, error, step = "1", suffix }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string | null; step?: string; suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-small mb-1.5 block font-medium">{label}</span>
      <span className="relative block">
        <input inputMode="decimal" type="number" step={step} min="0" value={value} onChange={(e) => onChange(e.target.value)}
          className={cn("text-small h-10 w-full rounded-sm border border-input bg-surface px-3 tabular-nums outline-none focus:border-foreground", suffix && "pr-12", error && "border-destructive")} />
        {suffix && <span className="text-caption pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>}
      </span>
      {error ? <span className="text-caption mt-1 block text-destructive">{error}</span> : hint ? <span className="text-caption mt-1 block text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const parseMoney = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && Math.round(n * 100) === n * 100 ? n : null;
};

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-4">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-h4 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-caption mt-1 text-muted-foreground">{sub}</p>}
    </div>
  );
}

type Table = "pricing_video_types" | "pricing_ai_models" | "pricing_production_tiers" | "pricing_addons";

/**
 * Table + side editor for one pricing entity. Handles reorder (rewrites sort_order),
 * publish toggle, duplicate (as unpublished draft) and confirmed delete.
 */
export function PricingCrud<T extends { id: string; name: string; published: boolean; sort_order: number }>({
  table, rows, head, cells, newLabel, form, duplicate, deleteWarning, empty,
}: {
  table: Table; rows: T[]; head: string[]; cells: (r: T) => ReactNode[]; newLabel: string; empty: string;
  form: (r: T | null, done: () => void) => ReactNode;
  duplicate?: (r: T) => Promise<void>;
  deleteWarning: (r: T) => string;
}) {
  const refresh = useRefreshPricing();
  const [editing, setEditing] = useState<T | "new" | null>(null);


  async function move(i: number, dir: -1 | 1) {
    const next = [...rows];
    const [it] = next.splice(i, 1);
    if (!it) return;
    next.splice(i + dir, 0, it);
    const res = await Promise.all(next.map((r, idx) => (r.sort_order === idx + 1 ? null : supabase.from(table).update({ sort_order: idx + 1 }).eq("id", r.id))));
    const err = res.find((r) => r?.error)?.error;
    if (err) toast.error(friendlyError(err));
    refresh();
  }
  async function togglePublish(r: T) {
    const { error } = await supabase.from(table).update({ published: !r.published }).eq("id", r.id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(r.published ? `${r.name} unpublished` : `${r.name} published`);
    refresh();
  }
  async function remove(r: T) {
    const { error } = await supabase.from(table).delete().eq("id", r.id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(`${r.name} deleted`);
    if (editing !== "new" && editing?.id === r.id) setEditing(null);
    refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div className="min-w-0">
        <div className="mb-4"><AdminButton variant="primary" onClick={() => setEditing("new")}>{newLabel}</AdminButton></div>
        {rows.length === 0 ? <EmptyState>{empty}</EmptyState> : (
          <DataTable head={["", ...head, "Status", ""]}>
            {rows.map((r, i) => (
              <tr key={r.id} className={cn(editing !== "new" && editing?.id === r.id && "bg-accent/5")}>
                <Td className="w-16">
                  <div className="flex">
                    <AdminButton size="sm" variant="ghost" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
                    <AdminButton size="sm" variant="ghost" aria-label={`Move ${r.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
                  </div>
                </Td>
                {cells(r).map((c, ci) => <Td key={ci} className={ci > 0 ? "tabular-nums" : ""}>{c}</Td>)}
                <Td><Pill on={r.published} onLabel="Published" offLabel="Draft" onClick={() => togglePublish(r)} title="Click to toggle" /></Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <AdminButton size="sm" onClick={() => setEditing(r)}>Edit</AdminButton>
                    {duplicate && <AdminButton size="sm" variant="ghost" onClick={async () => { await duplicate(r); refresh(); }}>Duplicate</AdminButton>}
                    <ConfirmButton title={`Delete ${r.name}?`} description={deleteWarning(r)} onConfirm={() => remove(r)}>Delete</ConfirmButton>
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
      {editing && (
        <Panel title={editing === "new" ? newLabel : `Edit ${editing.name}`} actions={<AdminButton size="sm" variant="ghost" onClick={() => setEditing(null)}>Close</AdminButton>} className="h-fit xl:sticky xl:top-6">
          <div key={editing === "new" ? "new" : editing.id}>{form(editing === "new" ? null : editing, () => { refresh(); setEditing(null); })}</div>
        </Panel>
      )}
    </div>
  );
}



/** Next free sort order for a new record. */
export const nextOrder = (rows: { sort_order: number }[]) => rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;

/** Copies a slug to a free "-copy" variant. */
export function copySlug(slug: string, taken: string[]) {
  let i = 1, s = `${slug}-copy`.slice(0, 76);
  while (taken.includes(s)) s = `${slug}-copy-${++i}`.slice(0, 76);
  return s;
}
