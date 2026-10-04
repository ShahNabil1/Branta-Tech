import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowDown, ArrowUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, TextArea, SelectInput, AdminButton, ConfirmButton, LoadingRow, ErrorNote, EmptyState, StatusBadge,
  STATUS_OPTIONS, SLUG_RE, useAutoSlug, useFormState, friendlyError, nullIfEmpty,
  swapped,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/portfolio/categories")({
  head: () => adminHead("Portfolio categories"),
  component: CategoriesPage,
});

const KEY = ["cms", "portfolio_categories", "full"];

function CategoriesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => must(supabase.from("portfolio_categories").select("*").order("sort_order")) });
  const [editing, setEditing] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["cms"] });

  async function move(i: number, d: -1 | 1) {
    let order = q.data!.map((c) => c.id);
    order = swapped(order, i, i + d);
    const res = await Promise.all(order.map((id, idx) => supabase.from("portfolio_categories").update({ sort_order: (idx + 1) * 10 }).eq("id", id)));
    const err = res.find((r) => r.error)?.error;
    if (err) toast.error(friendlyError(err));
    refresh();
  }
  async function toggle(c: Tables<"portfolio_categories">) {
    const next = c.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("portfolio_categories").update({ status: next }).eq("id", c.id);
    if (error) return void toast.error(friendlyError(error));
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("portfolio_categories").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Category deleted. Its projects are now uncategorised.");
    refresh();
  }

  return (
    <div className="max-w-4xl">
      <Link to="/control-centre/portfolio" className="text-small mb-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Portfolio
      </Link>
      <PageHeader eyebrow="Website · Portfolio" title="Categories" actions={<AdminButton variant="primary" onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> Create category</AdminButton>} />
      {editing === "new" && <Panel className="mb-4" title="New category"><CategoryForm category={null} nextOrder={(q.data?.length ?? 0) * 10 + 10} onDone={() => { setEditing(null); refresh(); }} /></Panel>}
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data?.length === 0 && editing !== "new" && <EmptyState>No categories yet.</EmptyState>}
      <ul className="grid gap-2">
        {q.data?.map((c, i) => (
          <li key={c.id} className="rounded-md border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="text-small flex-1 font-medium">{c.name} <span className="font-mono text-muted-foreground">/{c.slug}</span></span>
              <StatusBadge status={c.status} />
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === q.data.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => toggle(c)}>{c.status === "published" ? "Unpublish" : "Publish"}</AdminButton>
              <AdminButton size="sm" onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? "Close" : "Edit"}</AdminButton>
              <ConfirmButton title={`Delete "${c.name}"?`} description="Projects in this category are kept and become uncategorised." onConfirm={() => remove(c.id)}>Delete</ConfirmButton>
            </div>
            {editing === c.id && <div className="border-t border-border p-4"><CategoryForm category={c} nextOrder={c.sort_order} onDone={() => { setEditing(null); refresh(); }} /></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryForm({ category, nextOrder, onDone }: { category: Tables<"portfolio_categories"> | null; nextOrder: number; onDone: () => void }) {
  const f = useFormState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    sort_order: String(category?.sort_order ?? nextOrder),
    status: category?.status ?? "draft",
  });
  const slug = useAutoSlug(category?.slug ?? "", !category);
  const v = f.values;
  const slugError = slug.slug && !SLUG_RE.test(slug.slug) ? "Use lowercase letters, numbers and hyphens." : null;

  async function save() {
    if (f.state === "saving") return;
    if (!v.name.trim()) return f.fail("Name is required.");
    if (!slug.slug || slugError) return f.fail(slugError ?? "Slug is required.");
    f.begin();
    const payload = { name: v.name.trim(), slug: slug.slug, description: nullIfEmpty(v.description), sort_order: Math.round(Number(v.sort_order) || 0), status: v.status };
    const { error } = category
      ? await supabase.from("portfolio_categories").update(payload).eq("id", category.id)
      : await supabase.from("portfolio_categories").insert(payload);
    if (error) return f.fail(friendlyError(error));
    f.markSaved(v);
    toast.success("Category saved");
    onDone();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput label="Name" value={v.name} onChange={(e) => { f.set("name", e.target.value); slug.syncFrom(e.target.value); }} />
      <TextInput label="Slug" value={slug.slug} error={slugError} onChange={(e) => slug.setSlug(e.target.value)} />
      <TextArea label="Description" value={v.description} onChange={(e) => f.set("description", e.target.value)} className="md:col-span-2" />
      <TextInput label="Sort order" type="number" value={v.sort_order} onChange={(e) => f.set("sort_order", e.target.value)} />
      <SelectInput label="Status" value={v.status} options={STATUS_OPTIONS} onChange={(e) => f.set("status", e.target.value)} />
      <div className="flex items-center gap-3 md:col-span-2">
        <AdminButton variant="primary" onClick={save} disabled={f.state === "saving"}>{f.state === "saving" ? "Saving…" : "Save category"}</AdminButton>
        <AdminButton variant="ghost" onClick={onDone}>Cancel</AdminButton>
        {f.state === "error" && <span className="text-caption text-destructive" role="alert">{f.error}</span>}
      </div>
    </div>
  );
}
