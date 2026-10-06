import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/brand-button";
import { QuoteRequestDialog } from "./QuoteRequestDialog";
import { Choice, Step } from "./PricingCalculator";
import { cn } from "@/lib/utils";

export const DEFAULT_DISCLAIMER = "This is an approximate estimate based on your selections. Final pricing will be confirmed after reviewing your requirements.";
export const BOOK_CTA = "Book a Call to Discuss Your Project";
export const QUOTE_CTA = "Request a Detailed Quote";

/** Book a Call link carrying the calculator configuration as a prefilled note. */
export function BookCallLink({ note, className }: { note: string; className?: string }) {
  return <Link to="/book-a-call" search={{ note: note.slice(0, 280) }} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full justify-center", className)}>{BOOK_CTA}</Link>;
}

type Field = { key: string; title: string; options: string[] } | { key: string; title: string; number: { min: number; max: number; step: number; unit: string; initial: number } };

const VIDEO: Field[] = [
  { key: "type", title: "Choose your video type.", options: ["AI Motion", "AI UGC", "AI Product Video", "AI Commercial", "AI OVC", "AI TVC", "Fashion / Cinematic"] },
  { key: "model", title: "Choose your AI model.", options: ["Google Budget / Omni Flash", "Kling", "Seedance Premium"] },
  { key: "duration", title: "Set your duration.", number: { min: 5, max: 180, step: 5, unit: "seconds", initial: 30 } },
];
const PHOTO: Field[] = [
  { key: "type", title: "Choose your photography type.", options: ["Basic Website Image", "E-commerce Photography", "Flat-lay Photography", "AI Model Photography", "Fashion Photography", "Lifestyle Photography", "Campaign Photography", "Premium Advertising Visuals"] },
  { key: "package", title: "Single images or a package?", options: ["Single images", "Basic Flat-lay", "Website Product Set", "Fashion Complete", "Premium Fashion"] },
  { key: "images", title: "Images per product.", number: { min: 1, max: 50, step: 1, unit: "images", initial: 4 } },
  { key: "products", title: "Number of products.", number: { min: 1, max: 500, step: 1, unit: "products", initial: 1 } },
];

/**
 * Interactive calculator shown while pricing isn't approved/published.
 * Uses option labels only — never any price, draft or otherwise.
 */
export function EstimatePreview({ category, disclaimer }: { category: "video" | "photography"; disclaimer: string }) {
  const fields = category === "video" ? VIDEO : PHOTO;
  const [vals, setVals] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(fields.map((f) => ["options" in f ? [f.key, f.options[0]!] : [f.key, f.number.initial]][0]!)));
  const [open, setOpen] = useState(false);
  const label = category === "video" ? "AI Video Production" : "AI Product Photography";
  const rows = fields.map((f) => [f.title.replace(/[.?]$/, "").replace(/^Choose your |^Set your /, ""), "number" in f ? `${vals[f.key]} ${f.number.unit}` : String(vals[f.key])] as const);
  const summary = `${label} · ${fields.map((f) => ("number" in f ? `${vals[f.key]} ${f.number.unit}` : vals[f.key])).join(" · ")}`;
  const panel = (
    <>
      <p className="text-eyebrow text-muted-foreground">YOUR ESTIMATED PROJECT COST</p>
      <dl className="text-small mt-4 space-y-2">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Service</dt><dd className="text-right text-foreground">{label}</dd></div>
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="capitalize text-muted-foreground">{k}</dt><dd className="text-right text-foreground">{v}</dd></div>)}
      </dl>
      <p className="text-h4 mt-6 text-foreground" role="status">Estimate unavailable until pricing is approved</p>
      <p className="text-caption mt-2 text-muted-foreground">Book a call or request a detailed quote and our team will price this configuration for you.</p>
      <div className="mt-5 grid gap-2">
        <BookCallLink note={summary} />
        <button type="button" onClick={() => setOpen(true)} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full justify-center")}>{QUOTE_CTA}</button>
      </div>
      <p className="text-caption mt-4 text-muted-foreground">{disclaimer || DEFAULT_DISCLAIMER}</p>
    </>
  );
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        {fields.map((f, i) => (
          <Step key={f.key} n={i + 1} title={f.title}>
            {"options" in f ? (
              <div role="radiogroup" aria-label={f.title} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {f.options.map((o) => <Choice key={o} title={o} selected={vals[f.key] === o} onClick={() => setVals((v) => ({ ...v, [f.key]: o }))} />)}
              </div>
            ) : (
              <label className="flex items-center gap-4">
                <input type="range" aria-label={f.title} min={f.number.min} max={f.number.max} step={f.number.step} value={Number(vals[f.key])} onChange={(e) => setVals((v) => ({ ...v, [f.key]: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" />
                <span className="text-small w-28 shrink-0 tabular-nums text-foreground">{vals[f.key]} {f.number.unit}</span>
              </label>
            )}
          </Step>
        ))}
      </div>
      <aside aria-label="Your estimate">
        <div className="dark rounded-[8px] border border-border bg-background p-6 text-foreground lg:sticky lg:top-24">{panel}</div>
      </aside>
      <QuoteRequestDialog open={open} onOpenChange={setOpen} selection={null} summary={null} category={category} summaryText={summary} />
    </div>
  );
}
