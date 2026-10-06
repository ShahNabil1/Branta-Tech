import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, TextArea, TextInput, friendlyError, nullIfEmpty, SLUG_RE, useAutoSlug } from "@/components/admin/cms";
import { Pill, PricingCrud, PricingPage, nextOrder, useRefreshPricing } from "@/components/admin/pricing/PricingKit";
import type { AdminPricing, ModelRow } from "@/lib/pricing/admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/ai-models")({
  head: () => adminHead("Pricing AI models"),
  component: () => (
    <PricingPage title="AI models" description="Generation models offered for quotes. New models appear in the rate matrix automatically — set their per-second rates there.">
      {(d) => <Models d={d} />}
    </PricingPage>
  ),
});

function Models({ d }: { d: AdminPricing }) {
  const refresh = useRefreshPricing();
  async function toggleAvail(m: ModelRow) {
    const { error } = await supabase.from("pricing_ai_models").update({ available: !m.available }).eq("id", m.id);
    if (error) toast.error(friendlyError(error)); else toast.success(m.available ? `${m.name} disabled` : `${m.name} enabled`);
    refresh();
  }
  return (
    <PricingCrud<ModelRow>
      table="pricing_ai_models" rows={d.models} newLabel="Add model" empty="No AI models yet."
      head={["Model", "Availability", "Rates set"]}
      cells={(m) => [
        <><p className="font-medium">{m.name}</p><p className="text-caption text-muted-foreground">{m.slug}</p></>,
        <Pill on={m.available} onLabel="Enabled" offLabel="Disabled" onClick={() => toggleAvail(m)} title="Click to toggle" />,
        `${d.rates.filter((r) => r.ai_model_id === m.id).length}/${d.videoTypes.length}`,
      ]}
      deleteWarning={(m) => `This permanently removes ${m.name} and its ${d.rates.filter((r) => r.ai_model_id === m.id).length} per-second rates. Disabling keeps the rates for later.`}
      form={(m, done) => <ModelForm m={m} d={d} done={done} />}
    />
  );
}

function ModelForm({ m, d, done }: { m: ModelRow | null; d: AdminPricing; done: () => void }) {
  const [name, setName] = useState(m?.name ?? "");
  const slug = useAutoSlug(m?.slug ?? "", !m);
  const [desc, setDesc] = useState(m?.description ?? "");
  const [avail, setAvail] = useState(m?.available ?? true);
  const [pub, setPub] = useState(m?.published ?? false);
  const [busy, setBusy] = useState(false);
  const slugErr = slug.slug && !SLUG_RE.test(slug.slug) ? "Lowercase letters, numbers and hyphens" : null;
  async function save() {
    if (!name.trim() || !slug.slug || slugErr) return void toast.error("Check the fields.");
    setBusy(true);
    const payload = { name: name.trim(), slug: slug.slug, description: nullIfEmpty(desc), available: avail, published: pub };
    const res = m ? await supabase.from("pricing_ai_models").update(payload).eq("id", m.id) : await supabase.from("pricing_ai_models").insert({ ...payload, sort_order: nextOrder(d.models) });
    setBusy(false);
    if (res.error) return void toast.error(friendlyError(res.error));
    toast.success(m ? "Model saved" : "Model added — set its rates in the matrix");
    done();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Name" value={name} onChange={(e) => { setName(e.target.value); slug.syncFrom(e.target.value); }} />
      <TextInput label="Slug" value={slug.slug} error={slugErr} onChange={(e) => slug.setSlug(e.target.value)} />
      <TextArea label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <CheckboxInput label="Available" hint="Disabled models can't be quoted, even if published." checked={avail} onChange={setAvail} />
      <CheckboxInput label="Published" checked={pub} onChange={setPub} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save model"}</AdminButton>
    </div>
  );
}
