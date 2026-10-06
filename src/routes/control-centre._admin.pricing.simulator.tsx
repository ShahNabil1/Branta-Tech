import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { CheckboxInput, ErrorNote, Panel, SelectInput } from "@/components/admin/cms";
import { NumField, PricingPage } from "@/components/admin/pricing/PricingKit";
import { calculateQuote, PricingError } from "@/lib/pricing/engine";
import { bdtMinor, toEngineConfig, type AdminPricing } from "@/lib/pricing/admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/simulator")({
  head: () => adminHead("Pricing simulator"),
  component: () => (
    <PricingPage wide title="Pricing simulator" description="Internal preview using the same engine the server uses. Includes drafts. Nothing is saved and no quotation or booking is created.">
      {(d) => <Simulator d={d} />}
    </PricingPage>
  ),
});

function Simulator({ d }: { d: AdminPricing }) {
  const config = useMemo(() => toEngineConfig(d), [d]);
  const bySlug = <T extends { slug: string; id: string }>(rows: T[], slug: string | null) => rows.find((r) => r.slug === slug)?.id ?? rows[0]?.id ?? "";
  const [vt, setVt] = useState(() => bySlug(d.videoTypes, d.settings.default_video_type));
  const [model, setModel] = useState(() => bySlug(d.models, d.settings.default_ai_model));
  const [tier, setTier] = useState(() => bySlug(d.tiers, d.settings.default_tier));
  const [dur, setDur] = useState(String(Math.max(d.settings.min_duration, 30)));
  const [scenes, setScenes] = useState("1");
  const [addons, setAddons] = useState<string[]>([]);

  const applicable = config.addons.filter((a) => a.enabled && (!a.video_type_ids.length || a.video_type_ids.includes(vt)));
  const result = useMemo(() => {
    try {
      return { quote: calculateQuote(config, {
        videoTypeId: vt, modelId: model, tierId: tier, durationSeconds: Number(dur),
        addons: addons.filter((id) => applicable.some((a) => a.id === id)).map((id) => ({ id, scenes: Number(scenes) })),
      }, "admin") };
    } catch (e) { return { error: e instanceof PricingError ? e.message : String(e) }; }
  }, [config, vt, model, tier, dur, scenes, addons, applicable]);

  const q = result.quote;
  const Row = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
    <div className={`flex justify-between gap-4 py-1.5 ${strong ? "text-body font-semibold" : "text-small"}`}><span className={strong ? "" : "text-muted-foreground"}>{l}</span><span className="tabular-nums">{v}</span></div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="Video type" value={vt} onChange={(e) => setVt(e.target.value)} options={d.videoTypes.map((v) => ({ value: v.id, label: `${v.name}${v.published ? "" : " (draft)"}` }))} />
          <SelectInput label="AI model" value={model} onChange={(e) => setModel(e.target.value)} options={d.models.map((m) => ({ value: m.id, label: `${m.name}${m.available ? "" : " (disabled)"}${m.published ? "" : " (draft)"}` }))} />
          <NumField label="Duration" suffix="sec" step={String(d.settings.duration_step)} value={dur} onChange={setDur} hint={`${d.settings.min_duration}–${d.settings.max_duration}s, steps of ${d.settings.duration_step}`} />
          <SelectInput label="Production tier" value={tier} onChange={(e) => setTier(e.target.value)} options={d.tiers.map((t) => ({ value: t.id, label: `${t.name} (${Number(t.multiplier).toFixed(2)}×)${t.published ? "" : " · draft"}` }))} />
          <NumField label="Scene count" hint="Used by per-scene add-ons" value={scenes} onChange={setScenes} />
        </div>
        <fieldset className="mt-5">
          <legend className="text-small mb-2 font-medium">Add-ons</legend>
          {applicable.length === 0 ? <p className="text-caption text-muted-foreground">No enabled add-ons apply to this video type.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {applicable.map((a) => <CheckboxInput key={a.id} label={a.name} hint={a.charge_type === "percentage" ? `${a.percentage}%` : `${bdtMinor((a.amount ?? 0) * 100)}${a.charge_type === "per_second" ? " / sec" : a.charge_type === "per_scene" ? " / scene" : ""}${a.published ? "" : " · draft"}`}
                checked={addons.includes(a.id)} onChange={(c) => setAddons((p) => (c ? [...p, a.id] : p.filter((x) => x !== a.id)))} />)}
            </div>
          )}
        </fieldset>
      </Panel>
      <Panel title="Breakdown" className="h-fit lg:sticky lg:top-6">
        {!q ? <ErrorNote>{result.error}</ErrorNote> : (
          <div className="divide-y divide-border">
            <div className="pb-2">
              <Row l="Base creative fee" v={bdtMinor(q.baseFee)} />
              <Row l="AI model" v={q.model.name} />
              <Row l="Per-second rate" v={bdtMinor(q.ratePerSecond)} />
              <Row l="Duration" v={`${q.durationSeconds}s`} />
              <Row l="Tier multiplier" v={`${q.tier.name} · ${q.tier.multiplier.toFixed(2)}×`} />
              <Row l="Production subtotal" v={bdtMinor(q.variableSubtotal)} />
            </div>
            <div className="py-2">
              {q.addonLines.length === 0 ? <Row l="Add-ons" v="None" /> : q.addonLines.map((l) => (
                <Row key={l.addonId} l={`${l.name}${l.chargeType === "per_second" ? ` × ${l.quantity}s` : l.chargeType === "per_scene" ? ` × ${l.quantity}` : l.chargeType === "percentage" ? ` (${l.quantity}%)` : ""}`} v={bdtMinor(l.amount)} />
              ))}
            </div>
            <div className="py-2">
              <Row l="Subtotal" v={bdtMinor(q.subtotal)} />
              <Row l="Minimum price adjustment" v={q.minimumAdjustment ? `+ ${bdtMinor(q.minimumAdjustment)}` : "—"} />
              <Row l="Rounding adjustment" v={q.roundingAdjustment ? `+ ${bdtMinor(q.roundingAdjustment)}` : "—"} />
              <Row l={q.tax ? `${q.tax.label} ${q.tax.percentage}%${q.tax.inclusive ? " (included)" : ""}` : "Tax"} v={q.tax ? bdtMinor(q.tax.amount) : "Off"} />
            </div>
            <div className="pt-2"><Row strong l="Estimated total" v={`${bdtMinor(q.total)} ${q.currency}`} /></div>
          </div>
        )}
      </Panel>
    </div>
  );
}
