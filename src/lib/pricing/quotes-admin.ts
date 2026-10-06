import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type QuoteRow = Tables<"pricing_quote_requests">;
export type QuoteVersionRow = Tables<"pricing_quote_versions">;

export const QUOTE_STATUSES = [
  ["custom_quote_requested", "Custom request"], ["new", "New"], ["reviewing", "Reviewing"], ["more_info_needed", "More info needed"],
  ["quoted", "Quoted"], ["accepted", "Accepted"], ["declined", "Declined"], ["expired", "Expired"], ["cancelled", "Cancelled"],
] as const;
export const quoteStatusLabel = (s: string) => QUOTE_STATUSES.find(([k]) => k === s)?.[1] ?? s;
/** Statuses staff may set by hand. Accepted/declined come from the customer link (or are recorded manually with a note). */
export const STAFF_STATUSES = QUOTE_STATUSES.map(([k]) => k);

export const money = (minor: number | null | undefined, cur = "BDT") =>
  minor == null ? "—" : `${cur === "BDT" ? "৳" : `${cur} `}${(Number(minor) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export async function logQuoteActivity(quoteId: string, kind: string, detail: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("pricing_quote_activity").insert({ quote_id: quoteId, kind, detail: detail as never, actor_type: "staff", actor_user_id: data.user?.id ?? null });
}
