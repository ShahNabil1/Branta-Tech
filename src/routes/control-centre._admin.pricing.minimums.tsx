import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { PricingPage, useRefreshPricing } from "@/components/admin/pricing/PricingKit";
import { InlineTable } from "@/components/admin/pricing/InlineTable";

export const Route = createFileRoute("/control-centre/_admin/pricing/minimums")({
  head: () => adminHead("Minimum charges"),
  component: Page,
});

function Page() {
  const refresh = useRefreshPricing();
  return (
    <PricingPage title="Base fees & minimum project charges" description="The estimate is raised to the minimum when it would fall below it. Publishing is managed on Video types.">
      {(d) => (
        <InlineTable table="pricing_video_types" rows={d.videoTypes} onChange={() => void refresh()} empty="No video types." canDelete={false} publishable={false}
          cols={[
            { key: "name", label: "Video type", type: "text" },
            { key: "base_creative_fee", label: "Base fee (BDT)", type: "money", width: "w-36" },
            { key: "minimum_project_price", label: "Minimum (BDT)", type: "money", width: "w-36" },
          ]} />
      )}
    </PricingPage>
  );
}
