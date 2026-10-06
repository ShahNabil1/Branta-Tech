import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, Panel, SelectInput, TextArea, TextInput, friendlyError, nullIfEmpty, SLUG_RE, useAutoSlug } from "@/components/admin/cms";
import { NumField, PricingCrud, PricingPage, copySlug, nextOrder, parseMoney, useRefreshPricing } from "@/components/admin/pricing/PricingKit";
import { bdt, type AdminPricing, type VideoTypeRow } from "@/lib/pricing/admin";
import { useQuery } from "@tanstack/react-query";
import { must } from "@/lib/supabase/cms";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/control-centre/_admin/pricing/video-types")({
  head: () => adminHead("Pricing video types"),
  component: () => (
    <PricingPage title="Video types" description="Each video type has a base creative fee and a minimum project price. Per-second rates live in the rate matrix.">
      {(d) => <VideoTypes d={d} />}
    </PricingPage>
  ),
});

/** Suggested minimums from the Phase 2 brief — applied only after explicit confirmation. */
const SUGGESTED_MIN: Record<string, number> = {
  "ai-motion": 8000, "ai-ugc": 8000, "ai-product-video": 12000, "ai-commercial": 18000,
  "ai-ovc": 28000, "ai-tvc": 45000, "fashion-cinematic": 20000,
};

function useServices() {
  return useQuery({ queryKey: ["cms", "services-lite"], queryFn: () => must(supabase.from("services").select("id,name,status").order("name")) });
}

function VideoTypes({ d }: { d: AdminPricing }) {
  const services = useServices().data ?? [];
  const svcName = (id: string | null) => services.find((s) => s.id === id)?.name ?? "—";
  return (
    <div className="grid gap-6">
      <SuggestedMinimums d={d} />
      <PricingCrud<VideoTypeRow>
        table="pricing_video_types" rows={d.videoTypes} newLabel="Add video type" empty="No video types yet."
        head={["Video type", "Base fee", "Minimum", "Related service", "Rates"]}
        cells={(v) => [
          <><p className="font-medium">{v.name}</p><p className="text-caption text-muted-foreground">{v.slug}</p></>,
          bdt(v.base_creative_fee), Number(v.minimum_project_price) ? bdt(v.minimum_project_price) : <span className="text-muted-foreground">None</span>,
          <span className="text-muted-foreground">{svcName(v.related_service_id)}</span>,
          `${d.rates.filter((r) => r.video_type_id === v.id && r.enabled).length}/${d.models.length}`,
        ]}
        deleteWarning={(v) => `This permanently removes ${v.name} and its ${d.rates.filter((r) => r.video_type_id === v.id).length} per-second rates. No quotations reference pricing yet, but prefer unpublishing to keep history.`}
        duplicate={async (v) => {
          const { id: _id, created_at: _c, updated_at: _u, ...rest } = v;
          const { data, error } = await supabase.from("pricing_video_types").insert({ ...rest, name: `${v.name} (copy)`, slug: copySlug(v.slug, d.videoTypes.map((x) => x.slug)), published: false, sort_order: nextOrder(d.videoTypes) }).select("id").single();
          if (error) return void toast.error(friendlyError(error));
          const rates = d.rates.filter((r) => r.video_type_id === v.id).map((r) => ({ video_type_id: data.id, ai_model_id: r.ai_model_id, selling_rate_per_second: r.selling_rate_per_second, currency: r.currency, enabled: r.enabled }));
          if (rates.length) await supabase.from("pricing_model_rates").insert(rates);
          toast.success("Duplicated as draft (rates copied)");
        }}
        form={(v, done) => <VideoTypeForm v={v} d={d} services={services} done={done} />}
      />
    </div>
  );
}

function VideoTypeForm({ v, d, services, done }: { v: VideoTypeRow | null; d: AdminPricing; services: { id: string; name: string; status: string }[]; done: () => void }) {
  const [name, setName] = useState(v?.name ?? "");
  const slug = useAutoSlug(v?.slug ?? "", !v);
  const [desc, setDesc] = useState(v?.description ?? "");
  const [svc, setSvc] = useState(v?.related_service_id ?? "");
  const [fee, setFee] = useState(String(v?.base_creative_fee ?? "0"));
  const [min, setMin] = useState(String(v?.minimum_project_price ?? "0"));
  const [pub, setPub] = useState(v?.published ?? false);
  const [busy, setBusy] = useState(false);
  const feeN = parseMoney(fee), minN = parseMoney(min);
  const slugErr = slug.slug && !SLUG_RE.test(slug.slug) ? "Lowercase letters, numbers and hyphens" : null;

  async function save() {
    if (!name.trim() || !slug.slug || slugErr || feeN == null || minN == null) return void toast.error("Check the fields.");
    setBusy(true);
    const payload = { name: name.trim(), slug: slug.slug, description: nullIfEmpty(desc), related_service_id: svc || null, base_creative_fee: feeN, minimum_project_price: minN, published: pub };
    const res = v ? await supabase.from("pricing_video_types").update(payload).eq("id", v.id) : await supabase.from("pricing_video_types").insert({ ...payload, sort_order: nextOrder(d.videoTypes) });
    setBusy(false);
    if (res.error) return void toast.error(friendlyError(res.error));
    toast.success(v ? "Video type saved" : "Video type added — set its rates in the matrix");
    done();
  }
  return (
    <div className="grid gap-4">
      <TextInput label="Name" value={name} onChange={(e) => { setName(e.target.value); slug.syncFrom(e.target.value); }} />
      <TextInput label="Slug" value={slug.slug} error={slugErr} onChange={(e) => slug.setSlug(e.target.value)} />
      <TextArea label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <SelectInput label="Related service (optional)" value={svc} onChange={(e) => setSvc(e.target.value)}
        options={[{ value: "", label: "None" }, ...services.map((s) => ({ value: s.id, label: `${s.name}${s.status !== "published" ? ` (${s.status})` : ""}` }))]} />
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Base creative fee" suffix="BDT" value={fee} onChange={setFee} error={feeN == null ? "0 or more" : null} />
        <NumField label="Minimum project price" suffix="BDT" value={min} onChange={setMin} error={minN == null ? "0 or more" : null} hint="0 = no minimum" />
      </div>
      <CheckboxInput label="Published" hint="Visible publicly only once public pricing is enabled." checked={pub} onChange={setPub} />
      <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save video type"}</AdminButton>
    </div>
  );
}

function SuggestedMinimums({ d }: { d: AdminPricing }) {
  const refresh = useRefreshPricing();
  const [open, setOpen] = useState(false);
  const changes = d.videoTypes.filter((v) => SUGGESTED_MIN[v.slug] != null && Number(v.minimum_project_price) !== SUGGESTED_MIN[v.slug]);
  if (!changes.length) return null;
  async function apply() {
    const res = await Promise.all(changes.map((v) => supabase.from("pricing_video_types").update({ minimum_project_price: SUGGESTED_MIN[v.slug]! }).eq("id", v.id)));
    const err = res.find((r) => r.error)?.error;
    if (err) toast.error(friendlyError(err)); else toast.success("Suggested minimums applied");
    refresh();
  }
  return (
    <Panel title="Suggested minimum prices" description="Proposed values for review. Nothing changes until you confirm." actions={<AdminButton size="sm" onClick={() => setOpen(true)}>Review & apply</AdminButton>}>
      <p className="text-caption text-muted-foreground">{changes.length} video type{changes.length > 1 ? "s" : ""} differ from the suggested minimums.</p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply suggested minimums?</AlertDialogTitle>
            <AlertDialogDescription>These video types will change. Published status is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-small grid gap-1 tabular-nums">
            {changes.map((v) => <li key={v.id} className="flex justify-between gap-4"><span>{v.name}</span><span>{bdt(v.minimum_project_price)} → <strong>{bdt(SUGGESTED_MIN[v.slug])}</strong></span></li>)}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void apply()}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
