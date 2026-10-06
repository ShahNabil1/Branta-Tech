import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, SelectInput, TextArea, TextInput, friendlyError, nullIfEmpty } from "@/components/admin/cms";
import { NumField, Pill, PricingCrud, PricingPage, nextOrder, parseMoney, useRefreshPricing } from "@/components/admin/pricing/PricingKit";
import { bdt, CHARGE_TYPE_LABEL, type AddonRow, type AdminPricing } from "@/lib/pricing/admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/addons")({
  head: () => adminHead("Pricing add-ons"),
  component: () => (
    <PricingPage title="Add-ons" description="Optional extras. They're only charged when a client explicitly selects them and they apply to the chosen video type. Percentage add-ons are charged on base fee + production + other add-ons.">
      {(d) => <Addons d={d} />}
    </PricingPage>
  ),
});

const fmtCharge = (a: AddonRow) =>
  a.charge_type === "percentage" ? `${Number(a.percentage)}%` : `${bdt(a.amount)}${a.charge_type === "per_second" ? " / sec" : a.charge_type === "per_scene" ? " / scene" : ""}`;

function Addons({ d }: { d: AdminPricing }) {
  const refresh = useRefreshPricing();
  const scopeLabel = (a: AddonRow) => {
    const ids = d.scopes.filter((s) => s.addon_id === a.id).map((s) => s.video_type_id);
    return ids.length ? d.videoTypes.filter((v) => ids.includes(v.id)).map((v) => v.name).join(", ") : "All video types";
  };
  return (
    <PricingCrud<AddonRow>
      table="pricing_addons" rows={d.addons} newLabel="Add add-on" empty="No add-ons yet."
      head={["Add-on", "Type", "Charge", "Applies to", "Enabled"]}
      cells={(a) => [
        <p className="font-medium">{a.name}</p>, CHARGE_TYPE_LABEL[a.charge_type], fmtCharge(a),
        <span className="text-caption text-muted-foreground">{scopeLabel(a)}</span>,
        <Pill on={a.enabled} onLabel="On" offLabel="Off" onClick={async () => {
          const { error } = await supabase.from("pricing_addons").update({ enabled: !a.enabled }).eq("id", a.id);
          if (error) toast.error(friendlyError(error)); refresh();
        }} />,
      ]}
      deleteWarning={(a) => `This permanently removes "${a.name}".`}
      form={(a, done) => <AddonForm a={a} d={d} done={done} />}
    />
  );
}

function AddonForm({ a, d, done }: { a: AddonRow | null; d: AdminPricing; done: () => void }) {
  const [name, setName] = useState(a?.name ?? "");
  const [desc, setDesc] = useState(a?.description ?? "");
  const [type, setType] = useState(a?.charge_type ?? "fixed");
  const [amount, setAmount] = useState(a?.amount != null ? String(a.amount) : "");
  const [pct, setPct] = useState(a?.percentage != null ? String(a.percentage) : "");
  const [types, setTypes] = useState<string[]>(a ? d.scopes.filter((s) => s.addon_id === a.id).map((s) => s.video_type_id) : []);
  const [enabled, setEnabled] = useState(a?.enabled ?? true);
  const [pub, setPub] = useState(a?.published ?? false);
  const [busy, setBusy] = useState(false);
  const isPct = type === "percentage";
  const amtN = parseMoney(amount);
  const pctN = Number(pct);
  const amtErr = !isPct && amtN == null ? "Enter 0 or more" : null;
  const pctErr = isPct && !(pct !== "" && pctN >= 0 && pctN <= 100) ? "Between 0 and 100" : null;

  async function save() {
    if (!name.trim() || amtErr || pctErr) return void toast.error("Check the fields.");
    setBusy(true);
    const payload = { name: name.trim(), description: nullIfEmpty(desc), charge_type: type, amount: isPct ? null : amtN, percentage: isPct ? pctN : null, enabled, published: pub };
    const res = a ? await supabase.from("pricing_addons").update(payload).eq("id", a.id).select("id").single() : await supabase.from("pricing_addons").insert({ ...payload, sort_order: nextOrder(d.addons) }).select("id").single();
    if (res.error) { setBusy(false); return void toast.error(friendlyError(res.error)); }
    const id = res.data.id;
    const del = await supabase.from("pricing_addon_video_types").delete().eq("addon_id", id);
    const ins = types.length ? await supabase.from("pricing_addon_video_types").insert(types.map((t) => ({ addon_id: id, video_type_id: t }))) : { error: null };
    setBusy(false);
    if (del.error || ins.error) return void toast.error(friendlyError(del.error ?? ins.error));
    toast.success("Add-on saved");
    done();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextArea label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <SelectInput label="Charge type" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(CHARGE_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
      {isPct ? <NumField label="Percentage" suffix="%" step="0.5" value={pct} onChange={setPct} error={pctErr} />
        : <NumField label={type === "per_second" ? "Amount per second" : type === "per_scene" ? "Amount per scene" : "Amount"} suffix="BDT" value={amount} onChange={setAmount} error={amtErr} />}
      <fieldset>
        <legend className="text-small mb-1.5 font-medium">Applicable video types</legend>
        <p className="text-caption mb-2 text-muted-foreground">Leave all unticked to apply to every video type.</p>
        <div className="grid grid-cols-2 gap-2">
          {d.videoTypes.map((v) => (
            <CheckboxInput key={v.id} label={v.name} checked={types.includes(v.id)} onChange={(c) => setTypes((p) => (c ? [...p, v.id] : p.filter((x) => x !== v.id)))} />
          ))}
        </div>
      </fieldset>
      <CheckboxInput label="Enabled" checked={enabled} onChange={setEnabled} />
      <CheckboxInput label="Published" checked={pub} onChange={setPub} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save add-on"}</AdminButton>
    </div>
  );
}
