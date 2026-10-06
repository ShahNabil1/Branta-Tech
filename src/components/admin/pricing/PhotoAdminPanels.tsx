import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { ErrorNote, LoadingRow, Panel, SelectInput } from "@/components/admin/cms";
import { NumField } from "./PricingKit";
import { PricingError } from "@/lib/pricing/engine";
import { calculatePhotoQuote, type PhotoSettings } from "@/lib/pricing/photo-engine";
import { loadAdminPhoto, PHOTO_KEY, photoReadiness, toPhotoEngineConfig } from "@/lib/pricing/photo-admin";
import { bdtMinor } from "@/lib/pricing/admin";

const usePhoto = () => useQuery({ queryKey: PHOTO_KEY, queryFn: loadAdminPhoto });

/** Internal photography preview (includes drafts, saves nothing). */
export function PhotoSimulatorPanel({ tax }: { tax: PhotoSettings["tax"] }) {
  const q = usePhoto();
  const [mode, setMode] = useState<"package" | "individual">("package");
  const [item, setItem] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [products, setProducts] = useState("1");
  const [images, setImages] = useState("4");
  const config = useMemo(() => (q.data ? toPhotoEngineConfig(q.data, tax) : null), [q.data, tax]);
  if (q.isLoading) return <LoadingRow />;
  if (!config) return <ErrorNote>Photography pricing couldn't load.</ErrorNote>;
  const list = mode === "package" ? config.packages : config.categories;
  const id = list.some((x) => x.id === item) ? item : list[0]?.id ?? "";
  const wf = workflow || config.settings.workflows[0]?.slug || "";
  let out: string[] = [], err: string | null = null, total: number | null = null;
  try {
    const r = calculatePhotoQuote(config, { mode, workflow: wf, products: Number(products), ...(mode === "package" ? { packageId: id } : { categoryId: id, imagesPerProduct: Number(images) }) }, "admin");
    out = [`Base ${bdtMinor(r.baseAmount)} (${r.totalImages} images)`, r.bulk ? `Bulk −${r.bulk.percentage}% = −${bdtMinor(r.bulk.amount)}` : "No bulk discount", r.minimumAdjustment ? `Minimum +${bdtMinor(r.minimumAdjustment)}` : "", r.roundingAdjustment ? `Rounding +${bdtMinor(r.roundingAdjustment)}` : ""].filter(Boolean);
    total = r.total;
  } catch (e) { err = e instanceof PricingError ? e.message : "Can't price this."; }
  return (
    <Panel title="Photography simulator" description="Uses the same engine as the server, including drafts. Workflow choice never changes the price.">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectInput label="Order type" value={mode} onChange={(e) => setMode(e.target.value as "package")} options={[{ value: "package", label: "Package" }, { value: "individual", label: "Individual images" }]} />
        <SelectInput label={mode === "package" ? "Package" : "Category"} value={id} onChange={(e) => setItem(e.target.value)} options={list.map((x) => ({ value: x.id, label: x.name + (x.published ? "" : " (draft)") }))} />
        <SelectInput label="Workflow" value={wf} onChange={(e) => setWorkflow(e.target.value)} options={config.settings.workflows.map((w) => ({ value: w.slug, label: w.name }))} />
        <NumField label="Products" value={products} onChange={setProducts} />
        {mode === "individual" && <NumField label="Images per product" value={images} onChange={setImages} />}
      </div>
      <div className="mt-5 rounded-sm border border-border p-4">
        {err ? <p className="text-small text-destructive">{err}</p> : <>
          <ul className="text-small grid gap-1 text-muted-foreground">{out.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="text-h4 mt-2 tabular-nums">{total != null ? bdtMinor(total) : "—"}</p>
        </>}
      </div>
    </Panel>
  );
}

export function PhotoReviewPanel() {
  const q = usePhoto();
  if (q.isLoading) return <LoadingRow />;
  if (!q.data) return <ErrorNote>Photography pricing couldn't load.</ErrorNote>;
  const { errors, warnings } = photoReadiness(q.data);
  const d = q.data;
  return (
    <Panel title={`AI Photography — ${errors.length ? `${errors.length} blocking issue${errors.length > 1 ? "s" : ""}` : "ready"}`}
      description={`${d.categories.filter((c) => c.published).length}/${d.categories.length} categories, ${d.packages.filter((p) => p.published).length}/${d.packages.length} packages, ${d.bulkTiers.filter((t) => t.published).length}/${d.bulkTiers.length} bulk tiers and ${d.addons.filter((a) => a.published).length}/${d.addons.length} add-ons published.`}>
      <ul className="text-small grid gap-1.5">
        {errors.map((e) => <li key={e} className="flex gap-2 text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{e}</li>)}
        {warnings.map((w) => <li key={w} className="flex gap-2 text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</li>)}
      </ul>
      <Link to="/control-centre/pricing/photo-settings" className="text-small mt-4 inline-block font-medium text-accent hover:underline">Open photography settings →</Link>
    </Panel>
  );
}
