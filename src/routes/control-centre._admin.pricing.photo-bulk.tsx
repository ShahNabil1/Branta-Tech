import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { PhotoPage } from "@/components/admin/pricing/PricingKit";
import { InlineTable } from "@/components/admin/pricing/InlineTable";

export const Route = createFileRoute("/control-centre/_admin/pricing/photo-bulk")({
  head: () => adminHead("Bulk discounts"),
  component: () => (
    <PhotoPage title="Bulk discount rules" description="Exactly one tier applies, chosen by product count, and only to bulk-eligible categories and packages. 'Custom quote' tiers turn off instant pricing for that quantity.">
      {(d, refresh) => (
        <InlineTable table="pricing_photo_bulk_tiers" rows={d.bulkTiers} onChange={refresh} empty="No bulk tiers yet."
          newRow={{ min_products: 1, discount_percentage: 0, published: false }}
          cols={[
            { key: "min_products", label: "From products", type: "int", width: "w-28" },
            { key: "max_products", label: "To products", type: "int", nullable: true, width: "w-28" },
            { key: "discount_percentage", label: "Discount %", type: "pct", nullable: true, width: "w-28" },
            { key: "custom_quote", label: "Custom quote", type: "bool" },
          ]} />
      )}
    </PhotoPage>
  ),
});
