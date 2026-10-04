import { AdminButton, CheckboxInput, ConfirmButton, TextInput, TextArea } from "@/components/admin/cms";
import { UploadImageButton } from "@/components/admin/UploadImageButton";
import { SectionMediaEditor } from "@/components/admin/SectionMediaEditor";
import { parseMediaItems, type SectionMediaItem } from "@/lib/section-media";
import { asObj, maxItems, parseLogos, parseSteps, secondaryCta, type ClientLogo, type ProcessStep } from "@/lib/home-closing";

type Props = { type: string; config: string; onChange: (json: string) => void };
const swap = <T,>(a: T[], i: number, j: number) => { const n = [...a]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; };

/** Extra fields for process, client_logos, insights_teaser, careers_teaser and final_cta. Intro text uses the standard fields above. */
export function HomeClosingFields({ type, config, onChange }: Props) {
  let obj: Record<string, unknown>;
  try { obj = asObj(JSON.parse(config || "{}")); } catch {
    return <p className="text-caption text-destructive md:col-span-2">Settings unavailable: advanced config is not valid JSON.</p>;
  }
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const media = (title: string, hint: string, aspect: "4:3" | "full") => (
    <SectionMediaEditor title={title} hint={hint} max={1} defaultAspect={aspect} items={parseMediaItems(obj, false, aspect)}
      onChange={(n: SectionMediaItem[]) => write({ media_items: n })} />
  );
  const box = (title: string, children: React.ReactNode) => (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">{title}</p>
      {children}
    </div>
  );

  if (type === "process") {
    const raw = Array.isArray(obj["steps"]) ? (obj["steps"] as ProcessStep[]) : parseSteps(obj);
    const steps = raw.map((s) => ({ title: s?.title ?? "", body: s?.body ?? "" }));
    const set = (n: ProcessStep[]) => write({ steps: n });
    return box("Process steps", <>
      <p className="text-caption text-muted-foreground">Eyebrow, Title and Body above are the intro. Steps are numbered automatically in this order.</p>
      {steps.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-sm border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-small font-medium">Step {String(i + 1).padStart(2, "0")}</p>
            <div className="flex gap-1">
              <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => set(swap(steps, i, i - 1))}>Up</AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => set(steps.filter((_, j) => j !== i))}>Remove</AdminButton>
            </div>
          </div>
          <TextInput label="Title" value={s.title} onChange={(e) => set(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <TextArea label="Description" value={s.body} onChange={(e) => set(steps.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
        </div>
      ))}
      {steps.length < 8 && <AdminButton size="sm" variant="ghost" onClick={() => set([...steps, { title: "", body: "" }])}>Add step</AdminButton>}
      {media("Optional illustration", "Shown under the intro on desktop. Leave empty for text only.", "4:3")}
    </>);
  }

  if (type === "client_logos") {
    const logos = parseLogos(obj);
    const set = (n: ClientLogo[]) => write({ logos: n.map((l, i) => ({ ...l, sort_order: i })) });
    const upd = (i: number, p: Partial<ClientLogo>) => set(logos.map((l, j) => (j === i ? { ...l, ...p } : l)));
    return box("Client logos", <>
      <p className="text-caption text-muted-foreground">Real clients only. These logos are shown in the Trust & Credibility band right after the Hero (not repeated later on the homepage). The band stays hidden on the website until at least one enabled logo with a client name and an https logo URL exists.</p>
      {logos.length === 0 && <p className="text-small rounded-sm border border-dashed border-border p-4 text-muted-foreground">No logos yet. Click "Add logo", then upload or paste its image.</p>}
      {logos.map((l, i) => (
        <div key={i} className="grid gap-2 rounded-sm border border-border p-3 md:grid-cols-2">
          <div className="flex items-center justify-between md:col-span-2">
            <p className="text-small font-medium">{l.client_name || `Logo ${i + 1}`}</p>
            <div className="flex gap-1">
              <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => set(swap(logos, i, i - 1))}>Up</AdminButton>
              <AdminButton size="sm" variant="ghost" disabled={i === logos.length - 1} onClick={() => set(swap(logos, i, i + 1))}>Down</AdminButton>
              <ConfirmButton title="Delete this client logo?" description="It is removed from the homepage after you save this section. Projects, client accounts, leads and other content are not affected." confirmLabel="Delete" onConfirm={() => set(logos.filter((_, j) => j !== i))}>Delete</ConfirmButton>
            </div>
          </div>
          <TextInput label="Client name" value={l.client_name} onChange={(e) => upd(i, { client_name: e.target.value })} />
          <TextInput label="Logo URL" hint="https. Uploads: PNG, WebP, AVIF or JPG (SVG upload is blocked for security; an https SVG link still works)." value={l.logo_url} onChange={(e) => upd(i, { logo_url: e.target.value })} />
          <div className="flex items-center gap-3 md:col-span-2">
            <UploadImageButton label={l.logo_url ? "Replace logo" : "Upload logo"} onUploaded={(url) => upd(i, { logo_url: url, alt: l.alt || (l.client_name ? `${l.client_name} logo` : "") })} />
            {/^https:\/\//.test(l.logo_url) && <span className="flex h-12 w-32 items-center justify-center rounded-sm border border-border bg-background p-2"><img src={l.logo_url} alt="" className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} /></span>}
          </div>
          <TextInput label="Alt text" value={l.alt} onChange={(e) => upd(i, { alt: e.target.value })} />
          <TextInput label="Client website (optional)" value={l.client_url} onChange={(e) => upd(i, { client_url: e.target.value })} />
          <CheckboxInput label="Visible on website" checked={l.enabled} onChange={(b) => upd(i, { enabled: b })} />
        </div>
      ))}
      <AdminButton size="sm" variant="ghost" onClick={() => set([...logos, { client_name: "", logo_url: "", client_url: "", alt: "", sort_order: logos.length, enabled: true }])}>Add logo</AdminButton>
    </>);
  }

  if (type === "insights_teaser") {
    return box("Insights teaser", <>
      <TextInput label="Max articles (1–3)" type="number" min={1} max={3} value={maxItems(obj)} onChange={(e) => write({ max_items: Number(e.target.value) })} />
      <p className="text-caption text-muted-foreground">No articles system exists yet, so the website shows a short "on the way" note instead of cards.</p>
    </>);
  }

  if (type === "careers_teaser") {
    return box("Careers teaser", <>
      <p className="text-caption text-muted-foreground">Add a real team or office photo or video. Leave empty for a typography-only layout. (An older Media URL above is used only when no media is added here.)</p>
      {media("Team / office visual", "Image, direct video or Vimeo.", "4:3")}
    </>);
  }

  if (type === "final_cta") {
    const s = secondaryCta(obj);
    return box("Final call to action", <>
      <p className="text-caption text-muted-foreground">CTA label/URL above are the primary button. Title supports line breaks.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Secondary button label" value={s.label} onChange={(e) => write({ secondary_cta_label: e.target.value })} />
        <TextInput label="Secondary button URL" value={s.url} placeholder="/book-a-call" onChange={(e) => write({ secondary_cta_url: e.target.value })} />
      </div>
      {media("Optional background", "Fills the section behind the text with a dark overlay so text stays readable. Use 'Fill area' size.", "full")}
    </>);
  }
  return null;
}
