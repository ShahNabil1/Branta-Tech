import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, CheckboxInput, AdminButton, LoadingRow, ErrorNote, StatusBadge, FeaturedBadge,
  STATUS_OPTIONS, useFormState, friendlyError, nullIfEmpty,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/services/groups")({
  head: () => adminHead("Service groups"),
  component: GroupsPage,
});

function GroupsPage() {
  const q = useQuery({ queryKey: ["cms", "service_groups", "full"], queryFn: () => must(supabase.from("service_groups").select("*").order("sort_order")) });
  return (
    <div className="max-w-4xl">
      <Link to="/control-centre/services" className="text-small mb-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Services
      </Link>
      <PageHeader eyebrow="Website · Services" title="Service groups" description="The main service groups. These can be edited, reordered or unpublished, but not deleted." />
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      <div className="grid gap-4">{q.data?.map((g) => <GroupForm key={g.id} group={g} />)}</div>
    </div>
  );
}

function GroupForm({ group }: { group: Tables<"service_groups"> }) {
  const qc = useQueryClient();
  const f = useFormState({
    name: group.name,
    short_description: group.short_description ?? "",
    description: group.description ?? "",
    sort_order: String(group.sort_order),
    is_featured: group.is_featured,
    status: group.status,
  });
  const v = f.values;
  async function save() {
    if (f.state === "saving") return;
    if (!v.name.trim()) return f.fail("Name is required.");
    f.begin();
    const { error } = await supabase.from("service_groups").update({
      name: v.name.trim(), short_description: nullIfEmpty(v.short_description), description: nullIfEmpty(v.description),
      sort_order: Math.round(Number(v.sort_order) || 0), is_featured: v.is_featured, status: v.status,
    }).eq("id", group.id);
    if (error) return f.fail(friendlyError(error));
    f.markSaved(v);
    toast.success(`${v.name} saved`);
    qc.invalidateQueries({ queryKey: ["cms"] });
  }
  return (
    <Panel
      title={group.name}
      description={`/${group.slug}`}
      actions={<div className="flex gap-1.5"><StatusBadge status={group.status} />{group.is_featured && <FeaturedBadge />}</div>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Name" value={v.name} onChange={(e) => f.set("name", e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", e.target.value)} />
          <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => f.set("status", e.target.value)} />
        </div>
        <TextArea label="Short description" value={v.short_description} onChange={(e) => f.set("short_description", e.target.value)} className="md:col-span-2" />
        <TextArea label="Description" value={v.description} onChange={(e) => f.set("description", e.target.value)} className="md:col-span-2" />
        <CheckboxInput label="Featured" checked={v.is_featured} onChange={(b) => f.set("is_featured", b)} />
        <div className="flex items-center justify-end gap-3">
          <span className="text-caption" role="status">
            {f.state === "saved" && !f.dirty && "Saved"}
            {f.state === "error" && <span className="text-destructive">{f.error}</span>}
            {f.dirty && f.state !== "error" && f.state !== "saving" && <span className="text-muted-foreground">Unsaved changes</span>}
          </span>
          <AdminButton variant="primary" onClick={save} disabled={f.state === "saving" || !f.dirty}>{f.state === "saving" ? "Saving…" : "Save"}</AdminButton>
        </div>
      </div>
    </Panel>
  );
}
