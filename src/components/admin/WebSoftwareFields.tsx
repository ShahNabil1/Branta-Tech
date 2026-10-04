import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, SelectInput, TextArea, TextInput } from "@/components/admin/cms";
import { parseWebConfig } from "@/lib/web-software.functions";

type Proj = { id: string; title: string; status: string };

/** Editor for the Web & Software showcase config (promo film, capability labels, work area). Stores only options and project IDs. */
export function WebSoftwareFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  const [projects, setProjects] = useState<Proj[]>([]);
  useEffect(() => {
    void supabase.from("portfolio_projects").select("id,title,status").order("sort_order").then(({ data }) => setProjects(data ?? []));
  }, []);
  let obj: Record<string, unknown>;
  try {
    const p = JSON.parse(config || "{}");
    obj = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return <p className="text-caption text-destructive md:col-span-2">Web & Software settings unavailable: advanced config is not valid JSON.</p>;
  }
  const cfg = parseWebConfig(obj);
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const picked = cfg.project_ids;

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">Web & Software showcase</p>
      <p className="text-caption text-muted-foreground">Eyebrow, Title, Body and the button above are the intro.</p>
      <TextArea label="Supporting statement" hint="One line per row." value={cfg.statement} onChange={(e) => write({ statement: e.target.value })} />
      <TextInput label="Promo Vimeo URL" value={cfg.promo_vimeo_url} onChange={(e) => write({ promo_vimeo_url: e.target.value })} />
      <TextInput label="Promo poster URL" hint="https image shown before the film plays." value={cfg.promo_poster_url} onChange={(e) => write({ promo_poster_url: e.target.value })} />
      <TextInput label="Capability labels" hint="Separate with commas." value={cfg.capabilities.join(", ")}
        onChange={(e) => write({ capabilities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Work area heading" value={cfg.work_heading} onChange={(e) => write({ work_heading: e.target.value })} />
        <TextInput label="Max projects (1–6)" type="number" min={1} max={6} value={cfg.max_items} onChange={(e) => write({ max_items: Number(e.target.value) })} />
      </div>
      <div className="grid gap-2">
        <p className="text-small font-medium">Hand-picked projects (optional)</p>
        <p className="text-caption text-muted-foreground">If empty, published projects linked to web/software services show automatically.</p>
        {picked.map((id) => (
          <div key={id} className="flex items-center justify-between rounded-sm border border-border p-2 text-small">
            <span>{projects.find((p) => p.id === id)?.title ?? "Missing project"}</span>
            <AdminButton size="sm" variant="ghost" onClick={() => write({ project_ids: picked.filter((x) => x !== id) })}>Remove</AdminButton>
          </div>
        ))}
        <SelectInput label="Add a project" value="" onChange={(e) => e.target.value && write({ project_ids: [...picked, e.target.value] })}
          options={[{ value: "", label: "Choose…" }, ...projects.filter((p) => !picked.includes(p.id)).map((p) => ({ value: p.id, label: `${p.title}${p.status !== "published" ? " (draft)" : ""}` }))]} />
      </div>
    </div>
  );
}
