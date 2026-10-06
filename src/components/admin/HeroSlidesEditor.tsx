import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { AdminButton, CheckboxInput, ConfirmButton, SelectInput, TextInput, isSafeUrl } from "@/components/admin/cms";
import { SLIDE_LAYOUTS, parseSlider, type HeroSlide } from "@/lib/hero-slides";
import { HOME_GROUPS } from "@/lib/work-showcase";
import { vimeoId } from "@/lib/hero";

const GROUPS = [{ value: "", label: "None" }, ...HOME_GROUPS.map((g) => ({ value: g.key, label: g.label }))];
const TYPES = [{ value: "image", label: "Image" }, { value: "video", label: "MP4 / WebM" }, { value: "vimeo", label: "Vimeo" }];

/** Hero slider editor: writes slides[] / slider_autoplay / slider_interval into the hero section config JSON. */
export function HeroSlidesEditor({ obj, write }: { obj: Record<string, unknown>; write: (patch: Record<string, unknown>) => void }) {
  const cfg = parseSlider(obj);
  const raw = Array.isArray(obj["slides"]) ? (obj["slides"] as Record<string, unknown>[]) : [];
  const save = (list: unknown[]) => write({ slides: list });
  const set = (i: number, patch: Partial<HeroSlide> & Record<string, unknown>) => save(raw.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, j: number) => { const n = [...raw]; [n[i], n[j]] = [n[j]!, n[i]!]; save(n); };

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">Hero slider</p>
      <p className="text-caption text-muted-foreground">Published slides show in this order. Draft slides are hidden. Mini cards and fallback media come from the chosen work group's published projects.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <CheckboxInput label="Autoplay (pauses on hover, touch and when off-screen)" checked={cfg.autoplay} onChange={(b) => write({ slider_autoplay: b })} />
        <TextInput label="Seconds per slide (4–15)" type="number" min={4} max={15} value={String(cfg.interval)} onChange={(e) => write({ slider_interval: Number(e.target.value) })} />
      </div>
      {cfg.slides.map((s, i) => {
        const m = (raw[i]?.["media"] ?? {}) as { type?: string; url?: string; poster?: string };
        const urlErr = m.url && (m.type === "vimeo" ? !vimeoId(m.url) : !/^https:\/\/|^\/(?!\/)/.test(m.url)) ? "Use a valid https:// or Vimeo URL." : null;
        return (
          <div key={s.id + i} className="grid gap-3 rounded-sm border border-border p-3 md:grid-cols-2">
            <div className="flex items-center justify-between md:col-span-2">
              <p className="text-small font-medium">{i + 1}. {s.title.split("\n")[0] || "Untitled slide"} {s.status === "draft" && <span className="text-caption text-muted-foreground">(draft)</span>}</p>
              <div className="flex gap-1">
                <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up"><ArrowUp className="size-4" /></AdminButton>
                <AdminButton size="sm" variant="ghost" disabled={i === cfg.slides.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down"><ArrowDown className="size-4" /></AdminButton>
                <ConfirmButton onConfirm={() => save(raw.filter((_, j) => j !== i))}>Remove</ConfirmButton>
              </div>
            </div>
            <SelectInput label="Status" value={s.status} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }]} onChange={(e) => set(i, { status: e.target.value as HeroSlide["status"] })} />
            <SelectInput label="Layout" value={s.layout} options={SLIDE_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))} onChange={(e) => set(i, { layout: e.target.value as HeroSlide["layout"] })} />
            <TextInput label="Badge" value={s.badge} onChange={(e) => set(i, { badge: e.target.value })} />
            <SelectInput label="Work group (mini cards / fallback media)" value={s.work_group} options={GROUPS} onChange={(e) => set(i, { work_group: e.target.value })} />
            <TextInput label="Headline (new line = line break)" className="md:col-span-2" value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
            <TextInput label="Description" className="md:col-span-2" value={s.body} onChange={(e) => set(i, { body: e.target.value })} />
            <TextInput label="Button text" value={s.cta_label} onChange={(e) => set(i, { cta_label: e.target.value })} />
            <TextInput label="Button link" value={s.cta_url} placeholder="/book-a-call" error={s.cta_url && !isSafeUrl(s.cta_url) ? "Use /path or https:// URL." : null} onChange={(e) => set(i, { cta_url: e.target.value })} />
            <SelectInput label="Media type" value={m.type ?? "image"} options={TYPES} onChange={(e) => set(i, { media: { ...m, type: e.target.value } })} />
            <TextInput label="Media URL (optional)" value={m.url ?? ""} error={urlErr} onChange={(e) => set(i, { media: { ...m, url: e.target.value.trim() } })} />
            <TextInput label="Poster image URL (optional; Vimeo auto-fills)" className="md:col-span-2" value={m.poster ?? ""} onChange={(e) => set(i, { media: { ...m, poster: e.target.value.trim() } })} />
          </div>
        );
      })}
      <div>
        <AdminButton size="sm" variant="secondary" onClick={() => save([...raw, { id: `s${Date.now().toString(36)}`, status: "draft", layout: "intro", title: "New slide", cta_label: "Book a Consultation", cta_url: "/book-a-call" }])}>
          <Plus className="size-4" /> Add slide
        </AdminButton>
      </div>
    </div>
  );
}
