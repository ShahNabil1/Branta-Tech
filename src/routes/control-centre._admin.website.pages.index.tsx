import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, DataTable, Td, StatusBadge, LoadingRow, ErrorNote, EmptyState, AdminButton, formatDate, friendlyError } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/website/pages/")({
  head: () => adminHead("Pages"),
  component: PagesList,
});

export const pagePreviewHref = (slug: string) => (slug === "home" ? "/" : `/${slug}`);

function PagesList() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cms", "pages"],
    queryFn: () => must(supabase.from("site_pages").select("id,title,slug,page_type,status,updated_at").order("updated_at", { ascending: false })),
  });

  async function toggle(id: string, status: string) {
    const next = status === "published" ? "draft" : "published";
    const { error } = await supabase.from("site_pages").update({ status: next }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(next === "published" ? "Page published" : "Page unpublished");
    qc.invalidateQueries({ queryKey: ["cms"] });
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Website"
        title="Pages"
        description="Website pages, their sections and SEO."
        actions={
          <Link to="/control-centre/website/pages/$id" params={{ id: "new" }}>
            <AdminButton variant="primary"><Plus className="size-4" aria-hidden /> Create page</AdminButton>
          </Link>
        }
      />
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && q.data.length === 0 && <EmptyState>No pages yet. Create the first one.</EmptyState>}
      {q.data && q.data.length > 0 && (
        <DataTable head={["Title", "Slug", "Page type", "Status", "Updated", ""]}>
          {q.data.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <Td className="font-medium">
                <Link to="/control-centre/website/pages/$id" params={{ id: p.id }} className="hover:text-accent">{p.title}</Link>
              </Td>
              <Td className="font-mono text-muted-foreground">/{p.slug}</Td>
              <Td className="capitalize">{p.page_type}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{formatDate(p.updated_at)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link to="/control-centre/website/pages/$id" params={{ id: p.id }}><AdminButton size="sm">Edit</AdminButton></Link>
                  <a href={pagePreviewHref(p.slug)} target="_blank" rel="noreferrer">
                    <AdminButton size="sm" variant="ghost"><ExternalLink className="size-3.5" aria-hidden /> Preview</AdminButton>
                  </a>
                  <AdminButton size="sm" variant="ghost" onClick={() => toggle(p.id, p.status)}>
                    {p.status === "published" ? "Unpublish" : "Publish"}
                  </AdminButton>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
