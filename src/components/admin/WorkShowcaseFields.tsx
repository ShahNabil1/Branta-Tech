import { AdminButton, CheckboxInput, TextInput } from "@/components/admin/cms";
import { asObj } from "@/lib/home-closing";
import { HOME_GROUPS, parseShowcaseConfig } from "@/lib/work-showcase";

/** Work Showcase settings. Projects always come from Portfolio (published + category homepage group / featured). */
export function WorkShowcaseFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown>;
  try { obj = asObj(JSON.parse(config || "{}")); } catch {
    return <p className="text-caption text-destructive md:col-span-2">Settings unavailable: advanced config is not valid JSON.</p>;
  }
  const c = parseShowcaseConfig(obj);
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const order = c.groupOrder;
  const move = (i: number, j: number) => { const n = [...order]; [n[i], n[j]] = [n[j]!, n[i]!]; write({ group_order: n }); };
  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">Work showcase</p>
      <p className="text-caption text-muted-foreground">Eyebrow, title, description and CTA above are the Featured Work heading. Featured row = published projects marked Featured. Category rows = published projects whose category has a Homepage group (Portfolio → Categories). Empty rows are hidden; hide the whole showcase with "Visible".</p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Maximum featured projects" type="number" min={1} max={16} value={String(c.maxFeatured)} onChange={(e) => write({ max_featured: Number(e.target.value) })} />
        <TextInput label="Row speed (seconds per loop, 20–90)" type="number" min={20} max={90} value={String(c.speed)} onChange={(e) => write({ speed: Number(e.target.value) })} />
        <CheckboxInput label="Show category jump navigation" checked={c.showJumpNav} onChange={(b) => write({ show_jump_nav: b })} />
        <TextInput label="Made by Branta: background Vimeo URL (one card, muted loop)" placeholder="https://vimeo.com/…" value={typeof obj["bento_video_url"] === "string" ? obj["bento_video_url"] : ""} onChange={(e) => write({ bento_video_url: e.target.value.trim() })} />
        <TextInput label="Video card title" placeholder="Branta Showreel" value={typeof obj["bento_video_title"] === "string" ? obj["bento_video_title"] : ""} onChange={(e) => write({ bento_video_title: e.target.value })} />
        <TextInput label="Video card category" placeholder="Made by Branta" value={typeof obj["bento_video_category"] === "string" ? obj["bento_video_category"] : ""} onChange={(e) => write({ bento_video_category: e.target.value })} />
        <CheckboxInput label="Live muted video in rows (video projects play automatically)" checked={c.hoverPreview} onChange={(b) => write({ hover_preview: b })} />
      </div>
      <p className="text-small font-medium">Category row order</p>
      {order.map((k, i) => {
        const g = HOME_GROUPS.find((x) => x.key === k)!;
        return (
          <div key={k} className="grid gap-2 rounded-sm border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-small font-medium">{i + 1}. {g.label}</p>
              <div className="flex gap-1">
                <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, i - 1)}>Up</AdminButton>
                <AdminButton size="sm" variant="ghost" disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>Down</AdminButton>
              </div>
            </div>
            <TextInput label="Row description" placeholder={g.description} value={c.descriptions[k] ?? ""}
              onChange={(e) => write({ descriptions: { ...c.descriptions, [k]: e.target.value } })} />
          </div>
        );
      })}
    </div>
  );
}
