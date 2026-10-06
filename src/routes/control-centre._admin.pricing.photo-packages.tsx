import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, Panel, TextInput, friendlyError } from "@/components/admin/cms";
import { PhotoPage } from "@/components/admin/pricing/PricingKit";
import { InlineTable } from "@/components/admin/pricing/InlineTable";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import type { AdminPhoto, PhotoPackageRow } from "@/lib/pricing/photo-admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/photo-packages")({
  head: () => adminHead("Photoshoot packages"),
  component: () => (
    <PhotoPage title="Product photoshoot packages" description="Package price × products. Images included in a package are never charged again. Only real example photos should be uploaded.">
      {(d, refresh) => <Packages d={d} refresh={refresh} />}
    </PhotoPage>
  ),
});

function Packages({ d, refresh }: { d: AdminPhoto; refresh: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const pkg = d.packages.find((p) => p.id === open) ?? null;
  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_420px]">
      <InlineTable table="pricing_photo_packages" rows={d.packages} onChange={refresh} empty="No packages yet." slugFrom="name"
        newRow={{ name: "New package", image_count: 1, published: false }}
        extra={(r) => <AdminButton size="sm" variant="ghost" onClick={() => setOpen(r.id)}>Views & image</AdminButton>}
        cols={[
          { key: "name", label: "Package", type: "text" },
          { key: "price_per_product", label: "BDT / product", type: "money", nullable: true, width: "w-32" },
          { key: "image_count", label: "Images", type: "int", width: "w-20" },
          { key: "description", label: "Description", type: "text", nullable: true },
          { key: "bulk_eligible", label: "Bulk", type: "bool" },
          { key: "sort_order", label: "Order", type: "int", width: "w-20" },
        ]} />
      {pkg && <ViewsEditor key={pkg.id} p={pkg} d={d} refresh={refresh} close={() => setOpen(null)} />}
    </div>
  );
}

function ViewsEditor({ p, d, refresh, close }: { p: PhotoPackageRow; d: AdminPhoto; refresh: () => void; close: () => void }) {
  const [ids, setIds] = useState(d.packageViews.filter((x) => x.package_id === p.id).map((x) => x.view_id));
  const [img, setImg] = useState(p.example_image_url ?? "");
  const [busy, setBusy] = useState(false);
  const name = (id: string) => d.views.find((v) => v.id === id)?.name ?? "?";
  const move = (i: number, dir: -1 | 1) => setIds((x) => { const n = [...x]; const [it] = n.splice(i, 1); n.splice(i + dir, 0, it!); return n; });
  async function save() {
    if (img && !/^https:\/\//.test(img)) return void toast.error("Example image must be an https URL.");
    setBusy(true);
    const del = await supabase.from("pricing_photo_package_views").delete().eq("package_id", p.id);
    const ins = del.error || !ids.length ? { error: del.error } : await supabase.from("pricing_photo_package_views").insert(ids.map((view_id, i) => ({ package_id: p.id, view_id, position: i + 1 })));
    const up = await supabase.from("pricing_photo_packages").update({ example_image_url: img || null }).eq("id", p.id);
    setBusy(false);
    const err = ins.error ?? up.error;
    if (err) return void toast.error(friendlyError(err));
    toast.success("Package views saved"); refresh();
  }
  return (
    <Panel title={`${p.name} — views`} actions={<AdminButton size="sm" variant="ghost" onClick={close}>Close</AdminButton>} className="h-fit 2xl:sticky 2xl:top-6">
      <div className="grid gap-4">
        {ids.length !== p.image_count && <p className="text-caption text-muted-foreground">This package has {p.image_count} images but {ids.length} views listed.</p>}
        <ol className="grid gap-1">
          {ids.map((id, i) => (
            <li key={id} className="text-small flex items-center gap-1 rounded-sm border border-border px-2 py-1">
              <span className="flex-1">{i + 1}. {name(id)}</span>
              <AdminButton size="sm" variant="ghost" aria-label="Up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Down" disabled={i === ids.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Remove" onClick={() => setIds((x) => x.filter((v) => v !== id))}><X className="size-3.5" /></AdminButton>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-1">
          {d.views.filter((v) => !ids.includes(v.id)).map((v) => <AdminButton key={v.id} size="sm" onClick={() => setIds((x) => [...x, v.id])}>+ {v.name}</AdminButton>)}
        </div>
        <TextInput label="Example image URL" value={img} onChange={(e) => setImg(e.target.value)} hint="Upload a real example of your work, or leave empty." />
        <UploadImageButton onUploaded={setImg} label="Upload example" />
        {img && <img src={img} alt="" className="aspect-[4/3] w-full rounded-sm object-cover" />}
        <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save views & image"}</AdminButton>
      </div>
    </Panel>
  );
}
