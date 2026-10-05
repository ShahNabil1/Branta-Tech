import { AdminButton, CheckboxInput, ConfirmButton, SelectInput, TextArea, TextInput } from "@/components/admin/cms";
import { asObj, secondaryCta } from "@/lib/home-closing";
import { PRICE_TYPES, newPlan, parsePlans, parseSnapshotItems, type PricingPlan, type SnapshotItem } from "@/lib/home-engage";

type Props = { type: string; config: string; onChange: (json: string) => void };
const swap = <T,>(a: T[], i: number, j: number) => { const n = [...a]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; };

/** Fields for services_snapshot, pricing and book_call_cta. Eyebrow/title/body/CTA use the standard fields above. */
export function HomeEngageFields({ type, config, onChange }: Props) {
  let obj: Record<string, unknown>;
  try { obj = asObj(JSON.parse(config || "{}")); } catch {
    return <p className="text-caption text-destructive md:col-span-2">Settings unavailable: advanced config is not valid JSON.</p>;
  }
  const write = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...obj, ...patch }, null, 2));
  const box = (title: string, children: React.ReactNode) => (
    <div className="grid gap-4 rounded-sm border border-border p-4 md:col-span-2">
      <p className="text-eyebrow text-muted-foreground">{title}</p>{children}
    </div>
  );
  const moveBtns = (i: number, len: number, mv: (j: number) => void) => (<>
    <AdminButton size="sm" variant="ghost" disabled={i === 0} onClick={() => mv(i - 1)}>Up</AdminButton>
    <AdminButton size="sm" variant="ghost" disabled={i === len - 1} onClick={() => mv(i + 1)}>Down</AdminButton>
  </>);

  if (type === "services_snapshot") {
    const items = parseSnapshotItems(obj);
    const set = (n: SnapshotItem[]) => write({ items: n });
    const upd = (i: number, p: Partial<SnapshotItem>) => set(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
    return box("Services", <>
      <p className="text-caption text-muted-foreground">Title supports line breaks. The service slug links to /services/&lt;slug&gt; when that service or group is published; an empty description uses the service's short description.</p>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-sm border border-border p-3 md:grid-cols-2">
          <div className="flex items-center justify-between md:col-span-2">
            <p className="text-small font-medium">{it.label || `Service ${i + 1}`}</p>
            <div className="flex gap-1">
              {moveBtns(i, items.length, (j) => set(swap(items, i, j)))}
              <ConfirmButton title="Remove this service item?" description="Only removes it from this homepage section. The service itself is not affected." confirmLabel="Remove" onConfirm={() => set(items.filter((_, j) => j !== i))}>Remove</ConfirmButton>
            </div>
          </div>
          <TextInput label="Name" value={it.label} onChange={(e) => upd(i, { label: e.target.value })} />
          <TextInput label="Service slug" value={it.slug} placeholder="ai-commercial" onChange={(e) => upd(i, { slug: e.target.value })} />
          <TextInput className="md:col-span-2" label="Short description" value={it.description} onChange={(e) => upd(i, { description: e.target.value })} />
          <CheckboxInput label="Visible on website" checked={it.enabled} onChange={(b) => upd(i, { enabled: b })} />
        </div>
      ))}
      <AdminButton size="sm" variant="ghost" onClick={() => set([...items, { label: "", description: "", slug: "", enabled: true }])}>Add service</AdminButton>
    </>);
  }

  if (type === "pricing") {
    const plans = parsePlans(obj);
    const set = (n: PricingPlan[]) => write({ plans: n });
    const upd = (i: number, p: Partial<PricingPlan>) => set(plans.map((x, j) => (j === i ? { ...x, ...p } : x)));
    return box("Pricing plans", <>
      <p className="text-caption text-muted-foreground">Prices are never invented: an empty price shows "Custom Quote". Currency is a prefix such as "$" or "BDT ".</p>
      {plans.map((p, i) => {
        const needsPrice = !["custom", "contact"].includes(p.price_type);
        return (
          <div key={p.id} className="grid gap-2 rounded-sm border border-border p-3 md:grid-cols-2">
            <div className="flex items-center justify-between md:col-span-2">
              <p className="text-small font-medium">{p.name || `Plan ${i + 1}`}{p.highlighted ? " · highlighted" : ""}</p>
              <div className="flex gap-1">
                {moveBtns(i, plans.length, (j) => set(swap(plans, i, j)))}
                <ConfirmButton title="Delete this plan?" description="It is removed from the homepage after you save this section." confirmLabel="Delete" onConfirm={() => set(plans.filter((_, j) => j !== i))}>Delete</ConfirmButton>
              </div>
            </div>
            <TextInput label="Plan name" value={p.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <TextInput label="Badge (optional)" value={p.badge} placeholder="MOST POPULAR" onChange={(e) => upd(i, { badge: e.target.value })} />
            <TextInput className="md:col-span-2" label="Description" value={p.tagline} onChange={(e) => upd(i, { tagline: e.target.value })} />
            <SelectInput label="Pricing type" value={p.price_type} options={PRICE_TYPES.map(([value, label]) => ({ value, label }))} onChange={(e) => upd(i, { price_type: e.target.value as PricingPlan["price_type"] })} />
            {needsPrice && <TextInput label="Currency prefix" value={p.currency} onChange={(e) => upd(i, { currency: e.target.value })} />}
            {needsPrice && <TextInput label={p.price_type === "range" ? "Lowest price" : "Price"} value={p.price} placeholder="e.g. 499" onChange={(e) => upd(i, { price: e.target.value })} />}
            {p.price_type === "range" && <TextInput label="Highest price" value={p.price_max} onChange={(e) => upd(i, { price_max: e.target.value })} />}
            <TextArea className="md:col-span-2" label="Features (one per line)" rows={5} value={p.features.join("\n")}
              onChange={(e) => upd(i, { features: e.target.value.split("\n").map((s) => s.slice(0, 120)) })} />
            <TextInput label="Button label" value={p.cta_label} onChange={(e) => upd(i, { cta_label: e.target.value })} />
            <TextInput label="Button URL" value={p.cta_url} placeholder="/book-a-call" onChange={(e) => upd(i, { cta_url: e.target.value })} />
            <CheckboxInput label="Highlight this plan" checked={p.highlighted} onChange={(b) => upd(i, { highlighted: b })} />
            <CheckboxInput label="Visible on website" checked={p.enabled} onChange={(b) => upd(i, { enabled: b })} />
          </div>
        );
      })}
      {plans.length < 6 && <AdminButton size="sm" variant="ghost" onClick={() => set([...plans, newPlan()])}>Add plan</AdminButton>}
    </>);
  }

  if (type === "book_call_cta") {
    const s = secondaryCta(obj);
    return box("Book a Call call-to-action", <>
      <p className="text-caption text-muted-foreground">CTA label/URL above are the primary button. Title supports line breaks.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Secondary button label" value={s.label} onChange={(e) => write({ secondary_cta_label: e.target.value })} />
        <TextInput label="Secondary button URL" value={s.url} placeholder="/start-a-project" onChange={(e) => write({ secondary_cta_url: e.target.value })} />
      </div>
    </>);
  }
  return null;
}
