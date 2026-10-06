import { quoteStatusLabel } from "@/lib/pricing/quotes-admin";
import { cn } from "@/lib/utils";

export function StatusChip({ s }: { s: string }) {
  const tone = s === "accepted" ? "border-accent bg-accent text-accent-foreground" : ["new", "custom_quote_requested"].includes(s) ? "border-accent/40 bg-accent/10 text-foreground"
    : ["declined", "expired", "cancelled"].includes(s) ? "border-border text-muted-foreground" : "border-border bg-muted text-foreground";
  return <span className={cn("text-caption inline-flex whitespace-nowrap rounded-sm border px-2 py-0.5 font-medium transition-colors", tone)}>{quoteStatusLabel(s)}</span>;
}

