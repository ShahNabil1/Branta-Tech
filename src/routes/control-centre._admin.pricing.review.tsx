import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Check } from "lucide-react";
import { adminHead } from "@/lib/supabase/cms";
import { DataTable, Panel, Td } from "@/components/admin/cms";
import { PricingPage } from "@/components/admin/pricing/PricingKit";
import { bdt, CHARGE_TYPE_LABEL, publishReadiness, type AdminPricing } from "@/lib/pricing/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/pricing/review")({
  head: () => adminHead("Pricing publication review"),
  component: () => (
    <PricingPage wide title="Publication review" description="Everything the public pricing page would show, in one place. Nothing here publishes automatically — publish items on their own screens, then enable public pricing in Settings once every check passes.">
      {(d) => <Review d={d} />}
    </PricingPage>
  ),
});

const Pill = ({ on, yes = "Published", no = "Draft" }: { on: boolean; yes?: string; no?: string }) => (
  <span className={cn("text-caption rounded-sm border px-2 py-0.5", on ? "border-accent/40 bg-accent/10" : "border-border text-muted-foreground")}>{on ? yes : no}</span>
);

function Review({ d }: { d: AdminPricing }) {
  const { errors, warnings } = publishReadiness(d);
  const live = d.settings.enabled && d.settings.public_visible;
  const model = (id: string) => d.models.find((m) => m.id === id);
  return (
    <div className="grid gap-6">
      <Panel title="Public visibility">
        <div className="text-small flex flex-wrap items-center gap-3">
          <Pill on={d.settings.enabled} yes="Engine enabled" no="Engine off" />
          <Pill on={d.settings.public_visible} yes="Visible on site" no="Hidden from site" />
          <span className="text-muted-foreground">Currency {d.settings.currency}</span>
          <Link to="/control-centre/pricing/settings" className="ml-auto font-medium text-accent hover:underline">Open settings →</Link>
        </div>
        <p className="text-caption mt-3 text-muted-foreground">{live ? "Public pricing is live." : "Public pricing is off — visitors only see custom-quote options."} Enabling it is blocked in Settings until the readiness checks below pass.</p>
      </Panel>
      <Panel title={errors.length ? `Readiness — ${errors.length} blocking issue${errors.length > 1 ? "s" : ""}` : "Readiness — ready to enable"}>
        <ul className="text-small grid gap-1.5">
          {errors.map((e) => <li key={e} className="flex gap-2 text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{e}</li>)}
          {warnings.map((w) => <li key={w} className="flex gap-2 text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</li>)}
          {!errors.length && !warnings.length && <li className="flex gap-2"><Check className="size-4 text-accent" />All checks pass.</li>}
        </ul>
      </Panel>
      <Panel title="Video types & minimum prices">
        <DataTable head={["Video type", "Status", "Base fee", "Minimum price"]}>
          {d.videoTypes.map((v) => <tr key={v.id}><Td>{v.name}</Td><Td><Pill on={v.published} /></Td><Td className="tabular-nums">{bdt(v.base_creative_fee)}</Td><Td className="tabular-nums">{Number(v.minimum_project_price) > 0 ? bdt(v.minimum_project_price) : <span className="text-muted-foreground">Not set</span>}</Td></tr>)}
        </DataTable>
      </Panel>
      <Panel title="AI models">
        <DataTable head={["Model", "Status", "Available"]}>
          {d.models.map((m) => <tr key={m.id}><Td>{m.name}</Td><Td><Pill on={m.published} /></Td><Td><Pill on={m.available} yes="Available" no="Unavailable" /></Td></tr>)}
        </DataTable>
      </Panel>
      <Panel title="Per-second rates">
        <DataTable head={["Video type", "Model", "Rate / sec", "Enabled"]}>
          {d.rates.map((r) => <tr key={r.id}><Td>{d.videoTypes.find((v) => v.id === r.video_type_id)?.name ?? "—"}</Td><Td>{model(r.ai_model_id)?.name ?? "—"}</Td><Td className="tabular-nums">{bdt(r.per_second_rate)}</Td><Td><Pill on={r.enabled} yes="Enabled" no="Off" /></Td></tr>)}
        </DataTable>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Production tiers">
          <DataTable head={["Tier", "Status", "Multiplier"]}>
            {d.tiers.map((t) => <tr key={t.id}><Td>{t.name}</Td><Td><Pill on={t.published} /></Td><Td className="tabular-nums">{Number(t.multiplier)}×</Td></tr>)}
          </DataTable>
        </Panel>
        <Panel title="Add-ons">
          <DataTable head={["Add-on", "Status", "Charge"]}>
            {d.addons.map((a) => <tr key={a.id}><Td>{a.name}</Td><Td><Pill on={a.published && a.enabled} /></Td><Td className="tabular-nums">{CHARGE_TYPE_LABEL[a.charge_type] ?? a.charge_type}: {a.charge_type === "percentage" ? (a.percentage == null ? "—" : `${a.percentage}%`) : a.amount == null ? "—" : bdt(a.amount)}</Td></tr>)}
          </DataTable>
        </Panel>
      </div>
    </div>
  );
}
