import { statusLabel } from "@/lib/applicant-data";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: string }) {
  const tone = ["shortlisted", "interview", "offer", "hired"].includes(status)
    ? "border-accent/40 text-accent"
    : status === "withdrawn" || status === "rejected" ? "border-border text-muted-foreground" : "border-border text-foreground";
  return <span className={cn("text-caption shrink-0 rounded-full border px-2.5 py-1", tone)}>{statusLabel(status)}</span>;
}
