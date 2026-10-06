import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, ConfirmButton, EmptyState, ErrorNote, LoadingRow, PageHeader, Panel, TextArea, TextInput, friendlyError } from "@/components/admin/cms";
import { parsePresets } from "@/lib/pricing/phase5";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/pricing/templates")({
  head: () => adminHead("Quote templates"),
  component: Templates,
});

type T = Tables<"pricing_quote_templates">;
const KEY = ["cms", "quote-templates"];

function Templates() {
  const q = useQuery({ queryKey: KEY, queryFn: () => must(supabase.from("pricing_quote_templates").select("*").order("sort_order")) });
  const [sel, setSel] = useState<string | null>(null);
  const qc = useQueryClient();
  const cur = q.data?.find((t) => t.id === sel) ?? q.data?.[0];
  async function add() {
    const { data, error } = await supabase.from("pricing_quote_templates").insert({ name: "New template", sort_order: (q.data?.length ?? 0) + 1 }).select("id").single();
    if (error) return void toast.error(friendlyError(error));
    await qc.invalidateQueries({ queryKey: KEY }); setSel(data.id);
  }
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Pricing" title="Quote templates" description="Reusable terms for the final-quote builder. Templates start empty and stay drafts — only approved templates can be applied to a quote. Add Branta's real policies; nothing here was pre-written." />
      {q.isLoading ? <LoadingRow /> : q.error ? <ErrorNote>Templates are available to sales and admin staff only.</ErrorNote> : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="grid content-start gap-1">
            {q.data!.map((t) => (
              <button key={t.id} type="button" onClick={() => setSel(t.id)} className={cn("text-small flex items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left", cur?.id === t.id ? "border-foreground bg-surface" : "border-transparent hover:border-border")}>
                <span className="truncate">{t.name}</span>
                <span className={cn("text-caption", t.status === "approved" ? "text-accent" : "text-muted-foreground")}>{t.status === "approved" ? "Approved" : "Draft"}</span>
              </button>
            ))}
            <AdminButton size="sm" className="mt-2" onClick={() => void add()}><Plus className="size-3.5" /> New template</AdminButton>
          </div>
          {cur ? <Editor key={cur.id} t={cur} /> : <EmptyState>No templates.</EmptyState>}
        </div>
      )}
    </div>
  );
}

function Editor({ t }: { t: T }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ name: t.name, scope: t.scope ?? "", deliverables: t.deliverables ?? "", revisions: t.revisions == null ? "" : String(t.revisions), delivery_timeline: t.delivery_timeline ?? "", payment_terms: t.payment_terms ?? "", conditions: t.conditions ?? "" });
  const [presets, setPresets] = useState(() => parsePresets(t.charge_presets).map((p) => ({ label: p.label, quantity: String(p.quantity), unit: String(p.unit_minor / 100) })));
  useEffect(() => { /* keyed by id; no sync needed */ }, []);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((o) => ({ ...o, [k]: e.target.value }));
  const payload = () => ({
    name: v.name.trim() || "Untitled", scope: v.scope.trim() || null, deliverables: v.deliverables.trim() || null,
    revisions: v.revisions === "" ? null : Math.max(0, Math.round(Number(v.revisions)) || 0), delivery_timeline: v.delivery_timeline.trim() || null,
    payment_terms: v.payment_terms.trim() || null, conditions: v.conditions.trim() || null,
    charge_presets: presets.filter((p) => p.label.trim()).map((p) => ({ label: p.label.trim(), quantity: Number(p.quantity) || 1, unit_minor: Math.round((Number(p.unit) || 0) * 100) })) as never,
  });
  async function save(extra: Partial<T> = {}, msg = "Template saved") {
    const { error } = await supabase.from("pricing_quote_templates").update({ ...payload(), ...extra }).eq("id", t.id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg); void qc.invalidateQueries({ queryKey: ["cms", "quote-templates"] });
  }
  async function approve() {
    const p = payload();
    if (!p.scope && !p.deliverables && !p.payment_terms) return void toast.error("Add at least scope, deliverables or payment terms before approving.");
    const { data } = await supabase.auth.getUser();
    await save({ status: "approved", approved_by: data.user?.id ?? null, approved_at: new Date().toISOString() }, "Template approved");
  }
  async function remove() {
    const { error } = await supabase.from("pricing_quote_templates").delete().eq("id", t.id);
    if (error) return void toast.error(friendlyError(error));
    void qc.invalidateQueries({ queryKey: ["cms", "quote-templates"] });
  }
  return (
    <Panel title={t.name} description={t.status === "approved" ? `Approved ${t.approved_at ? new Date(t.approved_at).toLocaleDateString() : ""}. Saving edits keeps it approved; use “Return to draft” to withdraw it.` : "Draft — not available in the quote builder until approved."}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput className="sm:col-span-2" label="Template name" value={v.name} onChange={set("name")} />
        <TextArea label="Scope" value={v.scope} onChange={set("scope")} />
        <TextArea label="Deliverables" value={v.deliverables} onChange={set("deliverables")} />
        <TextInput label="Revision allowance (rounds)" type="number" min="0" value={v.revisions} onChange={set("revisions")} />
        <TextInput label="Timeline" value={v.delivery_timeline} onChange={set("delivery_timeline")} />
        <TextArea label="Payment terms" value={v.payment_terms} onChange={set("payment_terms")} />
        <TextArea label="Additional conditions" hint="Added to the customer notes when applied." value={v.conditions} onChange={set("conditions")} />
      </div>
      <div className="mt-5 grid gap-2 border-t border-border pt-4">
        <p className="text-small font-medium">Optional charge presets</p>
        {presets.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_120px_32px] gap-2">
            <input aria-label="Charge label" value={p.label} onChange={(e) => setPresets(presets.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="text-small h-9 rounded-sm border border-input bg-surface px-2" />
            <input aria-label="Quantity" type="number" min="1" value={p.quantity} onChange={(e) => setPresets(presets.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="text-small h-9 rounded-sm border border-input bg-surface px-2" />
            <input aria-label="Unit amount (BDT)" type="number" min="0" value={p.unit} onChange={(e) => setPresets(presets.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className="text-small h-9 rounded-sm border border-input bg-surface px-2" />
            <button type="button" aria-label="Remove" onClick={() => setPresets(presets.filter((_, j) => j !== i))} className="grid place-items-center text-muted-foreground hover:text-foreground"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <AdminButton size="sm" className="justify-self-start" onClick={() => setPresets([...presets, { label: "", quantity: "1", unit: "0" }])}><Plus className="size-3.5" /> Charge preset</AdminButton>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <AdminButton variant="primary" onClick={() => void save()}>Save</AdminButton>
        {t.status === "approved" ? <AdminButton onClick={() => void save({ status: "draft", approved_at: null, approved_by: null }, "Returned to draft")}>Return to draft</AdminButton>
          : <ConfirmButton variant="secondary" size="md" title="Approve this template?" description="Staff will be able to apply it to quotes. Make sure the terms are official Branta policy." confirmLabel="Approve" onConfirm={approve}>Approve</ConfirmButton>}
        <ConfirmButton variant="ghost" size="md" title="Delete this template?" description="Quotes already built from it are not affected." confirmLabel="Delete" onConfirm={remove}>Delete</ConfirmButton>
      </div>
    </Panel>
  );
}
