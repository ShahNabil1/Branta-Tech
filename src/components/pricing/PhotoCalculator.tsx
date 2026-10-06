import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/brand-button";
import { PricingError } from "@/lib/pricing/engine";
import { bulkTierFor, calculatePhotoQuote, type PhotoQuote } from "@/lib/pricing/photo-engine";
import type { PublicPhotoPricing } from "@/lib/pricing-photo.functions";
import { QuoteRequestDialog, type PhotoSelection } from "./QuoteRequestDialog";
import { Choice, money, Step, useTween } from "./PricingCalculator";
import { cn } from "@/lib/utils";
import { BreakdownLine, EstimateSummary } from "./EstimateSummary";
import { BookCallLink, DEFAULT_DISCLAIMER, EstimatePreview, QUOTE_CTA } from "./EstimatePreview";

const field = "text-small h-11 rounded-[10px] border border-border bg-[var(--white)] px-3 text-foreground outline-none focus:border-foreground";

export function PhotoCalculator({ data, disclaimer }: { data: PublicPhotoPricing; disclaimer: string }) {
  if (!data.active) return <EstimatePreview category="photography" disclaimer={disclaimer} />;
  return <Calc data={data} disclaimer={disclaimer} />;
}

function Calc({ data, disclaimer }: { data: Extract<PublicPhotoPricing, { active: true }>; disclaimer: string }) {
  const { config, descriptions: desc, examples } = data;
  const s = config.settings, cur = s.currency;
  const [mode, setMode] = useState<"package" | "individual">(config.packages.length ? "package" : "individual");
  const [pkg, setPkg] = useState(config.packages[0]?.id ?? "");
  const [cat, setCat] = useState(config.categories[0]?.id ?? "");
  const [workflow, setWorkflow] = useState(s.workflows[0]?.slug ?? "");
  const [products, setProducts] = useState(1);
  const [images, setImages] = useState(4);
  const [kind, setKind] = useState<"fashion" | "product">("fashion");
  const [viewIds, setViewIds] = useState<string[]>([]);
  const [background, setBackground] = useState(s.backgrounds[0] ?? "");
  const [modelRequired, setModelRequired] = useState(false);
  const [specs, setSpecs] = useState("");
  const [addons, setAddons] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const views = config.views.filter((v) => v.applies_to === "all" || v.applies_to === kind);
  const selection: PhotoSelection = {
    mode, workflow, products, background, modelRequired, ...(specs.trim() ? { specs: specs.trim() } : {}),
    addons: addons.map((id) => ({ id })),
    ...(mode === "package" ? { packageId: pkg } : { categoryId: cat, imagesPerProduct: images, viewIds: viewIds.filter((id) => views.some((v) => v.id === id)) }),
  };
  const result = useMemo((): { quote: PhotoQuote } | { error: string; custom?: boolean } => {
    try { return { quote: calculatePhotoQuote(config, selection, "public") }; }
    catch (e) { return { error: e instanceof PricingError ? e.message : "This combination can't be priced.", custom: e instanceof PricingError && e.code === "custom_quote_required" }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, JSON.stringify(selection)]);
  const q = "quote" in result ? result.quote : null;
  const shown = useTween(q?.total ?? 0);
  const nextTier = config.bulkTiers.find((t) => t.min_products > products && (t.discount_percentage ?? 0) > 0);
  const tier = bulkTierFor(config.bulkTiers, products);

  const Line = BreakdownLine;
  const breakdown = q && (
    <div>
      <Line l={q.mode === "package" ? `${q.item.name} · ${money(q.unitPrice, cur)} × ${q.products}` : `${q.item.name} · ${money(q.unitPrice, cur)} × ${q.totalImages} images`} v={money(q.baseAmount, cur)} />
      <Line l={`${q.totalImages} images total · ${q.workflow.name}`} v="" />
      {q.bulk && <Line l={`Bulk discount (${q.bulk.percentage}%)`} v={`− ${money(q.bulk.amount, cur)}`} tone="discount" />}
      {q.addonLines.map((l) => <Line key={l.addonId} l={l.name + (l.chargeType === "percentage" ? ` (${l.quantity}%)` : l.quantity > 1 ? ` × ${l.quantity}` : "")} v={money(l.amount, cur)} />)}
      {q.minimumAdjustment > 0 && <Line l="Minimum order adjustment" v={`+ ${money(q.minimumAdjustment, cur)}`} />}
      {q.roundingAdjustment > 0 && <Line l="Rounding" v={`+ ${money(q.roundingAdjustment, cur)}`} />}
      {q.tax && <Line l={`${q.tax.label} ${q.tax.percentage}%${q.tax.inclusive ? " (included)" : ""}`} v={money(q.tax.amount, cur)} />}
    </div>
  );
  const canRequest = !!q || ("custom" in result && !!result.custom);
  const summaryText = q ? `${q.item.name} · ${q.products} product${q.products > 1 ? "s" : ""} · ${q.totalImages} images · ${q.workflow.name}` : `Custom photography · ${products} products`;
  const actions = (
    <div className="grid gap-2">
      <BookCallLink note={`AI Product Photography · ${summaryText}${q ? ` · est. ${money(q.total, cur)}` : ""}`} intent="photography" kind={q?.item.name} />
      <button type="button" disabled={!canRequest} onClick={() => setOpen(true)} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full justify-center disabled:pointer-events-none disabled:opacity-50")}>{QUOTE_CTA}</button>
    </div>
  );
  let n = 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-8 xl:gap-10">
      <div className="min-w-0 rounded-[20px] border border-border bg-[var(--white)] p-5 pb-24 sm:p-7 md:p-8 lg:pb-8">
        <h3 className="text-h3 mb-8 text-foreground">Customize Your Product Photography</h3>
        <Step n={++n} title="How would you like to order?">
          <div role="radiogroup" aria-label="Order type" className="grid gap-3 sm:grid-cols-2">
            {config.packages.length > 0 && <Choice selected={mode === "package"} onClick={() => setMode("package")} title="Product photoshoot package" desc="A fixed set of views per product." />}
            {config.categories.length > 0 && <Choice selected={mode === "individual"} onClick={() => setMode("individual")} title="Individual images" desc="Choose a category and how many images you need." />}
          </div>
        </Step>
        {mode === "package" ? (
          <Step n={++n} title="Choose your package.">
            <div role="radiogroup" aria-label="Package" className="grid gap-3 sm:grid-cols-2">
              {config.packages.map((p) => {
                const pv = p.view_ids.map((id) => config.views.find((v) => v.id === id)?.name).filter(Boolean);
                const on = pkg === p.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPkg(p.id)}
                    className={cn("flex flex-col overflow-hidden rounded-[12px] border text-left transition-[border-color,box-shadow,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", on ? "border-accent bg-accent/[0.04] shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-[var(--white)] hover:border-foreground/30")}>
                    {examples[p.id] && <img src={examples[p.id]} alt={`${p.name} example`} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                    <span className="flex flex-1 flex-col p-4">
                      <span className="flex items-baseline justify-between gap-3"><span className="text-body font-medium text-foreground">{p.name}</span><span className="text-small tabular-nums text-foreground">{money(Math.round((p.price_per_product ?? 0) * 100), cur)}</span></span>
                      <span className="text-caption mt-1 text-muted-foreground">{p.image_count} images · per product</span>
                      {pv.length > 0 && <span className="text-caption mt-3 text-muted-foreground">{pv.join(" · ")}</span>}
                      {desc[p.id] && <span className="text-caption mt-2 text-muted-foreground">{desc[p.id]}</span>}
                      <span className={cn("text-small mt-4 font-medium", on ? "text-accent" : "text-foreground")}>{on ? "Selected" : "Select package"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>
        ) : (
          <>
            <Step n={++n} title="Choose a photography category.">
              <div role="radiogroup" aria-label="Photography category" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {config.categories.map((c) => <Choice key={c.id} selected={cat === c.id} onClick={() => setCat(c.id)} title={c.name} meta={`${money(Math.round((c.price_per_image ?? 0) * 100), cur)} / image`} desc={desc[c.id]} />)}
              </div>
            </Step>
            <Step n={++n} title="Which views do you need?">
              <div role="radiogroup" aria-label="Product type" className="mb-4 flex flex-wrap gap-2">
                {(["fashion", "product"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                  className={cn("text-small h-10 rounded-full border px-4 transition-colors", kind === k ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-foreground/40")}>{k === "fashion" ? "Fashion / apparel" : "Other products"}</button>)}
              </div>
              <div className="flex flex-wrap gap-2">
                {views.map((v) => { const on = viewIds.includes(v.id); return (
                  <button key={v.id} type="button" aria-pressed={on} onClick={() => setViewIds((x) => (on ? x.filter((i) => i !== v.id) : [...x, v.id]))}
                    className={cn("text-small h-10 rounded-full border px-4 transition-colors", on ? "border-accent bg-accent/10 text-foreground" : "border-border bg-[var(--white)] hover:border-foreground/40")}>{v.name}</button>); })}
              </div>
              <label className="text-small mt-5 flex items-center gap-3 text-muted-foreground">Images per product
                <input type="number" inputMode="numeric" min={1} max={s.max_images_per_product} value={images}
                  onChange={(e) => setImages(Math.max(1, Math.min(s.max_images_per_product, Math.floor(Number(e.target.value) || 1))))} className={cn(field, "w-20 text-right tabular-nums")} />
              </label>
            </Step>
          </>
        )}
        <Step n={++n} title="Preferred image workflow.">
          <div role="radiogroup" aria-label="Image workflow" className="grid gap-3 sm:grid-cols-2">
            {s.workflows.map((w) => <Choice key={w.slug} selected={workflow === w.slug} onClick={() => setWorkflow(w.slug)} title={w.name} meta="Same price" />)}
          </div>
          <p className="text-caption mt-3 text-muted-foreground">Your workflow choice is a production preference — it doesn't change the price.</p>
        </Step>
        <Step n={++n} title="How many products?">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" aria-label="Fewer products" onClick={() => setProducts((p) => Math.max(1, p - 1))} className={cn(field, "w-11")}>−</button>
            <input type="number" inputMode="numeric" aria-label="Products" min={1} max={s.max_products} value={products}
              onChange={(e) => setProducts(Math.max(1, Math.min(s.max_products, Math.floor(Number(e.target.value) || 1))))} className={cn(field, "w-24 text-center tabular-nums")} />
            <button type="button" aria-label="More products" onClick={() => setProducts((p) => Math.min(s.max_products, p + 1))} className={cn(field, "w-11")}>+</button>
          </div>
          <p className="text-caption mt-3 text-muted-foreground">
            {tier?.discount_percentage ? `${tier.discount_percentage}% bulk discount applied. ` : ""}
            {nextTier ? `Order ${nextTier.min_products}+ products for ${nextTier.discount_percentage}% off.` : ""}
          </p>
        </Step>
        <Step n={++n} title="Styling preferences.">
          <div className="grid gap-4 sm:grid-cols-2">
            {s.backgrounds.length > 0 && (
              <label className="text-small block text-muted-foreground">Background
                <select value={background} onChange={(e) => setBackground(e.target.value)} className={cn(field, "mt-1.5 w-full")}>{s.backgrounds.map((b) => <option key={b}>{b}</option>)}</select>
              </label>
            )}
            <label className="text-small flex min-h-11 items-center gap-3 self-end text-foreground">
              <input type="checkbox" checked={modelRequired} onChange={(e) => setModelRequired(e.target.checked)} className="size-5 accent-[var(--accent)]" />AI model required
            </label>
          </div>
          <label className="text-small mt-4 block text-muted-foreground">Product specifications (optional)
            <textarea rows={2} maxLength={1000} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="Product type, colours, sizes, materials…" className={cn(field, "mt-1.5 h-auto w-full py-2")} />
          </label>
        </Step>
        {config.addons.length > 0 && (
          <Step n={++n} title="Optional extras.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {config.addons.map((a) => (
                <li key={a.id} className={cn("rounded-[12px] border px-4 py-3 transition-colors", addons.includes(a.id) ? "border-accent bg-accent/[0.04]" : "border-border bg-[var(--white)] hover:border-foreground/30")}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={addons.includes(a.id)} className="size-5 accent-[var(--accent)]"
                      onChange={(e) => setAddons((x) => (e.target.checked ? [...x, a.id] : x.filter((i) => i !== a.id)))} />
                    <span className="min-w-0 flex-1"><span className="text-small block font-medium text-foreground">{a.name}</span>{desc[a.id] && <span className="text-caption block text-muted-foreground">{desc[a.id]}</span>}</span>
                    <span className="text-caption shrink-0 tabular-nums text-muted-foreground">{a.charge_type === "percentage" ? `+${a.percentage}%` : `${money(Math.round((a.amount ?? 0) * 100), cur)}${a.charge_type === "per_product" ? " / product" : a.charge_type === "per_image" ? " / image" : ""}`}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Step>
        )}
      </div>

      <QuoteRequestDialog open={open} onOpenChange={setOpen} selection={null} summary={null} category="photography" photoSelection={selection} summaryText={summaryText} />

      <EstimateSummary
        thumb={q && q.mode === "package" ? examples[pkg] : null}
        rows={q ? [["Service", q.mode === "package" ? "Photoshoot package" : q.item.name], [q.mode === "package" ? "Package" : "Images", q.mode === "package" ? q.item.name : `${q.totalImages} images`], ["Products", String(q.products)], ["Workflow", q.workflow.name], ...(q.addonLines.length ? [["Extras", q.addonLines.map((l) => l.name).join(", ")] as const] : [])] : [["Service", "AI Product Photography"], ["Products", String(products)]]}
        total={q ? money(shown, cur) : null} error={"error" in result ? result.error : null}
        breakdown={breakdown} actions={actions} disclaimer={disclaimer} />
    </div>
  );
}
