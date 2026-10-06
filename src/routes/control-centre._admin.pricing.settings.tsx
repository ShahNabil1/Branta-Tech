import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, ErrorNote, Panel, SaveBar, SelectInput, TextArea, TextInput, friendlyError, useFormState, useUnsavedWarning } from "@/components/admin/cms";
import { NumField, PricingPage, useRefreshPricing } from "@/components/admin/pricing/PricingKit";
import { publishReadiness, savePricingSettings, validateSettings, type AdminPricing, type PricingSettingsFull } from "@/lib/pricing/admin";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/control-centre/_admin/pricing/settings")({
  head: () => adminHead("Pricing settings"),
  component: () => (
    <PricingPage title="Pricing settings" description="Defaults and rules for every estimate. Public pricing stays off until you turn it on here.">
      {(d) => <Settings d={d} />}
    </PricingPage>
  ),
});

type F = Omit<PricingSettingsFull, "tax" | "min_duration" | "max_duration" | "duration_step" | "rounding_increment"> & {
  min_duration: string; max_duration: string; duration_step: string; rounding_increment: string;
  tax_enabled: boolean; tax_label: string; tax_percentage: string; tax_inclusive: boolean;
};

function Settings({ d }: { d: AdminPricing }) {
  const refresh = useRefreshPricing();
  const s = d.settings;
  const f = useFormState<F>({
    ...s, min_duration: String(s.min_duration), max_duration: String(s.max_duration), duration_step: String(s.duration_step),
    rounding_increment: String(s.rounding_increment), tax_enabled: s.tax.enabled, tax_label: s.tax.label, tax_percentage: String(s.tax.percentage), tax_inclusive: s.tax.inclusive,
  });
  useUnsavedWarning(f.dirty);
  const [confirm, setConfirm] = useState(false);
  const v = f.values;
  const toSettings = (): PricingSettingsFull => ({
    enabled: v.enabled, public_visible: v.public_visible, currency: v.currency.trim().toUpperCase(),
    default_video_type: v.default_video_type || null, default_ai_model: v.default_ai_model || null, default_tier: v.default_tier || null,
    min_duration: Number(v.min_duration), max_duration: Number(v.max_duration), duration_step: Number(v.duration_step),
    rounding_increment: Number(v.rounding_increment), disclaimer: v.disclaimer,
    tax: { enabled: v.tax_enabled, label: v.tax_label.trim() || "VAT", percentage: Number(v.tax_percentage) || 0, inclusive: v.tax_inclusive },
  });
  const next = toSettings();
  const errors = validateSettings(next, d);
  const goingPublic = next.enabled && next.public_visible && !(s.enabled && s.public_visible);
  const readiness = publishReadiness({ ...d, settings: next });

  async function save() {
    if (errors.length) return void f.fail(errors[0]!);
    if (goingPublic && !confirm) {
      if (readiness.errors.length) return void f.fail("Fix the publish checks before enabling public pricing.");
      return setConfirm(true);
    }
    setConfirm(false);
    f.begin();
    try { await savePricingSettings(next); f.markSaved(v); toast.success("Pricing settings saved"); refresh(); }
    catch (e) { f.fail(friendlyError(e)); }
  }

  return (
    <div className="grid gap-6">
      <Panel title="General">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Default currency" value={v.currency} onChange={(e) => f.set("currency", e.target.value)} hint="All rates are stored in this currency. No conversion is applied." />
          <div />
          <SelectInput label="Default video type" value={v.default_video_type ?? ""} onChange={(e) => f.set("default_video_type", e.target.value)} options={[{ value: "", label: "First available" }, ...d.videoTypes.map((x) => ({ value: x.slug, label: x.name }))]} />
          <SelectInput label="Default AI model" value={v.default_ai_model ?? ""} onChange={(e) => f.set("default_ai_model", e.target.value)} options={[{ value: "", label: "First available" }, ...d.models.filter((m) => m.available).map((x) => ({ value: x.slug, label: x.name }))]} />
          <SelectInput label="Default tier" value={v.default_tier ?? ""} onChange={(e) => f.set("default_tier", e.target.value)} options={[{ value: "", label: "First available" }, ...d.tiers.map((x) => ({ value: x.slug, label: x.name }))]} />
        </div>
      </Panel>
      <Panel title="Duration & rounding">
        <div className="grid gap-4 sm:grid-cols-4">
          <NumField label="Minimum duration" suffix="sec" value={v.min_duration} onChange={(x) => f.set("min_duration", x)} />
          <NumField label="Maximum duration" suffix="sec" value={v.max_duration} onChange={(x) => f.set("max_duration", x)} />
          <NumField label="Duration increment" suffix="sec" value={v.duration_step} onChange={(x) => f.set("duration_step", x)} />
          <NumField label="Round up to nearest" suffix="BDT" value={v.rounding_increment} onChange={(x) => f.set("rounding_increment", x)} />
        </div>
      </Panel>
      <Panel title="Tax">
        <div className="grid gap-4 sm:grid-cols-3">
          <CheckboxInput label="Tax enabled" checked={v.tax_enabled} onChange={(c) => f.set("tax_enabled", c)} />
          <TextInput label="Label" value={v.tax_label} onChange={(e) => f.set("tax_label", e.target.value)} />
          <NumField label="Percentage" suffix="%" step="0.5" value={v.tax_percentage} onChange={(x) => f.set("tax_percentage", x)} />
          <CheckboxInput label="Prices include tax" hint="Off = tax is added on top of the estimate." checked={v.tax_inclusive} onChange={(c) => f.set("tax_inclusive", c)} />
        </div>
      </Panel>
      <Panel title="Public pricing" description="Both switches must be on for visitors to see or calculate prices (public page arrives in a later phase).">
        <div className="grid gap-4">
          <CheckboxInput label="Pricing engine enabled" hint="Allows public estimates to be calculated." checked={v.enabled} onChange={(c) => f.set("enabled", c)} />
          <CheckboxInput label="Public pricing visible" checked={v.public_visible} onChange={(c) => f.set("public_visible", c)} />
          <TextArea label="Estimate disclaimer" value={v.disclaimer} onChange={(e) => f.set("disclaimer", e.target.value)} />
          {next.enabled && next.public_visible && readiness.errors.length > 0 && (
            <ErrorNote>Not ready to go public:<br />{readiness.errors.map((e) => <span key={e} className="block">• {e}</span>)}</ErrorNote>
          )}
        </div>
      </Panel>
      {errors.length > 0 && <ErrorNote>{errors.map((e) => <span key={e} className="block">• {e}</span>)}</ErrorNote>}
      <SaveBar state={f.state} dirty={f.dirty} error={f.error} onSave={save} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable public pricing?</AlertDialogTitle>
            <AlertDialogDescription>
              Visitors will be able to see published items: {d.videoTypes.filter((x) => x.published).length} video types, {d.models.filter((x) => x.published && x.available).length} models, {d.tiers.filter((x) => x.published).length} tiers, {d.addons.filter((x) => x.published && x.enabled).length} add-ons. Draft items stay hidden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {readiness.warnings.length > 0 && <ul className="text-caption grid gap-1 text-muted-foreground">{readiness.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save()}>Enable & save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AdminButton className="hidden" />
    </div>
  );
}
