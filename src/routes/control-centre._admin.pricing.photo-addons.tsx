import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { PhotoPage } from "@/components/admin/pricing/PricingKit";
import { InlineTable } from "@/components/admin/pricing/InlineTable";

export const Route = createFileRoute("/control-centre/_admin/pricing/photo-addons")({
  head: () => adminHead("Photography add-ons"),
  component: () => (
    <PhotoPage title="Photography add-ons" description="Add-ons without an amount stay hidden publicly even when published. Percentage add-ons are charged on the discounted subtotal plus other add-ons.">
      {(d, refresh) => (
        <InlineTable table="pricing_photo_addons" rows={d.addons} onChange={refresh} empty="No add-ons yet."
          newRow={{ name: "New add-on", charge_type: "fixed", published: false }}
          cols={[
            { key: "name", label: "Add-on", type: "text" },
            { key: "charge_type", label: "Charged", type: "select", options: [{ value: "fixed", label: "Once" }, { value: "per_product", label: "Per product" }, { value: "per_image", label: "Per image" }, { value: "percentage", label: "Percentage" }] },
            { key: "amount", label: "BDT", type: "money", nullable: true, width: "w-28" },
            { key: "percentage", label: "%", type: "pct", nullable: true, width: "w-24" },
            { key: "enabled", label: "Enabled", type: "bool" },
            { key: "description", label: "Description", type: "text", nullable: true },
          ]} />
      )}
    </PhotoPage>
  ),
});
