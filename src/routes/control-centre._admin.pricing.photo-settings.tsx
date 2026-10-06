import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, Panel, TextInput, friendlyError } from "@/components/admin/cms";
import { NumField, PhotoPage } from "@/components/admin/pricing/PricingKit";
import { photoReadiness, savePhotoSettings, type AdminPhoto } from "@/lib/pricing/photo-admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/photo-settings")({
  head: () => adminHead("Photography settings"),
  component: () => <PhotoPage title="Photography settings" description="Public photography pricing needs this switch AND the shared public-pricing switches in Settings.">{(d, r) => <Form d={d} refresh={r} />}</PhotoPage>,
});

function Form({ d, refresh }: { d: AdminPhoto; refresh: () => void }) {
  const s = d.settings;
  const [enabled, setEnabled] = useState(s.enabled);
  const [minOn, setMinOn] = useState(s.minimum_order_enabled);
  const [min, setMin] = useState(String(s.minimum_order));
  const [round, setRound] = useState(String(s.rounding_increment));
  const [maxP, setMaxP] = useState(String(s.max_products));
  const [maxI, setMaxI] = useState(String(s.max_images_per_product));
  const [wf, setWf] = useState(s.workflows.map((w) => w.name).join(", "));
  const [bg, setBg] = useState(s.backgrounds.join(", "));
  const [busy, setBusy] = useState(false);
  const ready = photoReadiness(d);
  async function save() {
    const nums = [Number(min), Number(round), Number(maxP), Number(maxI)];
    if (nums.some((n) => !Number.isFinite(n) || n < 0) || !Number.isInteger(Number(maxP)) || !Number.isInteger(Number(maxI)) || Number(maxP) < 1 || Number(maxI) < 1) return void toast.error("Check the numbers.");
    const workflows = wf.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 6).map((name) => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
    if (!workflows.length) return void toast.error("Add at least one workflow.");
    if (enabled && ready.errors.length) return void toast.error("Fix the readiness errors before turning photography pricing on.");
    setBusy(true);
    try {
      await savePhotoSettings({ ...s, enabled, minimum_order_enabled: minOn, minimum_order: Number(min), rounding_increment: Number(round), max_products: Number(maxP), max_images_per_product: Number(maxI), workflows, backgrounds: bg.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10) });
      toast.success("Photography settings saved"); refresh();
    } catch (e) { toast.error(friendlyError(e)); }
    setBusy(false);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Panel title="Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><CheckboxInput label="Photography pricing on" hint="Also requires public pricing to be on in shared Settings." checked={enabled} onChange={setEnabled} /></div>
          <NumField label="Minimum order (individual images)" value={min} onChange={setMin} suffix="BDT" />
          <div className="self-end"><CheckboxInput label="Apply minimum order" checked={minOn} onChange={setMinOn} /></div>
          <NumField label="Rounding increment" value={round} onChange={setRound} suffix="BDT" hint="0 = no rounding" />
          <NumField label="Max products per order" value={maxP} onChange={setMaxP} />
          <NumField label="Max images per product" value={maxI} onChange={setMaxI} />
          <div className="sm:col-span-2"><TextInput label="Image workflows (comma separated)" value={wf} onChange={(e) => setWf(e.target.value)} hint="Workflow choice never changes the price." /></div>
          <div className="sm:col-span-2"><TextInput label="Background options (comma separated)" value={bg} onChange={(e) => setBg(e.target.value)} /></div>
        </div>
        <div className="mt-6"><AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</AdminButton></div>
      </Panel>
      <Panel title="Readiness">
        {ready.errors.length === 0 && <p className="text-small text-muted-foreground">No blocking issues.</p>}
        <ul className="text-small grid gap-1.5">
          {ready.errors.map((e) => <li key={e} className="text-destructive">• {e}</li>)}
          {ready.warnings.map((w) => <li key={w} className="text-muted-foreground">• {w}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
