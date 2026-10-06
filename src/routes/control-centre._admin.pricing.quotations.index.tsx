import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { DataTable, EmptyState, ErrorNote, LoadingRow, PageHeader, SelectInput, Td, TextInput, formatDate } from "@/components/admin/cms";
import { StatCard } from "@/components/admin/pricing/PricingKit";
import { money } from "@/lib/pricing/quotes-admin";
import { StatusChip } from "@/components/admin/pricing/QuoteBits";
import { cn } from "@/lib/utils";
import { FOLLOW_UP_FILTERS, businessToday, followUpBucket } from "@/lib/pricing/phase5";

export const Route = createFileRoute("/control-centre/_admin/pricing/quotations/")({
  head: () => adminHead("Quotations"),
  component: Inbox,
});

const FILTERS = [["all", "All"], ["new", "New"], ["reviewing", "Reviewing"], ["quoted", "Quoted"], ["accepted", "Accepted"], ["declined", "Declined"], ["expired", "Expired"]] as const;

function Inbox() {
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [mine, setMine] = useState("all");
  const [fu, setFu] = useState("all");
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const rows = useQuery({ queryKey: ["cms", "quotes"], queryFn: () => must(supabase.from("pricing_quote_requests").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500)) });
  const types = useQuery({ queryKey: ["cms", "quote-types"], queryFn: () => must(supabase.from("pricing_video_types").select("id,name")) });
  const staff = useQuery({ queryKey: ["cms", "sales-staff"], queryFn: () => must(supabase.rpc("list_sales_staff")) });
  const versions = useQuery({ queryKey: ["cms", "quote-accepted"], queryFn: () => must(supabase.from("pricing_quote_versions").select("quote_id,total_minor,customer_response,status").neq("status", "draft")) });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = (rows.data ?? []).filter((x) => filter === "all" || x.status === filter || (filter === "new" && x.status === "custom_quote_requested"));
    if (mine === "unassigned") r = r.filter((x) => !x.assigned_to);
    if (mine === "me") r = r.filter((x) => x.assigned_to && x.assigned_to === me.data);
    if (fu !== "all") { const today = businessToday(); r = r.filter((x) => followUpBucket(x, today) === fu); }
    if (s) r = r.filter((x) => [x.public_reference, x.customer_name, x.customer_email, x.customer_whatsapp, x.company_name].some((f) => f?.toLowerCase().includes(s)));
    if (sort === "oldest") r = [...r].reverse();
    if (sort === "value") r = [...r].sort((a, b) => Number(b.estimated_price_minor ?? -1) - Number(a.estimated_price_minor ?? -1));
    if (sort === "status") r = [...r].sort((a, b) => a.status.localeCompare(b.status));
    return r;
  }, [rows.data, filter, q, sort, mine, fu, me.data]);

  const all = rows.data ?? [];
  const count = (...s: string[]) => all.filter((x) => s.includes(x.status)).length;
  const accepted = (versions.data ?? []).filter((v) => v.customer_response === "accepted");
  const acceptedValue = accepted.reduce((t, v) => t + Number(v.total_minor), 0);
  const issued = new Set((versions.data ?? []).map((v) => v.quote_id)).size;
  const typeName = (id: string | null) => types.data?.find((t) => t.id === id)?.name ?? "Custom";
  const staffName = (id: string | null) => (id ? staff.data?.find((s) => s.id === id)?.full_name || staff.data?.find((s) => s.id === id)?.email || "Staff" : "—");

  return (
    <div className="max-w-7xl">
      <PageHeader eyebrow="Pricing" title="Quotations" description="Quote requests from the pricing page. Estimates are requests, not approved offers — prepare and issue the final quote from each request." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="New requests" value={count("new", "custom_quote_requested")} />
        <StatCard label="Reviewing" value={count("reviewing", "more_info_needed")} />
        <StatCard label="Quotes issued" value={issued} />
        <StatCard label="Accepted" value={count("accepted")} />
        <StatCard label="Declined" value={count("declined")} />
        <StatCard label="Accepted value" value={money(acceptedValue)} sub="Sum of accepted versions" />
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={cn("text-caption rounded-sm border px-3 py-1.5", filter === k ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground")}>{l}</button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <span className="text-caption mr-1 text-muted-foreground">Follow-ups:</span>
        {[["all", "Any"] as const, ...FOLLOW_UP_FILTERS].map(([k, l]) => {
          const n = k === "all" ? null : all.filter((x) => followUpBucket(x, businessToday()) === k).length;
          return <button key={k} type="button" onClick={() => setFu(k)} className={cn("text-caption rounded-sm border px-3 py-1.5", fu === k ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-foreground")}>{l}{n != null ? ` (${n})` : ""}</button>;
        })}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <TextInput label="Search" placeholder="Reference, name, email, WhatsApp, company" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectInput label="Assigned" value={mine} onChange={(e) => setMine(e.target.value)} options={[{ value: "all", label: "Everyone" }, { value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }]} />
        <SelectInput label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" }, { value: "value", label: "Highest estimate" }, { value: "status", label: "Status" }]} />
      </div>
      {rows.isLoading ? <LoadingRow /> : rows.error ? <ErrorNote>You don't have access to quotations, or they couldn't be loaded.</ErrorNote> : list.length === 0 ? <EmptyState>No quotation requests match.</EmptyState> : (
        <DataTable head={["Quote", "Customer", "WhatsApp", "Service", "Duration", "Estimate", "Status", "Created", "Assigned", ""]}>
          {list.map((r) => (
            <tr key={r.id}>
              <Td className="font-mono">{r.public_reference}</Td>
              <Td><p className="font-medium">{r.customer_name}</p>{r.company_name && <p className="text-caption text-muted-foreground">{r.company_name}</p>}</Td>
              <Td className="whitespace-nowrap">{r.customer_whatsapp}</Td>
              <Td>{typeName(r.video_type_id)}</Td>
              <Td className="tabular-nums">{r.duration_seconds ? `${r.duration_seconds}s` : "—"}</Td>
              <Td className="tabular-nums">{money(r.estimated_price_minor, r.estimated_currency)}</Td>
              <Td><StatusChip s={r.status} /></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(r.created_at)}</Td>
              <Td className="text-muted-foreground">{staffName(r.assigned_to)}</Td>
              <Td><Link to="/control-centre/pricing/quotations/$id" params={{ id: r.id }} className="text-small font-medium text-accent hover:underline">Open</Link></Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
