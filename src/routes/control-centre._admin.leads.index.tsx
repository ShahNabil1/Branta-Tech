import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, DataTable, Td, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput, TextInput, formatDate, friendlyError } from "@/components/admin/cms";
import { LEAD_STATUSES, SERVICE_OPTIONS, statusLabel } from "@/lib/inquiry";

export const Route = createFileRoute("/control-centre/_admin/leads/")({
  validateSearch: z.object({ status: z.string().optional(), service: z.string().optional(), from: z.string().optional() }),
  head: () => adminHead("Leads"),
  component: LeadsList,
});

function LeadsList() {
  const s = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = useQuery({
    queryKey: ["cms", "leads"],
    queryFn: () => must(supabase.from("leads").select("id,name,company,service_interest,status,source,created_at").order("created_at", { ascending: false }).limit(1000)),
  });
  const rows = (q.data ?? []).filter((l) => (!s.status || l.status === s.status) && (!s.service || l.service_interest.includes(s.service)) && (!s.from || l.created_at >= s.from));
  const set = (k: "status" | "service" | "from", v: string) => navigate({ search: (p) => ({ ...p, [k]: v || undefined }) });
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Sales" title="Leads" description="Start a Project requests. Visible to super admins, admins and sales." actions={<Link to="/control-centre/bookings"><AdminButton>Bookings</AdminButton></Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3 md:max-w-3xl">
        <SelectInput label="Status" value={s.status ?? ""} onChange={(e) => set("status", e.target.value)} options={[{ value: "", label: "All statuses" }, ...LEAD_STATUSES.map((v) => ({ value: v, label: statusLabel(v) }))]} />
        <SelectInput label="Service" value={s.service ?? ""} onChange={(e) => set("service", e.target.value)} options={[{ value: "", label: "All services" }, ...SERVICE_OPTIONS.map((v) => ({ value: v, label: v }))]} />
        <TextInput label="Since" type="date" value={s.from ?? ""} onChange={(e) => set("from", e.target.value)} />
      </div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No leads yet." : "No leads match these filters."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["Name", "Company", "Service", "Status", "Source", "Created", ""]}>
          {rows.map((l) => (
            <tr key={l.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/leads/$id" params={{ id: l.id }} className="hover:text-accent">{l.name}</Link></Td>
              <Td className="text-muted-foreground">{l.company ?? "—"}</Td>
              <Td>{l.service_interest.join(", ")}</Td>
              <Td><span className="text-caption rounded-sm border border-border px-2 py-0.5">{statusLabel(l.status)}</span></Td>
              <Td className="text-muted-foreground">{statusLabel(l.source)}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(l.created_at)}</Td>
              <Td><div className="flex justify-end"><Link to="/control-centre/leads/$id" params={{ id: l.id }}><AdminButton size="sm">Open</AdminButton></Link></div></Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
