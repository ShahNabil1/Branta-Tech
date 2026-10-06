import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminHead } from "@/lib/supabase/cms";
import { ErrorNote, LoadingRow, PageHeader, Panel, SelectInput } from "@/components/admin/cms";
import { StatCard } from "@/components/admin/pricing/PricingKit";
import { pricingAnalytics } from "@/lib/pricing/phase5";
import { money } from "@/lib/pricing/quotes-admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/analytics")({
  head: () => adminHead("Pricing analytics"),
  component: Analytics,
});

const RANGES = [["30", "Last 30 days"], ["90", "Last 90 days"], ["all", "All time"]] as const;

function Analytics() {
  const [range, setRange] = useState("30");
  const since = range === "all" ? undefined : new Date(Date.now() - Number(range) * 86400_000).toISOString();
  const q = useQuery({
    queryKey: ["cms", "pricing-analytics", range],
    queryFn: async () => {
      let ev = supabase.from("pricing_events").select("id", { count: "exact", head: true }).eq("event", "calculator_start");
      let rq = supabase.from("pricing_quote_requests").select("id,status,video_type_id,ai_model_id,created_at").limit(5000);
      if (since) { ev = ev.gte("created_at", since); rq = rq.gte("created_at", since); }
      const [e, r, t, m] = await Promise.all([ev, rq, supabase.from("pricing_video_types").select("id,name"), supabase.from("pricing_ai_models").select("id,name")]);
      if (e.error) throw e.error;
      const ok = <D,>(x: { data: D | null; error: unknown }) => { if (x.error) throw x.error; return x.data ?? ([] as unknown as D); };
      const requests = ok(r);
      const ids = requests.map((x) => x.id);
      const versions = ids.length ? ok(await supabase.from("pricing_quote_versions").select("quote_id,status,customer_response,total_minor").in("quote_id", ids.slice(0, 1000))) : [];
      return { stats: pricingAnalytics({ requests, versions, calculatorStarts: e.count ?? 0 }), types: ok(t), models: ok(m) };
    },
  });
  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "Unknown";
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Pricing" title="Pricing analytics" description="Real counts only. Calculator starts are anonymous (a hashed network, no personal data) and are recorded from this release onward, so earlier periods show zero." />
      <div className="mb-6 max-w-xs"><SelectInput label="Period" value={range} onChange={(e) => setRange(e.target.value)} options={RANGES.map(([value, label]) => ({ value, label }))} /></div>
      {q.isLoading ? <LoadingRow /> : q.error || !q.data ? <ErrorNote>Analytics are available to sales and admin staff only.</ErrorNote> : (() => {
        const s = q.data.stats;
        return (
          <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Calculator starts" value={s.calculatorStarts} />
              <StatCard label="Quote requests" value={s.quoteRequests} />
              <StatCard label="Quotes issued" value={s.issued} sub="Requests in period with an issued version" />
              <StatCard label="Accepted" value={s.accepted} />
              <StatCard label="Declined" value={s.declined} />
              <StatCard label="Average accepted value" value={s.averageAcceptedMinor == null ? "—" : money(s.averageAcceptedMinor)} />
              <StatCard label="Calculator → priced request" value={s.startToRequest == null ? "Not enough data" : `${s.startToRequest}%`} />
              <StatCard label="Issued → accepted" value={s.issuedToAccepted == null ? "—" : `${s.issuedToAccepted}%`} />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Panel title="Most requested video types">{s.topVideoTypes.length ? <ol className="text-small grid gap-1.5">{s.topVideoTypes.slice(0, 7).map(([id, n]) => <li key={id} className="flex justify-between"><span>{name(q.data.types, id)}</span><span className="tabular-nums">{n}</span></li>)}</ol> : <p className="text-small text-muted-foreground">No priced requests yet (custom requests have no selection).</p>}</Panel>
              <Panel title="Most selected AI models">{s.topModels.length ? <ol className="text-small grid gap-1.5">{s.topModels.slice(0, 7).map(([id, n]) => <li key={id} className="flex justify-between"><span>{name(q.data.models, id)}</span><span className="tabular-nums">{n}</span></li>)}</ol> : <p className="text-small text-muted-foreground">No priced requests yet.</p>}</Panel>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
