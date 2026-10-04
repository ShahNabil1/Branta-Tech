import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, DataTable, Td, StatusBadge, FeaturedBadge, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput, ConfirmButton,
  STATUS_OPTIONS, formatDate, friendlyError,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/insights/")({
  head: () => adminHead("Insights"),
  component: PostsList,
});

function PostsList() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["cms", "posts"],
    queryFn: () => must(supabase.from("posts").select("id,title,slug,status,featured,category,published_at,updated_at,authors(name)").order("updated_at", { ascending: false })),
  });
  const rows = (q.data ?? []).filter((p) => !status || p.status === status);

  async function update(id: string, patch: { status?: string; featured?: boolean; published_at?: string }, msg: string) {
    const { error } = await supabase.from("posts").update(patch).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["cms", "posts"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Article deleted");
    qc.invalidateQueries({ queryKey: ["cms", "posts"] });
  }

  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Content" title="Insights" actions={<>
        <Link to="/control-centre/insights/authors"><AdminButton>Authors</AdminButton></Link>
        <Link to="/control-centre/insights/$id" params={{ id: "new" }}><AdminButton variant="primary"><Plus className="size-4" aria-hidden /> New article</AdminButton></Link>
      </>} />
      <div className="mb-4 max-w-xs"><SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]} /></div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No articles yet. Write the first one." : "No articles match this filter."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["Title", "Category", "Author", "Status", "Featured", "Published", ""]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/insights/$id" params={{ id: p.id }} className="hover:text-accent">{p.title}</Link></Td>
              <Td>{p.category ?? "—"}</Td>
              <Td>{p.authors?.name ?? "—"}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>{p.featured ? <FeaturedBadge /> : "—"}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(p.published_at)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link to="/control-centre/insights/$id" params={{ id: p.id }}><AdminButton size="sm">Edit</AdminButton></Link>
                  <AdminButton size="sm" variant="ghost" onClick={() => update(p.id, p.status === "published" ? { status: "draft" } : { status: "published", ...(p.published_at ? {} : { published_at: new Date().toISOString() }) }, p.status === "published" ? "Unpublished" : "Published")}>
                    {p.status === "published" ? "Unpublish" : "Publish"}
                  </AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={() => update(p.id, { featured: !p.featured }, p.featured ? "Unfeatured" : "Featured")}>{p.featured ? "Unfeature" : "Feature"}</AdminButton>
                  {p.status !== "archived" && <AdminButton size="sm" variant="ghost" onClick={() => update(p.id, { status: "archived" }, "Archived")}>Archive</AdminButton>}
                  <ConfirmButton title="Delete this article?" description="This permanently removes the article. This can't be undone." onConfirm={() => remove(p.id)}>Delete</ConfirmButton>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
