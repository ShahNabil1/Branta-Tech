import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Ban, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, Panel, SelectInput, friendlyError, formatDate, useUnsavedWarning } from "@/components/admin/cms";
import { NumField, PricingPage, parseMoney, useRefreshPricing } from "@/components/admin/pricing/PricingKit";
import { bdt, type AdminPricing, type RateRow } from "@/lib/pricing/admin";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/pricing/rates")({
  head: () => adminHead("Pricing rate matrix"),
  component: () => (
    <PricingPage wide title="Per-second rate matrix" description="BDT per finished second, for each video type and AI model. Edit cells, then save. Disabled combinations can't be quoted.">
      {(d) => <Matrix d={d} />}
    </PricingPage>
  ),
});

const key = (vt: string, m: string) => `${vt}:${m}`;

function Matrix({ d }: { d: AdminPricing }) {
  const refresh = useRefreshPricing();
  const rateMap = useMemo(() => new Map(d.rates.map((r) => [key(r.video_type_id, r.ai_model_id), r])), [d.rates]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirtyKeys = Object.keys(drafts).filter((k) => drafts[k] !== String(rateMap.get(k)?.selling_rate_per_second ?? ""));
  const invalid = dirtyKeys.filter((k) => parseMoney(drafts[k]!) == null);
  useUnsavedWarning(dirtyKeys.length > 0);

  async function saveAll() {
    if (invalid.length) return void toast.error("Some cells have invalid values (use 0 or more, max 2 decimals).");
    setSaving(true);
    const rows = dirtyKeys.map((k) => {
      const [vt, m] = k.split(":") as [string, string];
      const ex = rateMap.get(k);
      return { video_type_id: vt, ai_model_id: m, selling_rate_per_second: parseMoney(drafts[k]!)!, currency: ex?.currency ?? d.settings.currency, enabled: ex?.enabled ?? true };
    });
    const { error } = await supabase.from("pricing_model_rates").upsert(rows, { onConflict: "video_type_id,ai_model_id" });
    setSaving(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success(`${rows.length} rate${rows.length > 1 ? "s" : ""} saved`);
    setDrafts({});
    refresh();
  }
  async function toggle(r: RateRow) {
    const { error } = await supabase.from("pricing_model_rates").update({ enabled: !r.enabled }).eq("id", r.id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(r.enabled ? "Combination disabled" : "Combination enabled");
    refresh();
  }

  if (!d.videoTypes.length || !d.models.length) return <p className="text-small text-muted-foreground">Add at least one video type and one AI model first.</p>;

  return (
    <div className="grid gap-6">
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="text-caption sticky left-0 z-10 bg-muted px-4 py-2.5 font-medium text-muted-foreground">Video type</th>
              {d.models.map((m) => (
                <th key={m.id} className="text-caption whitespace-nowrap px-3 py-2.5 text-right font-medium text-muted-foreground">
                  {m.name}{!m.available && <span className="ml-1 text-destructive">(disabled)</span>}{!m.published && <span className="ml-1 opacity-70">· draft</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {d.videoTypes.map((v) => (
              <tr key={v.id}>
                <th scope="row" className="text-small sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-2 text-left font-medium">
                  {v.name}{!v.published && <span className="text-caption ml-1 font-normal text-muted-foreground">· draft</span>}
                </th>
                {d.models.map((m) => {
                  const k = key(v.id, m.id);
                  const r = rateMap.get(k);
                  const val = drafts[k] ?? (r ? String(r.selling_rate_per_second) : "");
                  const dirty = k in drafts && drafts[k] !== String(r?.selling_rate_per_second ?? "");
                  const bad = dirty && parseMoney(val) == null;
                  return (
                    <td key={m.id} className={cn("px-2 py-1.5", r && !r.enabled && "bg-muted/60")}>
                      <div className="flex items-center justify-end gap-1">
                        <input
                          aria-label={`${v.name} — ${m.name} rate`}
                          title={r ? `Updated ${formatDate(r.updated_at)} · ${r.currency}` : "No rate yet"}
                          inputMode="decimal" type="number" min="0" step="1" value={val} placeholder="—"
                          onChange={(e) => setDrafts((p) => ({ ...p, [k]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Escape") setDrafts((p) => { const n = { ...p }; delete n[k]; return n; }); }}
                          className={cn("text-small h-9 w-24 rounded-sm border bg-surface px-2 text-right tabular-nums outline-none focus:border-foreground",
                            dirty ? "border-accent bg-accent/5" : "border-transparent hover:border-input", bad && "border-destructive", r && !r.enabled && "text-muted-foreground line-through")} />
                        {r ? (
                          <button type="button" onClick={() => toggle(r)} aria-label={r.enabled ? `Disable ${v.name} with ${m.name}` : `Enable ${v.name} with ${m.name}`}
                            title={r.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                            className={cn("grid size-6 place-items-center rounded-sm", r.enabled ? "text-accent hover:bg-muted" : "text-destructive hover:bg-muted")}>
                            {r.enabled ? <Check className="size-3.5" /> : <Ban className="size-3.5" />}
                          </button>
                        ) : <span className="size-6" />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
        <AdminButton variant="primary" disabled={!dirtyKeys.length || saving} onClick={saveAll}>{saving ? "Saving…" : `Save ${dirtyKeys.length || ""} change${dirtyKeys.length === 1 ? "" : "s"}`}</AdminButton>
        <AdminButton disabled={!dirtyKeys.length || saving} onClick={() => setDrafts({})}>Cancel</AdminButton>
        <span className="text-caption text-muted-foreground" role="status">
          {invalid.length ? <span className="text-destructive">{invalid.length} invalid cell(s)</span> : dirtyKeys.length ? "Unsaved changes — highlighted in orange" : "All changes saved · Esc reverts a cell"}
        </span>
      </div>

      <BulkEditor d={d} rateMap={rateMap} disabled={dirtyKeys.length > 0} />
    </div>
  );
}

function BulkEditor({ d, rateMap, disabled }: { d: AdminPricing; rateMap: Map<string, RateRow>; disabled: boolean }) {
  const refresh = useRefreshPricing();
  const [model, setModel] = useState("all");
  const [types, setTypes] = useState<string[]>([]);
  const [mode, setMode] = useState<"pct_up" | "pct_down" | "fixed_up" | "fixed_down">("pct_up");
  const [amount, setAmount] = useState("10");
  const [open, setOpen] = useState(false);
  const amt = parseMoney(amount);

  const preview = useMemo(() => {
    if (amt == null) return [];
    const vts = types.length ? d.videoTypes.filter((v) => types.includes(v.id)) : d.videoTypes;
    const ms = model === "all" ? d.models : d.models.filter((m) => m.id === model);
    return vts.flatMap((v) => ms.map((m) => {
      const r = rateMap.get(key(v.id, m.id));
      if (!r) return null;
      const old = Number(r.selling_rate_per_second);
      const raw = mode === "pct_up" ? old * (1 + amt / 100) : mode === "pct_down" ? old * (1 - amt / 100) : mode === "fixed_up" ? old + amt : old - amt;
      const next = Math.max(0, Math.round(raw * 100) / 100);
      return next === old ? null : { r, label: `${v.name} · ${m.name}`, old, next };
    }).filter((x): x is NonNullable<typeof x> => !!x));
  }, [amt, types, model, mode, d, rateMap]);

  async function apply() {
    const res = await Promise.all(preview.map((p) => supabase.from("pricing_model_rates").update({ selling_rate_per_second: p.next }).eq("id", p.r.id)));
    const err = res.find((x) => x.error)?.error;
    if (err) toast.error(friendlyError(err)); else toast.success(`${preview.length} rates updated`);
    refresh();
  }

  return (
    <Panel title="Bulk rate update" description="Adjust many rates at once. You'll see every old → new value before anything is saved. Results are rounded to 2 decimals and never below 0.">
      <div className="grid gap-4 md:grid-cols-3">
        <SelectInput label="Change" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} options={[
          { value: "pct_up", label: "Increase by %" }, { value: "pct_down", label: "Decrease by %" },
          { value: "fixed_up", label: "Increase by BDT" }, { value: "fixed_down", label: "Decrease by BDT" },
        ]} />
        <NumField label="Amount" suffix={mode.startsWith("pct") ? "%" : "BDT"} value={amount} onChange={setAmount} error={amt == null ? "0 or more" : null} />
        <SelectInput label="AI model" value={model} onChange={(e) => setModel(e.target.value)} options={[{ value: "all", label: "All models" }, ...d.models.map((m) => ({ value: m.id, label: m.name }))]} />
      </div>
      <fieldset className="mt-4">
        <legend className="text-small mb-2 font-medium">Video types <span className="font-normal text-muted-foreground">(none ticked = all)</span></legend>
        <div className="flex flex-wrap gap-2">
          {d.videoTypes.map((v) => {
            const on = types.includes(v.id);
            return <button key={v.id} type="button" onClick={() => setTypes((p) => (on ? p.filter((x) => x !== v.id) : [...p, v.id]))}
              className={cn("text-caption rounded-sm border px-2.5 py-1", on ? "border-accent bg-accent/10" : "border-border hover:border-foreground")}>{v.name}</button>;
          })}
        </div>
      </fieldset>
      <div className="mt-4 flex items-center gap-3">
        <AdminButton disabled={disabled || !preview.length} onClick={() => setOpen(true)}>Preview {preview.length} change{preview.length === 1 ? "" : "s"}</AdminButton>
        {disabled && <span className="text-caption text-muted-foreground">Save or cancel matrix edits first.</span>}
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Update {preview.length} rates?</AlertDialogTitle>
            <AlertDialogDescription>Review every change. Enabled/published status is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-small grid gap-1 tabular-nums">
            {preview.map((p) => <li key={p.r.id} className="flex justify-between gap-4"><span>{p.label}</span><span>{bdt(p.old)} → <strong>{bdt(p.next)}</strong></span></li>)}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void apply()}>Confirm update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
