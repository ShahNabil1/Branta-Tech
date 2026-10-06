import { AdminButton, CheckboxInput, ConfirmButton, TextArea, TextInput } from "@/components/admin/cms";
import { parseContentItems, type PricingContentItem } from "@/lib/pricing-page";

/** Items editor for pricing_included / pricing_faq. Items show publicly only when "Approved" and the text is filled in. */
export function PricingContentFields({ type, config, onChange }: { type: string; config: string; onChange: (json: string) => void }) {
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(config || "{}"); } catch {
    return <p className="text-caption text-destructive md:col-span-2">Settings unavailable: advanced config is not valid JSON.</p>;
  }
  const items = parseContentItems(obj);
  const set = (n: PricingContentItem[]) => onChange(JSON.stringify({ ...obj, items: n }, null, 2));
  const upd = (i: number, p: Partial<PricingContentItem>) => set(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const swap = (i: number, j: number) => { const n = [...items]; [n[i], n[j]] = [n[j]!, n[i]!]; set(n); };
  const faq = type === "pricing_faq";
  return (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">{faq ? "FAQ entries" : "Included items"}</p>
      <p className="text-caption text-muted-foreground">Only items marked Approved with text filled in appear on the Pricing page. The section hides when none qualify.</p>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-sm border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-small font-medium">{it.title || `Item ${i + 1}`}</p>
            <div className="flex gap-1">
              <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => swap(i, i - 1)}>Up</AdminButton>
              <AdminButton size="sm" variant="ghost" disabled={i === items.length - 1} onClick={() => swap(i, i + 1)}>Down</AdminButton>
              <ConfirmButton title="Remove this item?" description="It will be removed when you save the section." confirmLabel="Remove" onConfirm={() => set(items.filter((_, j) => j !== i))}>Remove</ConfirmButton>
            </div>
          </div>
          <TextInput label={faq ? "Question" : "Heading"} value={it.title} onChange={(e) => upd(i, { title: e.target.value })} />
          <TextArea label={faq ? "Approved answer" : "Description"} value={it.body} onChange={(e) => upd(i, { body: e.target.value })} />
          <CheckboxInput label="Approved — show publicly" checked={it.enabled} onChange={(c) => upd(i, { enabled: c })} />
        </div>
      ))}
      <AdminButton onClick={() => set([...items, { title: "", body: "", enabled: false }])}>Add {faq ? "question" : "item"}</AdminButton>
    </div>
  );
}
