import { supabase } from "@/integrations/supabase/client";

// These RPCs are newer than the generated types; keep untyped access in this one place.
const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const db = supabase as unknown as { from: (t: string) => any };

export type MyApplication = { id: string; job_title: string; job_slug: string; employment_type: string | null; submitted_at: string; status: string };
export type MyApplicationDetail = MyApplication & {
  full_name: string; email: string; phone: string; location: string | null; portfolio_url: string | null;
  linkedin_url: string | null; cover_note: string; has_resume: boolean; withdrawn_at: string | null;
};

/** Applicant-friendly wording for internal statuses. */
export const STATUS_LABEL: Record<string, string> = {
  new: "Submitted", reviewing: "Reviewing", shortlisted: "Shortlisted", interview: "Interview",
  offer: "Offer", hired: "Hired", rejected: "Not selected", withdrawn: "Withdrawn",
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? "Submitted";
export const canWithdraw = (s: string) => !["withdrawn", "hired", "rejected"].includes(s);

export async function fetchMyApplications() {
  const { data, error } = await rpc("my_applications");
  if (error) throw new Error("load failed");
  return (data ?? []) as MyApplication[];
}

export async function fetchMyApplication(id: string) {
  const { data, error } = await rpc("my_application", { _id: id });
  if (error) return null;
  return ((data as MyApplicationDetail[] | null) ?? [])[0] ?? null;
}

export async function withdrawMyApplication(id: string) {
  const { data, error } = await rpc("withdraw_my_application", { _id: id });
  return !error && data === true;
}

/** Known details used to prefill an application. */
export async function fetchApplyPrefill(userId: string) {
  const [{ data: p }, { data: a }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    db.from("applicant_profiles").select("current_location, portfolio_url, linkedin_url").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    full_name: p?.full_name ?? "", phone: p?.phone ?? "",
    location: (a?.current_location as string) ?? "", portfolio_url: (a?.portfolio_url as string) ?? "", linkedin_url: (a?.linkedin_url as string) ?? "",
  };
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
