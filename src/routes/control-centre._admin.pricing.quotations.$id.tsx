import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, ConfirmButton, EmptyState, ErrorNote, LoadingRow, Panel, SelectInput, TextArea, TextInput, formatDate, friendlyError } from "@/components/admin/cms";
import { StatusChip } from "@/components/admin/pricing/QuoteBits";
import { QUOTE_STATUSES, logQuoteActivity, money, quoteStatusLabel, type QuoteRow, type QuoteVersionRow } from "@/lib/pricing/quotes-admin";
import { computeQuoteTotals, hashToken, linesFromEstimate, newAccessToken, QuoteBuildError, type DiscountType, type QuoteLineItem } from "@/lib/pricing/quote-builder";
import type { Quote } from "@/lib/pricing/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/pricing/quotations/$id")({
  head: () => adminHead("Quotation"),
  component: Detail,
});

const TABS = ["Overview", "Production", "Original estimate", "Final quote", "Activity", "Notes"] as const;
type Snapshot = { quote?: Quote; settings?: { tax?: { enabled: boolean; label: string; percentage: number; inclusive: boolean } }; captured_at?: string } | null;

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const quote = useQuery({ queryKey: ["cms", "quote", id], queryFn: () => must(supabase.from("pricing_quote_requests").select("*").eq("id", id).single()) });
  const versions = useQuery({ queryKey: ["cms", "quote", id, "versions"], queryFn: () => must(supabase.from("pricing_quote_versions").select("*").eq("quote_id", id).order("version", { ascending: false })) });
  const staff = useQuery({ queryKey: ["cms", "sales-staff"], queryFn: () => must(supabase.rpc("list_sales_staff")) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["cms"] });
  if (quote.isLoading) return <LoadingRow />;
  if (quote.error || !quote.data) return <ErrorNote>Quotation not found or you don't have access.</ErrorNote>;
  const q = quote.data;
  const snap = q.original_pricing_snapshot as Snapshot;

  async function setStatus(s: string) {
    const { error } = await supabase.from("pricing_quote_requests").update({ status: s, status_changed_at: new Date().toISOString() }).eq("id", q.id);
    if (error) return void toast.error(friendlyError(error));
    await logQuoteActivity(q.id, "status_changed", { from: q.status, to: s });
    toast.success(`Status: ${quoteStatusLabel(s)}`); refresh();
  }
  async function assign(uid: string) {
    const { error } = await supabase.from("pricing_quote_requests").update({ assigned_to: uid || null }).eq("id", q.id);
    if (error) return void toast.error(friendlyError(error));
    await logQuoteActivity(q.id, "assigned", { to: uid || null });
    toast.success("Assignment updated"); refresh();
  }
  async function archive() {
    const { error } = await supabase.from("pricing_quote_requests").update({ archived_at: new Date().toISOString() }).eq("id", q.id);
    if (error) return void toast.error(friendlyError(error));
    await logQuoteActivity(q.id, "archived"); toast.success("Archived"); refresh();
  }

  const sidebar = (
    <div className="grid gap-4">
      <Panel title="Customer">
        <dl className="text-small grid gap-2">
          <KV k="Name" v={q.customer_name} />
          <KV k="WhatsApp" v={<a className="text-accent hover:underline" href={`https://wa.me/${q.customer_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{q.customer_whatsapp}</a>} />
          <KV k="Email" v={<a className="text-accent hover:underline" href={`mailto:${q.customer_email}`}>{q.customer_email}</a>} />
          {q.company_name && <KV k="Company" v={q.company_name} />}
          <KV k="Account" v={q.requester_user_id ? "Signed-in client" : "Guest"} />
        </dl>
      </Panel>
      <Panel title="Status">
        <div className="grid gap-3">
          <SelectInput label="Status" value={q.status} onChange={(e) => void setStatus(e.target.value)} options={QUOTE_STATUSES.map(([value, label]) => ({ value, label }))} />
          <SelectInput label="Assigned to" value={q.assigned_to ?? ""} onChange={(e) => void assign(e.target.value)}
            options={[{ value: "", label: "Unassigned" }, ...(staff.data ?? []).map((s) => ({ value: s.id, label: s.full_name || s.email }))]} />
          <p className="text-caption text-muted-foreground">Changed {formatDate(q.status_changed_at)}</p>
          {!q.archived_at && q.status !== "accepted" && <ConfirmButton title="Archive this request?" description="It leaves the inbox but is kept for records." confirmLabel="Archive" variant="ghost" onConfirm={archive}>Archive</ConfirmButton>}
          {q.archived_at && <p className="text-caption text-muted-foreground">Archived {formatDate(q.archived_at)}</p>}
        </div>
      </Panel>
    </div>
  );

  return (
    <div className="max-w-7xl">
      <Link to="/control-centre/pricing/quotations" className="text-caption text-muted-foreground hover:text-foreground">← Quotations</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-h3 font-mono">{q.public_reference}</h1><StatusChip s={q.status} />
        <span className="text-caption text-muted-foreground">Received {formatDate(q.created_at)}</span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px">
            {TABS.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn("text-small whitespace-nowrap border-b-2 px-3 py-2", tab === t ? "border-accent font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{t}</button>)}
          </nav>
          <div className="mb-6 xl:hidden">{tab === "Overview" && sidebar}</div>
          {tab === "Overview" && <Overview q={q} snap={snap} versions={versions.data ?? []} />}
          {tab === "Production" && <Production q={q} snap={snap} />}
          {tab === "Original estimate" && <Estimate snap={snap} q={q} />}
          {tab === "Final quote" && <Builder q={q} snap={snap} versions={versions.data ?? []} onChange={refresh} />}
          {tab === "Activity" && <Activity id={q.id} />}
          {tab === "Notes" && <Notes id={q.id} />}
        </div>
        <aside className="hidden xl:block">{sidebar}</aside>
      </div>
    </div>
  );
}

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>;

function Overview({ q, snap, versions }: { q: QuoteRow; snap: Snapshot; versions: QuoteVersionRow[] }) {
  const latest = versions.find((v) => v.status === "issued");
  return (
    <div className="grid gap-4">
      <Panel title="Project summary">
        <p className="text-small whitespace-pre-line">{q.project_description || <span className="text-muted-foreground">No description provided.</span>}</p>
        {q.requested_deadline && <p className="text-caption mt-3 text-muted-foreground">Preferred deadline: {q.requested_deadline}</p>}
      </Panel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Original estimate"><p className="text-h4 tabular-nums">{money(q.estimated_price_minor, q.estimated_currency)}</p>{!snap && <p className="text-caption text-muted-foreground">Custom request — no public estimate.</p>}</Panel>
        <Panel title="Issued quote"><p className="text-h4 tabular-nums">{latest ? money(latest.total_minor, latest.currency) : "—"}</p>{latest && <p className="text-caption text-muted-foreground">Version {latest.version}</p>}</Panel>
        <Panel title="Customer response"><p className="text-small">{latest?.customer_response ? quoteStatusLabel(latest.customer_response === "changes_requested" ? "more_info_needed" : latest.customer_response) : "—"}</p></Panel>
      </div>
    </div>
  );
}

function Production({ q, snap }: { q: QuoteRow; snap: Snapshot }) {
  const s = snap?.quote;
  if (!s) return <EmptyState>Custom quote request — the visitor didn't submit a priced configuration{q.duration_seconds ? ` (duration ${q.duration_seconds}s)` : ""}.</EmptyState>;
  return (
    <Panel title="Production details" description="As submitted. Names are frozen at submission time.">
      <dl className="text-small grid gap-2">
        <KV k="Video type" v={s.videoType.name} /><KV k="AI model" v={s.model.name} />
        <KV k="Duration" v={`${s.durationSeconds}s`} /><KV k="Production tier" v={`${s.tier.name} (${s.tier.multiplier.toFixed(2)}×)`} />
        <KV k="Add-ons" v={s.addonLines.length ? s.addonLines.map((l) => l.name + (l.chargeType === "per_scene" ? ` × ${l.quantity} scenes` : "")).join(", ") : "None"} />
        <KV k="Deadline" v={q.requested_deadline ?? "—"} />
      </dl>
    </Panel>
  );
}

function Estimate({ snap, q }: { snap: Snapshot; q: QuoteRow }) {
  const s = snap?.quote;
  if (!s) return <EmptyState>No original estimate — public pricing was off or no configuration was submitted.</EmptyState>;
  const c = s.currency;
  return (
    <Panel title="Original estimate (immutable)" description={`Captured ${formatDate(snap?.captured_at)} · ${q.pricing_version ?? ""}`}>
      <dl className="text-small grid gap-1.5 tabular-nums">
        <KV k="Base creative fee" v={money(s.baseFee, c)} />
        <KV k={`Rate ${money(s.ratePerSecond, c)}/s × ${s.durationSeconds}s × ${s.tier.multiplier.toFixed(2)}`} v={money(s.variableSubtotal, c)} />
        {s.addonLines.map((l) => <KV key={l.addonId} k={`${l.name} (${l.chargeType}${l.chargeType === "percentage" ? ` ${l.quantity}%` : l.quantity > 1 ? ` × ${l.quantity}` : ""})`} v={money(l.amount, c)} />)}
        <KV k="Minimum adjustment" v={money(s.minimumAdjustment, c)} />
        <KV k="Rounding" v={money(s.roundingAdjustment, c)} />
        <KV k="Tax" v={s.tax ? `${money(s.tax.amount, c)} (${s.tax.percentage}%${s.tax.inclusive ? " incl." : ""})` : "Off"} />
        <div className="mt-2 border-t border-border pt-2"><KV k="Submitted estimate" v={<strong>{money(s.total, c)}</strong>} /></div>
      </dl>
    </Panel>
  );
}

type Draft = {
  lines: { label: string; quantity: string; unit: string }[]; discount_type: DiscountType; discount_value: string;
  tax_label: string; tax_percentage: string; tax_inclusive: boolean;
  scope: string; deliverables: string; revisions: string; delivery_timeline: string; payment_terms: string; valid_until: string; customer_notes: string;
};
const toDraft = (v: QuoteVersionRow): Draft => ({
  lines: ((v.line_items as QuoteLineItem[]) ?? []).map((l) => ({ label: l.label, quantity: String(l.quantity), unit: String(l.unit_minor / 100) })),
  discount_type: v.discount_type as DiscountType, discount_value: String(v.discount_value), tax_label: v.tax_label, tax_percentage: String(v.tax_percentage), tax_inclusive: v.tax_inclusive,
  scope: v.scope ?? "", deliverables: v.deliverables ?? "", revisions: v.revisions == null ? "" : String(v.revisions), delivery_timeline: v.delivery_timeline ?? "",
  payment_terms: v.payment_terms ?? "", valid_until: v.valid_until ?? "", customer_notes: v.customer_notes ?? "",
});

function Builder({ q, snap, versions, onChange }: { q: QuoteRow; snap: Snapshot; versions: QuoteVersionRow[]; onChange: () => void }) {
  const draft = versions.find((v) => v.status === "draft");
  const [link, setLink] = useState<string | null>(null);
  async function createVersion() {
    const base = versions.find((v) => v.status !== "draft");
    const est = snap?.quote ?? null;
    const tax = snap?.settings?.tax;
    const row = base ? { ...toPayload(toDraft(base)) } : {
      line_items: linesFromEstimate(est) as never, discount_type: "none", discount_value: 0,
      tax_label: tax?.label ?? "VAT", tax_percentage: tax?.enabled ? tax.percentage : 0, tax_inclusive: tax?.inclusive ?? false,
    };
    const totals = safeTotals(row as never);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("pricing_quote_versions").insert({ ...(row as object), ...(totals ?? {}), quote_id: q.id, version: (versions[0]?.version ?? 0) + 1, currency: q.estimated_currency, created_by: u.user?.id ?? null } as never);
    if (error) return void toast.error(friendlyError(error));
    await logQuoteActivity(q.id, "draft_created", { version: (versions[0]?.version ?? 0) + 1 });
    onChange();
  }
  async function rotate(v: QuoteVersionRow, revoke = false) {
    const token = newAccessToken();
    const { error } = await supabase.from("pricing_quote_versions").update(revoke ? { token_revoked_at: new Date().toISOString() } : { access_token_hash: await hashToken(token), token_revoked_at: null }).eq("id", v.id);
    if (error) return void toast.error(friendlyError(error));
    await logQuoteActivity(q.id, revoke ? "link_revoked" : "link_regenerated", { version: v.version });
    if (!revoke) setLink(`${window.location.origin}/quote/${token}`);
    toast.success(revoke ? "Customer link revoked" : "New customer link created"); onChange();
  }
  return (
    <div className="grid gap-6">
      {link && (
        <div className="rounded-md border border-accent/40 bg-accent/5 p-4">
          <p className="text-small font-medium">Customer link (shown once — copy it now)</p>
          <div className="mt-2 flex gap-2"><input readOnly value={link} className="text-caption h-9 min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 font-mono" onFocus={(e) => e.target.select()} />
            <AdminButton size="sm" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Copied"); }}><Copy className="size-3.5" /> Copy</AdminButton></div>
          <p className="text-caption mt-2 text-muted-foreground">Send it to the customer yourself (WhatsApp or email). No message is sent automatically.</p>
        </div>
      )}
      {draft ? <DraftEditor key={draft.id} q={q} snap={snap} v={draft} onIssued={(t) => { setLink(`${window.location.origin}/quote/${t}`); onChange(); }} onChange={onChange} />
        : <AdminButton variant="primary" onClick={createVersion}>{versions.length ? `Create version ${(versions[0]?.version ?? 0) + 1} (revision)` : "Start final quote from estimate"}</AdminButton>}
      <Panel title="Versions">
        {versions.filter((v) => v.status !== "draft").length === 0 ? <p className="text-small text-muted-foreground">No issued versions yet.</p> : (
          <ul className="divide-y divide-border">
            {versions.filter((v) => v.status !== "draft").map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-small font-medium">Version {v.version}</span>
                <span className="text-caption rounded-sm border border-border px-2 py-0.5 capitalize">{v.status}</span>
                <span className="text-small tabular-nums">{money(v.total_minor, v.currency)}</span>
                <span className="text-caption text-muted-foreground">Issued {formatDate(v.issued_at)}{v.valid_until ? ` · valid until ${v.valid_until}` : ""}</span>
                {v.customer_response && <span className="text-caption font-medium text-accent">Customer: {v.customer_response.replace("_", " ")}{v.response_note ? ` — ${v.response_note}` : ""}</span>}
                {v.status === "issued" && !v.customer_response && (
                  <span className="ml-auto flex gap-1">
                    <AdminButton size="sm" onClick={() => void rotate(v)}>New link</AdminButton>
                    {!v.token_revoked_at && <AdminButton size="sm" variant="ghost" onClick={() => void rotate(v, true)}>Revoke link</AdminButton>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function toPayload(d: Draft) {
  return {
    line_items: d.lines.map((l) => ({ label: l.label.trim(), quantity: Number(l.quantity), unit_minor: Math.round(Number(l.unit) * 100) })) as never,
    discount_type: d.discount_type, discount_value: Number(d.discount_value) || 0, tax_label: d.tax_label.trim() || "VAT",
    tax_percentage: Number(d.tax_percentage) || 0, tax_inclusive: d.tax_inclusive,
    scope: d.scope.trim() || null, deliverables: d.deliverables.trim() || null, revisions: d.revisions === "" ? null : Number(d.revisions),
    delivery_timeline: d.delivery_timeline.trim() || null, payment_terms: d.payment_terms.trim() || null, valid_until: d.valid_until || null, customer_notes: d.customer_notes.trim() || null,
  };
}
function safeTotals(p: ReturnType<typeof toPayload>) {
  try {
    const t = computeQuoteTotals({ line_items: p.line_items as unknown as QuoteLineItem[], discount_type: p.discount_type, discount_value: p.discount_value, tax_percentage: p.tax_percentage, tax_inclusive: p.tax_inclusive });
    return { subtotal_minor: t.subtotal_minor, discount_minor: t.discount_minor, tax_minor: t.tax_minor, total_minor: t.total_minor };
  } catch { return null; }
}

function DraftEditor({ q, snap, v, onIssued, onChange }: { q: QuoteRow; snap: Snapshot; v: QuoteVersionRow; onIssued: (token: string) => void; onChange: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(v));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setD((o) => ({ ...o, [k]: val }));
  const setLine = (i: number, p: Partial<Draft["lines"][number]>) => set("lines", d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const payload = useMemo(() => toPayload(d), [d]);
  const result = useMemo(() => {
    if (!d.lines.length) return { error: "Add at least one line item." };
    if (d.lines.some((l) => !Number.isFinite(Number(l.unit)) || l.unit === "")) return { error: "Every line needs an amount." };
    try { return { t: computeQuoteTotals({ line_items: payload.line_items as unknown as QuoteLineItem[], discount_type: d.discount_type, discount_value: payload.discount_value, tax_percentage: payload.tax_percentage, tax_inclusive: d.tax_inclusive }) }; }
    catch (e) { return { error: e instanceof QuoteBuildError ? e.message : "Invalid quote." }; }
  }, [payload, d]);
  const t = "t" in result ? result.t : null;
  const orig = snap?.quote?.total ?? null;
  const cur = v.currency;

  async function save(silent = false) {
    if (!t) { toast.error("error" in result ? result.error : "Invalid"); return false; }
    setBusy(true);
    const { error } = await supabase.from("pricing_quote_versions").update({ ...payload, subtotal_minor: t.subtotal_minor, discount_minor: t.discount_minor, tax_minor: t.tax_minor, total_minor: t.total_minor }).eq("id", v.id);
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return false; }
    if (!silent) { toast.success("Draft saved"); onChange(); }
    return true;
  }
  async function issue() {
    if (!d.valid_until) return void toast.error("Set a valid-until date before issuing.");
    if (!(await save(true))) return;
    const token = newAccessToken();
    const { data: u } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const prev = await supabase.from("pricing_quote_versions").update({ status: "superseded" }).eq("quote_id", q.id).eq("status", "issued");
    if (prev.error) return void toast.error(friendlyError(prev.error));
    const { error } = await supabase.from("pricing_quote_versions").update({ status: "issued", issued_at: now, issued_by: u.user?.id ?? null, access_token_hash: await hashToken(token) }).eq("id", v.id);
    if (error) return void toast.error(friendlyError(error));
    await supabase.from("pricing_quote_requests").update({ status: "quoted", status_changed_at: now }).eq("id", q.id);
    await logQuoteActivity(q.id, "version_issued", { version: v.version, total_minor: t!.total_minor });
    toast.success(`Version ${v.version} issued`);
    onIssued(token);
  }
  async function discard() {
    const { error } = await supabase.from("pricing_quote_versions").delete().eq("id", v.id);
    if (error) return void toast.error(friendlyError(error));
    onChange();
  }

  return (
    <Panel title={`Draft — version ${v.version}`} description="Drafts are private. Issuing locks this version; later changes need a new version.">
      <div className="grid gap-3">
        <div className="hidden grid-cols-[1fr_80px_130px_110px_32px] gap-2 sm:grid"><span className="text-caption text-muted-foreground">Item</span><span className="text-caption text-muted-foreground">Qty</span><span className="text-caption text-muted-foreground">Unit (BDT)</span><span className="text-caption text-right text-muted-foreground">Amount</span><span /></div>
        {d.lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 rounded-sm border border-border p-2 sm:grid-cols-[1fr_80px_130px_110px_32px] sm:border-0 sm:p-0">
            <input aria-label="Item" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} className="text-small col-span-3 h-9 rounded-sm border border-input bg-surface px-2 sm:col-span-1" />
            <input aria-label="Quantity" type="number" min="0" step="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-2 tabular-nums" />
            <input aria-label="Unit amount" type="number" step="1" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className="text-small h-9 rounded-sm border border-input bg-surface px-2 tabular-nums" />
            <span className="text-small hidden self-center text-right tabular-nums sm:block">{money(Math.round(Number(l.unit) * 100 * Number(l.quantity)) || 0, cur)}</span>
            <button type="button" aria-label="Remove line" onClick={() => set("lines", d.lines.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <AdminButton size="sm" onClick={() => set("lines", [...d.lines, { label: "", quantity: "1", unit: "0" }])}><Plus className="size-3.5" /> Line item</AdminButton>
          <AdminButton size="sm" variant="ghost" onClick={() => set("lines", [...d.lines, { label: "Special production charge", quantity: "1", unit: "0" }])}>+ Special charge</AdminButton>
        </div>
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <SelectInput label="Discount" value={d.discount_type} onChange={(e) => set("discount_type", e.target.value as DiscountType)} options={[{ value: "none", label: "None" }, { value: "fixed", label: "Fixed BDT" }, { value: "percentage", label: "Percentage" }]} />
          {d.discount_type !== "none" && <TextInput label={d.discount_type === "fixed" ? "Discount (BDT)" : "Discount (%)"} type="number" min="0" value={d.discount_value} onChange={(e) => set("discount_value", e.target.value)} />}
          <TextInput label="Tax label" value={d.tax_label} onChange={(e) => set("tax_label", e.target.value)} />
          <TextInput label="Tax %" type="number" min="0" max="100" value={d.tax_percentage} onChange={(e) => set("tax_percentage", e.target.value)} />
          <div className="sm:col-span-4"><CheckboxInput label="Prices include tax" checked={d.tax_inclusive} onChange={(c) => set("tax_inclusive", c)} /></div>
        </div>
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <TextArea label="Scope" value={d.scope} onChange={(e) => set("scope", e.target.value)} />
          <TextArea label="Deliverables" value={d.deliverables} onChange={(e) => set("deliverables", e.target.value)} />
          <TextInput label="Revision rounds" type="number" min="0" value={d.revisions} onChange={(e) => set("revisions", e.target.value)} />
          <TextInput label="Delivery timeline" value={d.delivery_timeline} onChange={(e) => set("delivery_timeline", e.target.value)} />
          <TextArea label="Payment terms" value={d.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} />
          <TextInput label="Valid until" type="date" value={d.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
          <TextArea className="sm:col-span-2" label="Notes for the customer" value={d.customer_notes} onChange={(e) => set("customer_notes", e.target.value)} />
        </div>
        <div className="grid gap-1 rounded-md border border-border bg-muted/40 p-4 tabular-nums">
          {t ? (<>
            <KV k="Subtotal" v={money(t.subtotal_minor, cur)} />
            {t.discount_minor > 0 && <KV k="Discount" v={`− ${money(t.discount_minor, cur)}`} />}
            {t.tax_minor > 0 && <KV k={`${d.tax_label} ${d.tax_percentage}%${d.tax_inclusive ? " (included)" : ""}`} v={money(t.tax_minor, cur)} />}
            <KV k="Final quote total" v={<strong>{money(t.total_minor, cur)}</strong>} />
            <KV k="Original estimate" v={money(orig, cur)} />
            {orig != null && <KV k="Difference" v={<span className={t.total_minor - orig >= 0 ? "" : "text-accent"}>{t.total_minor - orig >= 0 ? "+" : "−"} {money(Math.abs(t.total_minor - orig), cur)}</span>} />}
          </>) : <p className="text-small text-destructive">{"error" in result ? result.error : ""}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="primary" disabled={busy || !t} onClick={() => void save()}>Save draft</AdminButton>
          <ConfirmButton variant="secondary" size="md" title={`Issue version ${v.version}?`} description={`Total ${t ? money(t.total_minor, cur) : "—"}. This locks the version and creates a private customer link. Any earlier issued version is superseded and its link stops working.`} confirmLabel="Issue quote" onConfirm={issue}>Issue to customer</ConfirmButton>
          <ConfirmButton variant="ghost" size="md" title="Discard this draft?" description="The draft is deleted. Issued versions are unaffected." confirmLabel="Discard" onConfirm={discard}>Discard draft</ConfirmButton>
        </div>
      </div>
    </Panel>
  );
}

function Activity({ id }: { id: string }) {
  const a = useQuery({ queryKey: ["cms", "quote", id, "activity"], queryFn: () => must(supabase.from("pricing_quote_activity").select("*").eq("quote_id", id).order("created_at", { ascending: false })) });
  if (a.isLoading) return <LoadingRow />;
  if (!a.data?.length) return <EmptyState>No activity yet.</EmptyState>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface">
      {a.data.map((x) => (
        <li key={x.id} className="text-small flex flex-wrap justify-between gap-3 px-4 py-3">
          <span><span className="text-caption mr-2 rounded-sm border border-border px-1.5 py-0.5 capitalize">{x.actor_type}</span>{x.kind.replace(/_/g, " ")}
            {Object.keys((x.detail as object) ?? {}).length > 0 && <span className="text-caption ml-2 text-muted-foreground">{JSON.stringify(x.detail)}</span>}</span>
          <span className="text-caption text-muted-foreground">{formatDate(x.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function Notes({ id }: { id: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const n = useQuery({ queryKey: ["cms", "quote", id, "notes"], queryFn: () => must(supabase.from("pricing_quote_notes").select("*").eq("quote_id", id).order("created_at", { ascending: false })) });
  async function add() {
    if (!text.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("pricing_quote_notes").insert({ quote_id: id, note: text.trim(), author_user_id: u.user?.id ?? null });
    if (error) return void toast.error(friendlyError(error));
    setText(""); qc.invalidateQueries({ queryKey: ["cms", "quote", id, "notes"] });
  }
  return (
    <div className="grid gap-4">
      <Panel title="Internal notes" description="Staff only. Never shown on the customer's quote.">
        <TextArea label="Add note" value={text} onChange={(e) => setText(e.target.value)} />
        <AdminButton className="mt-3" variant="primary" onClick={() => void add()}>Add note</AdminButton>
      </Panel>
      {(n.data ?? []).map((x) => <div key={x.id} className="rounded-md border border-border bg-surface p-4"><p className="text-small whitespace-pre-line">{x.note}</p><p className="text-caption mt-2 text-muted-foreground">{formatDate(x.created_at)}</p></div>)}
    </div>
  );
}
