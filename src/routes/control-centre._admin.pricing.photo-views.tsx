import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { PhotoPage } from "@/components/admin/pricing/PricingKit";
import { InlineTable } from "@/components/admin/pricing/InlineTable";

export const Route = createFileRoute("/control-centre/_admin/pricing/photo-views")({
  head: () => adminHead("Photography views"),
  component: () => (
    <PhotoPage title="Image views" description="Views used by packages and custom orders. 'Fashion' views show only for apparel, 'Product' views only for other products.">
      {(d, refresh) => (
        <InlineTable table="pricing_photo_views" rows={d.views} onChange={refresh} empty="No views yet." slugFrom="name"
          newRow={{ name: "New view", applies_to: "all", published: false }}
          cols={[
            { key: "name", label: "View", type: "text" },
            { key: "applies_to", label: "Applies to", type: "select", options: [{ value: "all", label: "All products" }, { value: "fashion", label: "Fashion" }, { value: "product", label: "Other products" }] },
            { key: "sort_order", label: "Order", type: "int", width: "w-20" },
          ]} />
      )}
    </PhotoPage>
  ),
});
