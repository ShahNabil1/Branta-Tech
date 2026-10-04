import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, DataTable, Td, StatusBadge, FeaturedBadge, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput,
  STATUS_OPTIONS, formatDate, friendlyError,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/portfolio/")({
  head: () => adminHead("Portfolio"),
  component: PortfolioList,
});

function PortfolioList() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [featured, setFeatured] = useState("");
  const cats = useQuery({ queryKey: ["cms", "portfolio_categories"], queryFn: () => must(supabase.from("portfolio_categories").select("id,name").order("sort_order")) });
  const q = useQuery({
    queryKey: ["cms", "projects"],
    queryFn: () => must(supabase.from("portfolio_projects").select("id,title,slug,client_name,status,is_featured,project_year,updated_at,category_id,portfolio_categories(name)").order("updated_at", { ascending: false })),
  });
  const rows = (q.data ?? []).filter((p) =>
    (!category || (category === "none" ? !p.category_id : p.category_id === category)) && (!status || p.status === status) && (!featured || String(p.is_featured) === featured));

  async function toggle(id: string, s: string) {
    const next = s === "published" ? "draft" : "published";
    const { error } = await supabase.from("portfolio_projects").update({ status: next }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(next === "published" ? "Project published" : "Project unpublished");
    qc.invalidateQueries({ queryKey: ["cms"] });
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Website"
        title="Portfolio"
        actions={
          <>
            <Link to="/control-centre/portfolio/categories"><AdminButton>Categories</AdminButton></Link>
            <Link to="/control-centre/portfolio/projects/new"><AdminButton variant="primary"><Plus className="size-4" aria-hidden /> Create project</AdminButton></Link>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 md:max-w-2xl">
        <SelectInput label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: "", label: "All categories" }, { value: "none", label: "Uncategorised" }, ...(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]} />
        <SelectInput label="Featured" value={featured} onChange={(e) => setFeatured(e.target.value)} options={[{ value: "", label: "All" }, { value: "true", label: "Featured" }, { value: "false", label: "Not featured" }]} />
      </div>
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No projects yet. Create the first one." : "No projects match these filters."}</EmptyState>}
      {rows.length > 0 && (
        <DataTable head={["Project", "Client", "Category", "Status", "Featured", "Year", "Updated", ""]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <Td className="font-medium"><Link to="/control-centre/portfolio/projects/$id" params={{ id: p.id }} className="hover:text-accent">{p.title}</Link></Td>
              <Td>{p.client_name ?? "—"}</Td>
              <Td>{p.portfolio_categories?.name ?? "—"}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>{p.is_featured ? <FeaturedBadge /> : <span className="text-muted-foreground">—</span>}</Td>
              <Td className="tabular-nums">{p.project_year ?? "—"}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(p.updated_at)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link to="/control-centre/portfolio/projects/$id" params={{ id: p.id }}><AdminButton size="sm">Edit</AdminButton></Link>
                  <a href={`/work/${p.slug}`} target="_blank" rel="noreferrer"><AdminButton size="sm" variant="ghost"><ExternalLink className="size-3.5" aria-hidden /> Preview</AdminButton></a>
                  <AdminButton size="sm" variant="ghost" onClick={() => toggle(p.id, p.status)}>{p.status === "published" ? "Unpublish" : "Publish"}</AdminButton>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
