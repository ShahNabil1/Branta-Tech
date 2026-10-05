import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, DataTable, Td, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput, formatDate, friendlyError } from "@/components/admin/cms";
import { BOOKING_STATUSES, statusLabel } from "@/lib/inquiry";
import { formatWhen } from "@/lib/client-data";

export const Route = createFileRoute("/control-centre/_admin/bookings/")({
  validateSearch: z.object({ status: z.string().optional() }),
  head: () => adminHead("Bookings"),
  component: BookingsList,
});

function BookingsList() {
  const s = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = useQuery({
    queryKey: ["cms", "bookings"],
    queryFn: () => must(supabase.from("bookings").select("id,name,company,topic,requested_start_at,timezone,status,created_at").order("requested_start_at", { ascending: false }).limit(1000)),
  });
  const rows = (q.data ?? []).filter((b) => !s.status || b.status === s.status);
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Sales" title="Bookings" description="Call requests. Times shown in your timezone, with the requester's timezone." actions={<><Link to="/control-centre/bookings/availability"><AdminButton>Availability</AdminButton></Link><Link to="/control-centre/leads"><AdminButton>Leads</AdminButton></Link></>} />
      <div className="mb-4 md:max-w-xs">
        <SelectInput label="Status" value={s.status ?? ""} onChange={(e) => navigate({ search: { status: e.target.value || undefined } })} options={[{ value: "", label: "All statuses" }, ...BOOKING_STATUSES.map((v) => ({ value: v, label: statusLabel(v) }))]} />
      </div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No call requests yet." : "No bookings match this filter."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["Name", "Topic", "Requested time", "Status", "Received", ""]}>
          {rows.map((b) => (
            <tr key={b.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/bookings/$id" params={{ id: b.id }} className="hover:text-accent">{b.name}</Link>{b.company && <span className="block text-muted-foreground">{b.company}</span>}</Td>
              <Td className="max-w-xs truncate">{b.topic}</Td>
              <Td className="whitespace-nowrap">{formatWhen(b.requested_start_at)}<span className="block text-caption text-muted-foreground">{b.timezone}</span></Td>
              <Td><span className="text-caption rounded-sm border border-border px-2 py-0.5">{statusLabel(b.status)}</span></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(b.created_at)}</Td>
              <Td><div className="flex justify-end"><Link to="/control-centre/bookings/$id" params={{ id: b.id }}><AdminButton size="sm">Open</AdminButton></Link></div></Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
