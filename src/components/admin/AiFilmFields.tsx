import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, CheckboxInput, SelectInput, TextInput, swapped } from "@/components/admin/cms";
import { parseFilmConfig } from "@/lib/ai-film.functions";

type Proj = { id: string; title: string; status: string };

/** Editor for the AI Film showcase config. Stores only presentation options and project IDs — never project data. */
export function AiFilmFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  const [projects, setProjects] = useState<Proj[]>([]);
  useEffect(() => {
    void supabase.from("portfolio_projects").select("id,title,status").order("sort_order").then(({ data }) => setProjects(data ?? []));
  }, []);

  let obj: Record<string, unknown>;
  try {
    const p = JSON.parse(config || "{}");
    obj = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return <p className="text-caption text-destructive md:col-span-2">AI Film settings unavailable: advanced config is not valid JSON.</p>;
  }
  const cfg = parseFilmConfig(obj);
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const picked = cfg.project_ids;
  const title = (id: string) => projects.find((p) => p.id === id);

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">AI Film showcase</p>
      <p className="text-caption text-muted-foreground">Eyebrow, Title, Body and the button above are the section intro. Use "Visible" to show or hide the section.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Max films (1–8)" type="number" min={1} max={8} value={cfg.max_items} onChange={(e) => write({ max_items: Number(e.target.value) })} />
        <SelectInput label="Order" value={cfg.sort_mode} onChange={(e) => write({ sort_mode: e.target.value })}
          options={[{ value: "featured", label: "Featured first" }, { value: "sort_order", label: "Sort order" }, { value: "recent", label: "Recently updated" }]} />
      </div>
      <CheckboxInput label="Show filter" hint="Only filters with matching films appear." checked={cfg.filter_enabled} onChange={(v) => write({ filter_enabled: v })} />
      <div className="grid gap-2">
        <p className="text-small font-medium">Hand-picked films (optional)</p>
        <p className="text-caption text-muted-foreground">If any are picked, only these show, in this order. Otherwise published film projects show automatically. Drafts never show.</p>
        {picked.map((id, i) => (
          <div key={id} className="flex items-center justify-between gap-2 rounded-sm border border-border p-2 text-small">
            <span>{title(id)?.title ?? "Missing project"} {title(id) && title(id)?.status !== "published" && <span className="text-caption text-muted-foreground">(not published)</span>}</span>
            <span className="flex gap-1">
              <AdminButton size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => write({ project_ids: swapped(picked, i, i - 1) })}><ArrowUp className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" aria-label="Move down" disabled={i === picked.length - 1} onClick={() => write({ project_ids: swapped(picked, i, i + 1) })}><ArrowDown className="size-3.5" /></AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => write({ project_ids: picked.filter((x) => x !== id) })}>Remove</AdminButton>
            </span>
          </div>
        ))}
        <SelectInput label="Add a project" value="" onChange={(e) => e.target.value && write({ project_ids: [...picked, e.target.value] })}
          options={[{ value: "", label: "Choose…" }, ...projects.filter((p) => !picked.includes(p.id)).map((p) => ({ value: p.id, label: `${p.title}${p.status !== "published" ? " (draft)" : ""}` }))]} />
      </div>
    </div>
  );
}
