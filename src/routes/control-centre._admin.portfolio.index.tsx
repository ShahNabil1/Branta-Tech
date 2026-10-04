import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import {
  PageHeader, Td, StatusBadge, FeaturedBadge, LoadingRow, ErrorNote, EmptyState, AdminButton, SelectInput, TextInput,
  STATUS_OPTIONS, formatDate, friendlyError,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/portfolio/")({
  head: () => adminHead("Portfolio"),
  component: PortfolioList,
});

type BulkAction = "published" | "draft" | "archived" | "feature" | "unfeature" | "delete";

const ACTION_COPY: Record<BulkAction, { verb: string; done: string; confirm?: (n: number) => string }> = {
  published: { verb: "Publish", done: "published", confirm: (n) => `Publish ${n} project${n === 1 ? "" : "s"}? They will appear on the public Work page.` },
  draft: { verb: "Move to Draft", done: "moved to Draft", confirm: (n) => `Move ${n} project${n === 1 ? "" : "s"} to Draft? They will stop showing publicly.` },
  archived: { verb: "Archive", done: "archived", confirm: (n) => `Archive ${n} project${n === 1 ? "" : "s"}? They will be hidden publicly; media and case-study content are kept.` },
  feature: { verb: "Set Featured", done: "set as featured" },
  unfeature: { verb: "Remove Featured", done: "removed from featured" },
  delete: { verb: "Delete", done: "deleted" },
};

const plural = (n: number) => `${n} project${n === 1 ? "" : "s"}`;

function PortfolioList() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [featured, setFeatured] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [failures, setFailures] = useState<{ title: string; reason: string }[]>([]);

  const cats = useQuery({ queryKey: ["cms", "portfolio_categories"], queryFn: () => must(supabase.from("portfolio_categories").select("id,name").order("sort_order")) });
  const q = useQuery({
    queryKey: ["cms", "projects"],
    queryFn: () => must(supabase.from("portfolio_projects").select("id,title,slug,client_name,status,is_featured,project_year,updated_at,category_id,portfolio_categories(name)").order("updated_at", { ascending: false })),
  });
  const term = search.trim().toLowerCase();
  const rows = useMemo(() => (q.data ?? []).filter((p) =>
    (!category || (category === "none" ? !p.category_id : p.category_id === category)) &&
    (!status || p.status === status) &&
    (!featured || String(p.is_featured) === featured) &&
    (!term || p.title.toLowerCase().includes(term) || (p.client_name ?? "").toLowerCase().includes(term) || p.slug.includes(term))),
  [q.data, category, status, featured, term]);

  // Avoid stale selection: drop ids no longer visible after filters/data change.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  async function toggle(id: string, s: string) {
    const next = s === "published" ? "draft" : "published";
    const { error } = await supabase.from("portfolio_projects").update({ status: next }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(next === "published" ? "Project published" : "Project unpublished");
    qc.invalidateQueries({ queryKey: ["cms"] });
  }

  function request(action: BulkAction) {
    if (busy || selected.size === 0) return;
    setTyped("");
    setFailures([]);
    if (action === "feature" || action === "unfeature") return void run(action);
    setPending(action);
  }

  async function run(action: BulkAction) {
    if (busy) return;
    setBusy(true);
    const ids = [...selected];
    const titles = new Map((q.data ?? []).map((p) => [p.id, p.title]));
    const toastId = toast.loading(`Processing ${plural(ids.length)}…`);
    const failed: { title: string; reason: string }[] = [];
    let ok = 0;
    try {
      if (action === "delete") {
        for (const id of ids) {
          const { data, error } = await supabase.from("portfolio_projects").delete().eq("id", id).select("id");
          if (error) failed.push({ title: titles.get(id) ?? "Project", reason: friendlyError(error) });
          else if (!data?.length) failed.push({ title: titles.get(id) ?? "Project", reason: "Not allowed or already removed." });
          else ok++;
        }
      } else {
        const patch = action === "feature" ? { is_featured: true } : action === "unfeature" ? { is_featured: false } : { status: action };
        const { data, error } = await supabase.from("portfolio_projects").update(patch).in("id", ids).select("id");
        if (error) ids.forEach((id) => failed.push({ title: titles.get(id) ?? "Project", reason: friendlyError(error) }));
        else {
          const done = new Set((data ?? []).map((d) => d.id));
          ok = done.size;
          ids.filter((id) => !done.has(id)).forEach((id) => failed.push({ title: titles.get(id) ?? "Project", reason: "Not allowed or no longer exists." }));
        }
      }
      const copy = ACTION_COPY[action];
      if (failed.length === 0) toast.success(`${plural(ok)} ${copy.done}`, { id: toastId });
      else if (ok > 0) toast.warning(`${ok} updated, ${failed.length} failed`, { id: toastId });
      else toast.error(`${copy.verb} failed for ${plural(failed.length)}`, { id: toastId });
      setFailures(failed);
      setSelected(new Set());
      setPending(null);
      await qc.invalidateQueries({ queryKey: ["cms"] });
    } catch (e) {
      toast.error(friendlyError(e), { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  const n = selected.size;
  const deletePhrase = "DELETE";

  return (
    <div className="max-w-6xl pb-28">
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
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput label="Search" placeholder="Title, client or slug" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectInput label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: "", label: "All categories" }, { value: "none", label: "Uncategorised" }, ...(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]} />
        <SelectInput label="Featured" value={featured} onChange={(e) => setFeatured(e.target.value)} options={[{ value: "", label: "All" }, { value: "true", label: "Featured" }, { value: "false", label: "Not featured" }]} />
      </div>

      {failures.length > 0 && (
        <div role="alert" className="mb-4 rounded-md border border-border bg-surface p-4 text-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium">{plural(failures.length)} could not be changed</p>
            <button type="button" onClick={() => setFailures([])} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </div>
          <ul className="space-y-1 text-muted-foreground">
            {failures.map((f, i) => <li key={i}><span className="text-foreground">{f.title}</span> — {f.reason}</li>)}
          </ul>
        </div>
      )}

      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>{friendlyError(q.error)}</ErrorNote>}
      {q.data && rows.length === 0 && <EmptyState>{q.data.length === 0 ? "No projects yet. Create the first one." : "No projects match these filters."}</EmptyState>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-caption uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={allSelected ? "Clear selection" : "Select all visible projects"}
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="size-4 accent-foreground"
                  />
                </th>
                {["Project", "Client", "Category", "Status", "Featured", "Year", "Updated", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => {
                const on = selected.has(p.id);
                return (
                  <tr key={p.id} className={on ? "bg-muted/60" : "hover:bg-muted/30"} aria-selected={on}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label={`Select ${p.title}`} checked={on} onChange={() => toggleOne(p.id)} className="size-4 accent-foreground" />
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {n > 0 && (
        <div role="region" aria-label="Bulk actions" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-sm lg:left-60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-medium tabular-nums" aria-live="polite">{n} selected</p>
            <AdminButton size="sm" disabled={busy} onClick={() => request("published")}>Publish</AdminButton>
            <AdminButton size="sm" disabled={busy} onClick={() => request("draft")}>Move to Draft</AdminButton>
            <AdminButton size="sm" disabled={busy} onClick={() => request("archived")}>Archive</AdminButton>
            <AdminButton size="sm" variant="ghost" disabled={busy} onClick={() => request("feature")}>Set Featured</AdminButton>
            <AdminButton size="sm" variant="ghost" disabled={busy} onClick={() => request("unfeature")}>Remove Featured</AdminButton>
            <AdminButton size="sm" variant="danger" disabled={busy} onClick={() => request("delete")}>Delete</AdminButton>
            <AdminButton size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>Clear</AdminButton>
          </div>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center" onClick={() => !busy && setPending(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="bulk-title" className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            {pending === "delete" ? (
              <>
                <h2 id="bulk-title" className="text-lg font-semibold">Delete {plural(n)}?</h2>
                <p className="mt-2 text-sm text-muted-foreground">This will permanently delete the selected projects and their own media, service links, case-study sections and credits. Services, categories, team members and site-wide media are not affected.</p>
                <p className="mt-2 text-sm font-medium">This action cannot be undone.</p>
                <div className="mt-4">
                  <TextInput label={`Type ${deletePhrase} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
                </div>
              </>
            ) : (
              <h2 id="bulk-title" className="text-base font-medium">{ACTION_COPY[pending].confirm?.(n)}</h2>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AdminButton disabled={busy} onClick={() => setPending(null)}>Cancel</AdminButton>
              <AdminButton
                variant={pending === "delete" ? "danger" : "primary"}
                disabled={busy || (pending === "delete" && typed.trim() !== deletePhrase)}
                onClick={() => run(pending)}
              >
                {busy ? "Working…" : pending === "delete" ? `Delete ${plural(n)}` : ACTION_COPY[pending].verb}
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
