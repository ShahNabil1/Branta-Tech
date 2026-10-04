/** Shared, browser-safe options for Start a Project / Book a Call. */
export const SERVICE_OPTIONS = [
  "AI Commercial / Video", "AI Photography", "Branding / Creative", "UI/UX", "Website", "E-commerce", "Software", "AI Automation", "Something Else",
] as const;
export const BUDGET_OPTIONS = ["Not sure yet", "Have a budget in mind"] as const;
export const TIMELINE_OPTIONS = ["As soon as possible", "Within 1 month", "1–3 months", "3+ months", "Flexible"] as const;
export const ATTACH_MAX = 10 * 1024 * 1024;
export const ATTACH_ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx";

export const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost", "archived"] as const;
export const BOOKING_STATUSES = ["requested", "confirmed", "reschedule_requested", "completed", "cancelled", "no_show"] as const;
export const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Client-facing wording; never exposes internal sales detail. */
export function clientStatusLabel(s: string) {
  const map: Record<string, string> = { new: "Received", contacted: "In conversation", qualified: "In conversation", proposal: "Proposal", won: "Accepted", lost: "Closed", archived: "Closed" };
  return map[s] ?? statusLabel(s);
}
