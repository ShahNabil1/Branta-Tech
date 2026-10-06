import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { PhotoPage } from "@/components/admin/pricing/PricingKit";
import { InlineTable } from "@/components/admin/pricing/InlineTable";

export const Route = createFileRoute("/control-centre/_admin/pricing/photo")({
  head: () => adminHead("Photography categories"),
  component: () => (
    <PhotoPage title="Photography categories & per-image rates" description="Individual orders: per-image rate × images per product × products. Leave a rate empty to keep it hidden. Both image workflows always use these same prices.">
      {(d, refresh) => (
        <InlineTable table="pricing_photo_categories" rows={d.categories} onChange={refresh} empty="No categories yet." slugFrom="name"
          newRow={{ name: "New category", published: false }}
          cols={[
            { key: "name", label: "Category", type: "text" },
            { key: "price_per_image", label: "BDT / image", type: "money", nullable: true, width: "w-32" },
            { key: "description", label: "Description", type: "text", nullable: true },
            { key: "bulk_eligible", label: "Bulk discount", type: "bool" },
            { key: "sort_order", label: "Order", type: "int", width: "w-20" },
          ]} />
      )}
    </PhotoPage>
  ),
});
