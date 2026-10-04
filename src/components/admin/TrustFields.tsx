import { AdminButton, CheckboxInput, TextInput, TextArea } from "@/components/admin/cms";
import { asObj } from "@/lib/home-closing";
import { parseFundedBy, parseStats, showLogos, type FundedBy, type TrustStat } from "@/lib/trust";

const swap = <T,>(a: T[], i: number, j: number) => { const n = [...a]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; };

/** Trust & Credibility (trust_proof) editor. Eyebrow + Body above are the intro; logos live in the client_logos section. */
export function TrustFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown>;
  try { obj = asObj(JSON.parse(config || "{}")); } catch {
    return <p className="text-caption text-destructive md:col-span-2">Settings unavailable: advanced config is not valid JSON.</p>;
  }
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const stats = parseStats(obj);
  const setStats = (n: TrustStat[]) => write({ stats: n });
  const fb = parseFundedBy(obj);
  const setFb = (p: Partial<FundedBy>) => write({ funded_by: { ...fb, ...p } });
  const box = "grid gap-4 rounded-sm border border-border p-4 md:col-span-2";
  return (
    <>
      <div className={box}>
        <p className="text-eyebrow text-muted-foreground">Trust & Credibility — client logos</p>
        <p className="text-caption text-muted-foreground">Eyebrow and Body above are the heading and supporting line. Logos (add, upload, order, hide) are edited in this page's "client_logos" section, so there's one list only.</p>
        <CheckboxInput label="Show client logos here" checked={showLogos(obj)} onChange={(b) => write({ show_logos: b })} />
      </div>
      <div className={box}>
        <p className="text-eyebrow text-muted-foreground">Statistics</p>
        <p className="text-caption text-muted-foreground">Only approved figures. Nothing shows until you enter both a value and a label.</p>
        {stats.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-sm border border-border p-3 md:grid-cols-2">
            <div className="flex items-center justify-between md:col-span-2">
              <p className="text-small font-medium">{s.label || `Stat ${i + 1}`}</p>
              <div className="flex gap-1">
                <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => setStats(swap(stats, i, i - 1))}>Up</AdminButton>
                <AdminButton size="sm" variant="ghost" onClick={() => setStats(stats.filter((_, j) => j !== i))}>Remove</AdminButton>
              </div>
            </div>
            <TextInput label="Value" placeholder="e.g. 200+" value={s.value} onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <TextInput label="Label" placeholder="e.g. Projects completed" value={s.label} onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <CheckboxInput label="Visible" checked={s.enabled} onChange={(b) => setStats(stats.map((x, j) => (j === i ? { ...x, enabled: b } : x)))} />
          </div>
        ))}
        {stats.length < 6 && <AdminButton size="sm" variant="ghost" onClick={() => setStats([...stats, { value: "", label: "", enabled: true }])}>Add statistic</AdminButton>}
      </div>
      <div className={box}>
        <p className="text-eyebrow text-muted-foreground">Funded by</p>
        <CheckboxInput label="Visible" checked={fb.enabled} onChange={(b) => setFb({ enabled: b })} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Label" value={fb.label} onChange={(e) => setFb({ label: e.target.value })} />
          <TextInput label="Organisation name" value={fb.name} onChange={(e) => setFb({ name: e.target.value })} />
          <TextInput label="Official logo URL (https, optional)" value={fb.logo_url} onChange={(e) => setFb({ logo_url: e.target.value })} />
          <TextInput label="Website (https, optional)" value={fb.url} onChange={(e) => setFb({ url: e.target.value })} />
        </div>
        <TextArea label="Supporting line (optional)" value={fb.body} onChange={(e) => setFb({ body: e.target.value })} />
      </div>
    </>
  );
}
