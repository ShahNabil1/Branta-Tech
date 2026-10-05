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
  const q = useQuery({ queryKey: ["cms", "jobs"], queryFn: () => must(supabase.from("jobs").select("id,title,slug,status,featured,urgent,deadline_at,department,employment_type,sort_order,updated_at,job_applications(count)").order("sort_order").order("updated_at", { ascending: false })) });
  async function patch(id: string, p: { status?: string; featured?: boolean; urgent?: boolean; published_at?: string }, msg: string) {
    const { error } = await supabase.from("jobs").update(p).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg); qc.invalidateQueries({ queryKey: ["cms", "jobs"] });
  }
  async function duplicate(id: string) {
    const { data: src, error } = await supabase.from("jobs").select("*").eq("id", id).single();
    if (error || !src) return void toast.error(friendlyError(error));
    const { id: _i, created_at: _c, updated_at: _u, published_at: _p, ...rest } = src;
    const copy = { ...rest, title: `${src.title} (copy)`, slug: `${src.slug}-copy-${Math.random().toString(36).slice(2, 6)}`, status: "draft", featured: false };
    const res = await supabase.from("jobs").insert(copy).select("id").single();
    if (res.error) return void toast.error(friendlyError(res.error));
    toast.success("Draft copy created"); qc.invalidateQueries({ queryKey: ["cms", "jobs"] });
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
        <DataTable head={["Role", "Department", "Type", "Status", "Flags", "Applications", "Updated", ""]}>
          {q.data.map((j) => (
            <tr key={j.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/careers/jobs/$id" params={{ id: j.id }} className="hover:text-accent">{j.title}</Link></Td>
              <Td>{j.department ?? "—"}</Td>
              <Td>{j.employment_type ?? "—"}</Td>
              <Td><StatusBadge status={j.status} /></Td>
              <Td><div className="flex flex-wrap gap-1">{j.featured && <FeaturedBadge />}{j.urgent && <span className="text-caption rounded-sm border border-destructive/40 px-2 py-0.5 text-destructive">Urgent</span>}{!j.featured && !j.urgent && "—"}{j.deadline_at && <span className="text-caption text-muted-foreground">Deadline {formatDate(j.deadline_at)}</span>}</div></Td>
              <Td className="tabular-nums">{(j.job_applications as unknown as { count: number }[])?.[0]?.count ?? 0}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(j.updated_at)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link to="/control-centre/careers/jobs/$id" params={{ id: j.id }}><AdminButton size="sm">Edit</AdminButton></Link>
                  {j.status === "published" ? <>
                    <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { status: "draft" }, "Role unpublished")}>Unpublish</AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { status: "closed" }, "Applications closed")}>Close</AdminButton>
                  </> : <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { status: "published", published_at: new Date().toISOString() }, j.status === "closed" ? "Role reopened" : "Role published")}>{j.status === "closed" ? "Reopen" : "Publish"}</AdminButton>}
                  <AdminButton size="sm" variant="ghost" onClick={() => patch(j.id, { urgent: !j.urgent }, j.urgent ? "Urgent removed" : "Marked urgent")}>{j.urgent ? "Not urgent" : "Urgent"}</AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={() => duplicate(j.id)}>Duplicate</AdminButton>
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
