import { useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_DISCLAIMER } from "./EstimatePreview";

export type SummaryRow = readonly [label: string, value: string];

/** Itemized breakdown row used inside the grey breakdown block. */
export function BreakdownLine({ l, v, tone }: { l: string; v: string; tone?: "discount" | "muted" }) {
  return (
    <div className="text-small flex justify-between gap-4 py-1.5">
      <span className="text-muted-foreground">{l}</span>
      <span className={cn("text-right tabular-nums", tone === "discount" ? "text-accent" : tone === "muted" ? "text-muted-foreground" : "text-foreground")}>{v}</span>
    </div>
  );
}

type Props = {
  rows: SummaryRow[]; thumb?: string | null | undefined; total: string | null;
  error?: string | null | undefined; breakdown: ReactNode; actions: ReactNode; disclaimer: string;
};

function Body({ rows, thumb, total, error, breakdown, actions, disclaimer }: Props) {
  return (
    <>
      <div className="flex items-center gap-3">
        {thumb ? <img src={thumb} alt="" className="size-12 shrink-0 rounded-[10px] object-cover" loading="lazy" /> : <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-muted"><span className="size-2 rounded-full bg-accent" /></span>}
        <div className="min-w-0">
          <p className="text-h4 font-medium text-foreground">Estimate Summary</p>
          <p className="text-caption text-muted-foreground">Updates as you configure</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-caption text-muted-foreground">{k}</dt>
            <dd className="text-small mt-0.5 truncate font-medium text-foreground" title={v}>{v}</dd>
          </div>
        ))}
      </dl>
      {breakdown && <div className="mt-6 rounded-[14px] bg-muted px-4 py-3">{breakdown}</div>}
      <div className="mt-6 border-t border-dashed border-border pt-5">
        <p className="text-caption text-muted-foreground">Your Estimated Project Cost</p>
        {total ? (
          <>
            <p className="text-display mt-1 tabular-nums text-accent" aria-live="polite">{total}</p>
            <p className="text-caption mt-2 text-muted-foreground">Based on your selections. Final pricing may vary depending on project requirements.</p>
          </>
        ) : (
          <>
            <p className="text-h3 mt-1 text-foreground" role="status">Custom Estimate Required</p>
            {error && <p className="text-small mt-2 text-muted-foreground">{error}</p>}
          </>
        )}
      </div>
      <div className="mt-6">{actions}</div>
      <p className="text-caption mt-4 text-muted-foreground">{disclaimer || DEFAULT_DISCLAIMER}</p>
    </>
  );
}

/** Sticky desktop summary + compact mobile bar with expandable breakdown. */
export function EstimateSummary(props: Props) {
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <aside aria-label="Estimate summary" className="hidden lg:block">
        <div className="sticky top-24 rounded-[20px] border border-border bg-[var(--white)] p-6 shadow-[0_24px_60px_-30px_color-mix(in_oklab,var(--foreground)_25%,transparent)] xl:p-7">
          <Body {...props} />
        </div>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--white)] text-foreground shadow-[0_-12px_40px_-20px_color-mix(in_oklab,var(--foreground)_30%,transparent)] lg:hidden">
        {sheet && (
          <div className="max-h-[65vh] overflow-y-auto border-b border-border px-[var(--gutter)] py-5">
            <Body {...props} />
          </div>
        )}
        <button type="button" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} className="flex w-full items-center justify-between gap-3 px-[var(--gutter)] py-3">
          <span className="text-left">
            <span className="text-caption block text-muted-foreground">Your Estimated Project Cost</span>
            <span className={cn("text-h4 block tabular-nums", props.total ? "text-accent" : "text-foreground")}>{props.total ?? "Custom estimate"}</span>
          </span>
          <span className="text-small flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-foreground">{sheet ? "Hide" : "Breakdown"}<ChevronUp className={cn("size-4 transition-transform", !sheet && "rotate-180")} /></span>
        </button>
      </div>
    </>
  );
}
