import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, TextArea, TextInput, friendlyError, nullIfEmpty, SLUG_RE, useAutoSlug } from "@/components/admin/cms";
import { NumField, PricingCrud, PricingPage, nextOrder } from "@/components/admin/pricing/PricingKit";
import type { AdminPricing, TierRow } from "@/lib/pricing/admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/production-tiers")({
  head: () => adminHead("Pricing tiers"),
  component: () => (
    <PricingPage title="Production tiers" description="The tier multiplier applies only to the production component (duration × per-second rate) — not to the base creative fee or add-ons.">
      {(d) => (
        <PricingCrud<TierRow>
          table="pricing_production_tiers" rows={d.tiers} newLabel="Add tier" empty="No tiers yet."
          head={["Tier", "Multiplier", "Description"]}
          cells={(t) => [<p className="font-medium">{t.name}</p>, `${Number(t.multiplier).toFixed(2)}×`, <span className="text-muted-foreground">{t.description ?? "—"}</span>]}
          deleteWarning={(t) => `This permanently removes the ${t.name} tier.`}
          form={(t, done) => <TierForm t={t} d={d} done={done} />}
        />
      )}
    </PricingPage>
  ),
});

function TierForm({ t, d, done }: { t: TierRow | null; d: AdminPricing; done: () => void }) {
  const [name, setName] = useState(t?.name ?? "");
  const slug = useAutoSlug(t?.slug ?? "", !t);
  const [desc, setDesc] = useState(t?.description ?? "");
  const [mult, setMult] = useState(String(t?.multiplier ?? "1"));
  const [pub, setPub] = useState(t?.published ?? false);
  const [busy, setBusy] = useState(false);
  const m = Number(mult);
  const multErr = !(m >= 0.5 && m <= 5) || Math.round(m * 1000) !== m * 1000 ? "Between 0.5 and 5, up to 3 decimals" : null;
  const slugErr = slug.slug && !SLUG_RE.test(slug.slug) ? "Lowercase letters, numbers and hyphens" : null;
  async function save() {
    if (!name.trim() || !slug.slug || slugErr || multErr) return void toast.error("Check the fields.");
    setBusy(true);
    const payload = { name: name.trim(), slug: slug.slug, description: nullIfEmpty(desc), multiplier: m, published: pub };
    const res = t ? await supabase.from("pricing_production_tiers").update(payload).eq("id", t.id) : await supabase.from("pricing_production_tiers").insert({ ...payload, sort_order: nextOrder(d.tiers) });
    setBusy(false);
    if (res.error) return void toast.error(friendlyError(res.error));
    toast.success("Tier saved");
    done();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Name" value={name} onChange={(e) => { setName(e.target.value); slug.syncFrom(e.target.value); }} />
      <TextInput label="Slug" value={slug.slug} error={slugErr} onChange={(e) => slug.setSlug(e.target.value)} />
      <NumField label="Multiplier" step="0.05" suffix="×" value={mult} onChange={setMult} error={multErr} hint="1.00 = standard production cost" />
      <TextArea label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <CheckboxInput label="Published" checked={pub} onChange={setPub} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save tier"}</AdminButton>
    </div>
  );
}
