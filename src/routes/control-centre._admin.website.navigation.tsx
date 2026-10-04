import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, CornerDownRight } from "lucide-react";
import { adminHead, getSettingsGroup, saveSettingsGroup } from "@/lib/supabase/cms";
import {
  PageHeader, Panel, TextInput, CheckboxInput, AdminButton, ConfirmButton, SaveBar, LoadingRow, ErrorNote, EmptyState,
  useFormState, useUnsavedWarning, isSafeUrl, friendlyError,
} from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/website/navigation")({
  head: () => adminHead("Navigation"),
  component: NavigationRoute,
});

type NavItem = { id: string; label: string; url: string; menu_group: string; sort_order: number; enabled: boolean; children: NavItem[] };
type NavSettings = { items: NavItem[] };

const uid = () => crypto.randomUUID();
const blank = (group = "main"): NavItem => ({ id: uid(), label: "", url: "/", menu_group: group, sort_order: 0, enabled: true, children: [] });

function normalize(raw: unknown): NavItem[] {
  const items = (raw as NavSettings | null)?.items;
  if (!Array.isArray(items)) return [];
  const fix = (i: Partial<NavItem>): NavItem => ({
    id: i.id || uid(), label: i.label ?? "", url: i.url ?? "", menu_group: i.menu_group ?? "main",
    sort_order: Number(i.sort_order) || 0, enabled: i.enabled !== false,
    children: Array.isArray(i.children) ? i.children.map(fix) : [],
  });
  return items.map(fix).sort((a, b) => a.sort_order - b.sort_order);
}

function NavigationRoute() {
  const q = useQuery({ queryKey: ["cms", "settings", "navigation"], queryFn: () => getSettingsGroup("navigation") });
  if (q.isLoading) return <LoadingRow />;
  if (q.error) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  return <NavigationEditor initial={normalize(q.data)} />;
}

function validate(items: NavItem[]): string | null {
  for (const i of [...items, ...items.flatMap((x) => x.children)]) {
    if (!i.label.trim()) return "Every item needs a label.";
    if (!i.url.trim()) return `"${i.label}" needs a URL.`;
    if (!isSafeUrl(i.url)) return `"${i.label}" has an unsafe or invalid URL. Use /path or https://.`;
  }
  return null;
}

function NavigationEditor({ initial }: { initial: NavItem[] }) {
  const qc = useQueryClient();
  const f = useFormState<NavItem[]>(initial);
  useUnsavedWarning(f.dirty && f.state !== "saving");
  const items = f.values;

  const update = (fn: (draft: NavItem[]) => NavItem[]) => f.setAll((p) => fn(structuredClone(p)));
  /** The list containing the item at path, plus the item's index in it. */
  const locate = (d: NavItem[], path: number[]): [NavItem[], number] | null => {
    const [i, c] = path;
    if (i === undefined) return null;
    if (c === undefined) return [d, i];
    const parent = d[i];
    return parent ? [parent.children, c] : null;
  };
  const patch = (path: number[], changes: Partial<NavItem>) =>
    update((d) => {
      const loc = locate(d, path);
      const cur = loc?.[0][loc[1]];
      if (loc && cur) loc[0][loc[1]] = { ...cur, ...changes };
      return d;
    });
  const move = (path: number[], dir: -1 | 1) =>
    update((d) => {
      const loc = locate(d, path);
      if (!loc) return d;
      const [list, i] = loc;
      const next = swapped(list, i, i + dir);
      list.splice(0, list.length, ...next);
      return d;
    });
  const remove = (path: number[]) =>
    update((d) => {
      const loc = locate(d, path);
      if (loc) loc[0].splice(loc[1], 1);
      return d;
    });
  const addChild = (i: number) =>
    update((d) => {
      const parent = d[i];
      if (parent) parent.children.push(blank(parent.menu_group));
      return d;
    });

  async function save() {
    if (f.state === "saving") return;
    const err = validate(items);
    if (err) return f.fail(err);
    f.begin();
    const renumber = (list: NavItem[]): NavItem[] =>
      list.map((i, idx) => ({ ...i, label: i.label.trim(), url: i.url.trim(), menu_group: i.menu_group.trim() || "main", sort_order: (idx + 1) * 10, children: renumber(i.children) }));
    const clean = renumber(items);
    try {
      await saveSettingsGroup("navigation", { items: clean });
      f.markSaved(clean);
      qc.invalidateQueries({ queryKey: ["cms", "settings", "navigation"] });
      toast.success("Navigation saved");
    } catch (e) {
      f.fail(friendlyError(e));
    }
  }

  const row = (item: NavItem, path: number[], siblings: number) => (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_8rem_auto] md:items-end">
      <TextInput label="Label" value={item.label} onChange={(e) => patch(path, { label: e.target.value })} />
      <TextInput label="URL" value={item.url} placeholder="/services" error={item.url && !isSafeUrl(item.url) ? "Unsafe or invalid URL" : null} onChange={(e) => patch(path, { url: e.target.value })} />
      <TextInput label="Menu group" list="nav-groups" value={item.menu_group} onChange={(e) => patch(path, { menu_group: e.target.value })} />
      <div className="flex flex-wrap items-center gap-1 pb-0.5">
        <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={path[path.length - 1] === 0} onClick={() => move(path, -1)}><ArrowUp className="size-3.5" /></AdminButton>
        <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={path[path.length - 1] === siblings - 1} onClick={() => move(path, 1)}><ArrowDown className="size-3.5" /></AdminButton>
        <ConfirmButton title="Remove this item?" description={path.length === 1 && item.children.length ? "Its child links will be removed too." : "The link will be removed when you save."} confirmLabel="Remove" onConfirm={() => remove(path)}>Remove</ConfirmButton>
      </div>
      <div className="md:col-span-4">
        <CheckboxInput label="Enabled" checked={item.enabled} onChange={(v) => patch(path, { enabled: v })} />
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Website"
        title="Navigation"
        description="Menu links for the website. Use internal paths like /services or full https:// links."
        actions={<AdminButton variant="primary" onClick={() => update((d) => [...d, blank()])}><Plus className="size-4" aria-hidden /> Add item</AdminButton>}
      />
      <datalist id="nav-groups">
        {["main", "footer", "create", "build", "company"].map((g) => <option key={g} value={g} />)}
      </datalist>
      {items.length === 0 && <EmptyState>No navigation items yet.</EmptyState>}
      <div className="grid gap-3">
        {items.map((item, i) => (
          <Panel key={item.id}>
            {row(item, [i], items.length)}
            {item.children.length > 0 && (
              <div className="mt-4 grid gap-4 border-l-2 border-border pl-4">
                {item.children.map((c, ci) => (
                  <div key={c.id}>{row(c, [i, ci], item.children.length)}</div>
                ))}
              </div>
            )}
            <AdminButton size="sm" variant="ghost" className="mt-3" onClick={() => update((d) => { d[i].children.push(blank(d[i].menu_group)); return d; })}>
              <CornerDownRight className="size-3.5" aria-hidden /> Add child link
            </AdminButton>
          </Panel>
        ))}
      </div>
      <SaveBar state={f.state} dirty={f.dirty} error={f.error} onSave={save} label="Save navigation" />
    </div>
  );
}
