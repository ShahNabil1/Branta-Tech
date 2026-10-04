import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/supabase/cms";
import type { ServiceItem, ServicePageConfig } from "@/lib/services";
import { AdminButton, ErrorNote, LoadingRow, Panel, SelectInput, StatusBadge, TextInput, friendlyError, isSafeUrl, swapped } from "@/components/admin/cms";

function ItemList({ title, description, items, onChange, heading, onHeading, placeholder }: {
  title: string; description: string; items: ServiceItem[]; onChange: (i: ServiceItem[]) => void;
  heading: string; onHeading: (h: string) => void; placeholder: string;
}) {
  const set = (i: number, patch: Partial<ServiceItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Panel title={title} description={description}>
      <TextInput label="Section heading" placeholder={placeholder} value={heading} onChange={(e) => onHeading(e.target.value)} />
      <ol className="mt-4 grid gap-3">
        {items.map((it, i) => (
          <li key={i} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[2rem_1fr_2fr_auto] md:items-end">
            <span className="text-caption pb-2 font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <TextInput label="Label" value={it.label} onChange={(e) => set(i, { label: e.target.value })} />
            <TextInput label="Short description (optional)" value={it.description} onChange={(e) => set(i, { description: e.target.value })} />
            <div className="flex gap-1">
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => onChange(swapped(items, i, i - 1))}><ArrowUp className="size-4" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onChange(swapped(items, i, i + 1))}><ArrowDown className="size-4" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-4" /></AdminButton>
            </div>
          </li>
        ))}
      </ol>
      <AdminButton size="sm" className="mt-3" onClick={() => onChange([...items, { label: "", description: "" }])}><Plus className="size-4" /> Add item</AdminButton>
    </Panel>
  );
}

/** Content tab: deliverables, service-specific process, CTA. Sections with no items stay hidden on the site. */
export function ServiceContentFields({ cfg, onChange }: { cfg: ServicePageConfig; onChange: (c: ServicePageConfig) => void }) {
  const ctaErr = cfg.cta.url && !isSafeUrl(cfg.cta.url) ? "Use /path or https:// URL." : null;
  return (
    <>
      <ItemList title="What we create" description="Deliverables specific to this service. Hidden when empty." items={cfg.deliverables}
        onChange={(deliverables) => onChange({ ...cfg, deliverables })} heading={cfg.deliverables_heading} onHeading={(deliverables_heading) => onChange({ ...cfg, deliverables_heading })} placeholder="What we create" />
      <ItemList title="Process" description="Steps for this kind of work — e.g. Concept → Direction → AI Production. Hidden when empty." items={cfg.process}
        onChange={(process) => onChange({ ...cfg, process })} heading={cfg.process_heading} onHeading={(process_heading) => onChange({ ...cfg, process_heading })} placeholder="How it works" />
      <Panel title="Call to action" description="Defaults: “Have an Idea? Bring It.” and “Start a Project” → /contact.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Heading" value={cfg.cta.heading} onChange={(e) => onChange({ ...cfg, cta: { ...cfg.cta, heading: e.target.value } })} />
          <TextInput label="Body" value={cfg.cta.body} onChange={(e) => onChange({ ...cfg, cta: { ...cfg.cta, body: e.target.value } })} />
          <TextInput label="Button label" value={cfg.cta.label} onChange={(e) => onChange({ ...cfg, cta: { ...cfg.cta, label: e.target.value } })} />
          <TextInput label="Button URL" placeholder="/contact" error={ctaErr} value={cfg.cta.url} onChange={(e) => onChange({ ...cfg, cta: { ...cfg.cta, url: e.target.value } })} />
        </div>
      </Panel>
    </>
  );
}

/** Related work: links live in portfolio_project_services (saved instantly); display order is saved with the service. */
export function ServiceRelatedWork({ serviceId, order, onOrder }: { serviceId: string; order: string[]; onOrder: (ids: string[]) => void }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const projects = useQuery({ queryKey: ["cms", "projects-lite"], queryFn: () => must(supabase.from("portfolio_projects").select("id,title,status").order("sort_order")) });
  const links = useQuery({ queryKey: ["cms", "service-links", serviceId], queryFn: () => must(supabase.from("portfolio_project_services").select("project_id").eq("service_id", serviceId)) });
  if (projects.isLoading || links.isLoading) return <LoadingRow />;
  if (projects.error || links.error) return <ErrorNote>{friendlyError(projects.error ?? links.error)}</ErrorNote>;
  const linked = new Set((links.data ?? []).map((l) => l.project_id));
  const all = projects.data ?? [];
  const ordered = [...order.filter((id) => linked.has(id)), ...all.filter((p) => linked.has(p.id) && !order.includes(p.id)).map((p) => p.id)];
  const byId = new Map(all.map((p) => [p.id, p]));
  const refresh = () => qc.invalidateQueries({ queryKey: ["cms", "service-links", serviceId] });

  async function add() {
    if (!pick || busy) return;
    setBusy(true);
    const { error } = await supabase.from("portfolio_project_services").insert({ project_id: pick, service_id: serviceId });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    setPick("");
    refresh();
  }
  async function remove(id: string) {
    setBusy(true);
    const { error } = await supabase.from("portfolio_project_services").delete().eq("project_id", id).eq("service_id", serviceId);
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    onOrder(order.filter((x) => x !== id));
    refresh();
  }

  return (
    <Panel title="Related work" description="Projects linked to this service. Only published projects show on the site (up to six, in this order). Linking saves instantly; save the service to keep the order.">
      {ordered.length === 0 ? <p className="text-small text-muted-foreground">No projects linked yet — the Selected work section stays hidden.</p> : (
        <ol className="grid gap-2">
          {ordered.map((id, i) => {
            const p = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <span className="text-caption w-6 font-mono text-muted-foreground">{i + 1}</span>
                <span className="text-small min-w-0 flex-1 truncate">{p?.title ?? "Unknown project"}</span>
                {p && <StatusBadge status={p.status} />}
                <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => onOrder(swapped(ordered, i, i - 1))}><ArrowUp className="size-4" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === ordered.length - 1} onClick={() => onOrder(swapped(ordered, i, i + 1))}><ArrowDown className="size-4" /></AdminButton>
                <AdminButton size="sm" variant="ghost" aria-label="Unlink" disabled={busy} onClick={() => remove(id)}><X className="size-4" /></AdminButton>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <SelectInput label="Link a project" className="min-w-64 flex-1" value={pick} onChange={(e) => setPick(e.target.value)}
          options={[{ value: "", label: "Choose a project…" }, ...all.filter((p) => !linked.has(p.id)).map((p) => ({ value: p.id, label: `${p.title}${p.status !== "published" ? ` (${p.status})` : ""}` }))]} />
        <AdminButton onClick={add} disabled={!pick || busy}><Plus className="size-4" /> Link</AdminButton>
      </div>
    </Panel>
  );
}
