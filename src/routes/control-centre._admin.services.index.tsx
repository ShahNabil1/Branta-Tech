import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, DataTable, Td, StatusBadge, FeaturedBadge, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput,
  STATUS_OPTIONS, formatDate, friendlyError,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/services/")({
  head: () => adminHead("Services"),
  component: ServicesList,
});

function ServicesList() {
  const qc = useQueryClient();
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState("");
  const [featured, setFeatured] = useState("");
  const groups = useQuery({ queryKey: ["cms", "service_groups"], queryFn: () => must(supabase.from("service_groups").select("id,name").order("sort_order")) });
  const q = useQuery({
    queryKey: ["cms", "services"],
    queryFn: () => must(supabase.from("services").select("id,name,slug,status,featured,sort_order,updated_at,group_id,service_groups(name)").order("sort_order")),
  });

  const rows = (q.data ?? []).filter((s) => (!group || s.group_id === group) && (!status || s.status === status) && (!featured || String(s.featured) === featured));

  async function toggle(id: string, s: string) {
    const next = s === "published" ? "draft" : "published";
    const { error } = await supabase.from("services").update({ status: next }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(next === "published" ? "Service published" : "Service unpublished");
    qc.invalidateQueries({ queryKey: ["cms"] });
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Website"
        title="Services"
        actions={
          <>
            <Link to="/control-centre/services/groups"><AdminButton>Service groups</AdminButton></Link>
            <Link to="/control-centre/services/$id" params={{ id: "new" }}><AdminButton variant="primary"><Plus className="size-4" aria-hidden /> Create service</AdminButton></Link>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 md:max-w-2xl">
        <SelectInput label="Group" value={group} onChange={(e) => setGroup(e.target.value)} options={[{ value: "", label: "All groups" }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
        <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]} />
        <SelectInput label="Featured" value={featured} onChange={(e) => setFeatured(e.target.value)} options={[{ value: "", label: "All" }, { value: "true", label: "Featured" }, { value: "false", label: "Not featured" }]} />
      </div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No services yet. Create the first one." : "No services match these filters."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["Name", "Group", "Slug", "Status", "Featured", "Order", "Updated", ""]}>
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/services/$id" params={{ id: s.id }} className="hover:text-accent">{s.name}</Link></Td>
              <Td>{s.service_groups?.name ?? "—"}</Td>
              <Td className="font-mono text-muted-foreground">{s.slug}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>{s.featured ? <FeaturedBadge /> : <span className="text-muted-foreground">—</span>}</Td>
              <Td className="tabular-nums">{s.sort_order}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(s.updated_at)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link to="/control-centre/services/$id" params={{ id: s.id }}><AdminButton size="sm">Edit</AdminButton></Link>
                  <AdminButton size="sm" variant="ghost" onClick={() => toggle(s.id, s.status)}>{s.status === "published" ? "Unpublish" : "Publish"}</AdminButton>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
