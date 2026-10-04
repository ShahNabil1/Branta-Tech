import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, DataTable, Td, StatusBadge, FeaturedBadge, LoadingRow, ErrorNote, EmptyState, AdminButton, ConfirmButton, formatDate, friendlyError } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/careers/jobs/")({
  head: () => adminHead("Jobs"),
  component: JobsList,
});

function JobsList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cms", "jobs"], queryFn: () => must(supabase.from("jobs").select("id,title,slug,status,featured,department,employment_type,sort_order,updated_at,job_applications(count)").order("sort_order").order("updated_at", { ascending: false })) });
  async function patch(id: string, p: { status?: string; featured?: boolean; published_at?: string }, msg: string) {
    const { error } = await supabase.from("jobs").update(p).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg); qc.invalidateQueries({ queryKey: ["cms", "jobs"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return void toast.error(error.code === "23503" ? "This role has applications. Archive it instead." : friendlyError(error));
    toast.success("Role deleted"); qc.invalidateQueries({ queryKey: ["cms", "jobs"] });
  }
  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Careers" title="Jobs" actions={<>
        <Link to="/control-centre/careers/applications"><AdminButton>Applications</AdminButton></Link>
        <Link to="/control-centre/careers/jobs/$id" params={{ id: "new" }}><AdminButton variant="primary"><Plus className="size-4" aria-hidden /> New role</AdminButton></Link>
      </>} />
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data?.length === 0 && <EmptyState>No roles yet. The Careers page shows "No open roles right now" until one is published.</EmptyState>}
      {!!q.data?.length && (
        <DataTable head={["Role", "Department", "Type", "Status", "Featured", "Applications", "Updated", ""]}>
          {q.data.map((j) => (
            <tr key={j.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/careers/jobs/$id" params={{ id: j.id }} className="hover:text-accent">{j.title}</Link></Td>
              <Td>{j.department ?? "—"}</Td>
              <Td>{j.employment_type ?? "—"}</Td>
              <Td><StatusBadge status={j.status} /></Td>
              <Td>{j.featured ? <FeaturedBadge /> : "—"}</Td>
              <Td className="tabular-nums">{(j.job_applications as unknown as { count: number }[])?.[0]?.count ?? 0}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(j.updated_at)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link to="/control-centre/careers/jobs/$id" params={{ id: j.id }}><AdminButton size="sm">Edit</AdminButton></Link>
                  {j.status === "published"
                    ? <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { status: "closed" }, "Role closed")}>Close</AdminButton>
                    : <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { status: "published", published_at: new Date().toISOString() }, "Role published")}>Publish</AdminButton>}
                  <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { featured: !j.featured }, j.featured ? "Unfeatured" : "Featured")}>{j.featured ? "Unfeature" : "Feature"}</AdminButton>
                  {j.status !== "archived" && <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { status: "archived" }, "Archived")}>Archive</AdminButton>}
                  <ConfirmButton title="Delete this role?" description="Roles with applications can't be deleted — archive them instead." onConfirm={() => remove(j.id)}>Delete</ConfirmButton>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
