import { AdminButton, SelectInput, TextInput } from "@/components/admin/cms";
import { MAX_NODES, NODE_KINDS, parseAutomationConfig, type UseCase } from "@/lib/automation";

/** Editor for the AI Automation showcase config: use cases, ordered workflow nodes, outcomes, default tab. */
export function AutomationFields({ config, onChange }: { config: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown>;
  try {
    const p = JSON.parse(config || "{}");
    obj = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return <p className="text-caption text-destructive md:col-span-2">Automation settings unavailable: advanced config is not valid JSON.</p>;
  }
  // Keep raw use cases (incl. incomplete ones being typed) so editing isn't lossy.
  const raw = (Array.isArray(obj["use_cases"]) ? obj["use_cases"] : []) as UseCase[];
  const cases: UseCase[] = raw.map((u, i) => ({
    key: u?.key || `case-${i + 1}`, label: u?.label ?? "", description: u?.description ?? "", outcome: u?.outcome ?? "",
    nodes: Array.isArray(u?.nodes) ? u.nodes.map((n) => ({ label: n?.label ?? "", kind: n?.kind ?? "system" })) : [],
  }));
  const parsed = parseAutomationConfig(obj);
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const setCases = (next: UseCase[]) => write({ use_cases: next });
  const upd = (i: number, patch: Partial<UseCase>) => setCases(cases.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const outcomes = Array.isArray(obj["outcomes"]) ? (obj["outcomes"] as string[]) : [];

  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">AI Automation showcase</p>
      <p className="text-caption text-muted-foreground">Eyebrow, Title, Body and the button above are the intro. Use cases need a label and at least 2 steps to appear (max 4 use cases, {MAX_NODES} steps each).</p>
      <SelectInput label="Default use case" value={parsed.default_key} onChange={(e) => write({ default_key: e.target.value })}
        options={cases.map((c) => ({ value: c.key, label: c.label || c.key }))} />
      <TextInput label="Outcome labels" hint="Separate with commas. No percentages or invented numbers." value={outcomes.join(", ")}
        onChange={(e) => write({ outcomes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />

      {cases.map((c, i) => (
        <div key={i} className="grid gap-3 rounded-sm border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-small font-medium">Use case {i + 1}</p>
            <div className="flex gap-1">
              <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => { const n = [...cases]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; setCases(n); }}>Up</AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => setCases(cases.filter((_, j) => j !== i))}>Remove</AdminButton>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="Label" value={c.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <TextInput label="Key" hint="Lowercase id, e.g. sales." value={c.key} onChange={(e) => upd(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          </div>
          <TextInput label="Supporting copy" value={c.description} onChange={(e) => upd(i, { description: e.target.value })} />
          <TextInput label="Outcome" value={c.outcome} onChange={(e) => upd(i, { outcome: e.target.value })} />
          <p className="text-caption text-muted-foreground">Workflow steps (in order — each step connects to the next)</p>
          {c.nodes.map((n, k) => (
            <div key={k} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
              <TextInput label={`Step ${k + 1}`} value={n.label} onChange={(e) => upd(i, { nodes: c.nodes.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} />
              <SelectInput label="Type" value={n.kind} onChange={(e) => upd(i, { nodes: c.nodes.map((x, m) => (m === k ? { ...x, kind: e.target.value as typeof n.kind } : x)) })}
                options={NODE_KINDS.map((v) => ({ value: v, label: v }))} />
              <div className="flex gap-1 pb-1">
                <AdminButton size="sm" variant="ghost" disabled={k === 0} onClick={() => { const ns = [...c.nodes]; [ns[k - 1], ns[k]] = [ns[k]!, ns[k - 1]!]; upd(i, { nodes: ns }); }}>Up</AdminButton>
                <AdminButton size="sm" variant="ghost" onClick={() => upd(i, { nodes: c.nodes.filter((_, m) => m !== k) })}>×</AdminButton>
              </div>
            </div>
          ))}
          {c.nodes.length < MAX_NODES && (
            <AdminButton size="sm" variant="ghost" onClick={() => upd(i, { nodes: [...c.nodes, { label: "", kind: "system" }] })}>Add step</AdminButton>
          )}
        </div>
      ))}
      {cases.length < 4 && (
        <AdminButton size="sm" variant="ghost" onClick={() => setCases([...cases, { key: `case-${cases.length + 1}`, label: "", description: "", outcome: "", nodes: [] }])}>Add use case</AdminButton>
      )}
    </div>
  );
}
