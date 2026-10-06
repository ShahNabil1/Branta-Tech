import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, DataTable, EmptyState, ErrorNote, LoadingRow, Td, friendlyError } from "@/components/admin/cms";
import { PricingPage } from "@/components/admin/pricing/PricingKit";
import { bdt } from "@/lib/pricing/admin";
import { decideProposal, loadProposals, type ProposalRow } from "@/lib/pricing/photo-admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/proposals")({
  head: () => adminHead("Proposed price changes"),
  component: Page,
});

const FIELD: Record<string, string> = { selling_rate_per_second: "Rate / sec", base_creative_fee: "Base fee", minimum_project_price: "Minimum" };

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cms", "pricing-proposals"], queryFn: loadProposals });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["cms"] });
  async function decide(rows: ProposalRow[], approve: boolean) {
    setBusy(true);
    try { for (const r of rows) await decideProposal(r, approve); toast.success(approve ? `${rows.length} change(s) applied — still unpublished` : `${rows.length} change(s) rejected`); }
    catch (e) { toast.error(friendlyError(e)); }
    setBusy(false); void refresh();
  }
  return (
    <PricingPage title="Proposed price changes" description="Proposed values are never applied automatically. Approving updates the draft record only — nothing is published.">
      {() => {
        if (q.isLoading) return <LoadingRow />;
        if (q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
        const rows = q.data ?? [], pending = rows.filter((r) => r.status === "pending");
        if (!rows.length) return <EmptyState>No proposals.</EmptyState>;
        return (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <p className="text-small mr-auto text-muted-foreground">{pending.length} pending</p>
              <AdminButton disabled={busy || !pending.length} onClick={() => decide(pending, false)}>Reject all</AdminButton>
              <AdminButton variant="primary" disabled={busy || !pending.length} onClick={() => decide(pending, true)}>Approve all pending</AdminButton>
            </div>
            <DataTable head={["Item", "Field", "Current", "Proposed", "Change", "Status", ""]}>
              {rows.map((r) => {
                const cur = r.current_value == null ? null : Number(r.current_value), nv = Number(r.proposed_value);
                const diff = cur == null ? null : nv - cur;
                return (
                  <tr key={r.id}>
                    <Td><p className="font-medium">{r.label}</p></Td>
                    <Td>{FIELD[r.field] ?? r.field}</Td>
                    <Td className="tabular-nums">{bdt(cur)}</Td>
                    <Td className="tabular-nums font-medium">{bdt(nv)}</Td>
                    <Td className="tabular-nums">{diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toLocaleString("en-IN")}`}</Td>
                    <Td className="capitalize">{r.status}</Td>
                    <Td className="text-right">
                      {r.status === "pending" && <div className="flex justify-end gap-1">
                        <AdminButton size="sm" variant="ghost" disabled={busy} onClick={() => decide([r], false)}>Reject</AdminButton>
                        <AdminButton size="sm" variant="primary" disabled={busy} onClick={() => decide([r], true)}>Approve</AdminButton>
                      </div>}
                    </Td>
                  </tr>
                );
              })}
            </DataTable>
          </div>
        );
      }}
    </PricingPage>
  );
}
