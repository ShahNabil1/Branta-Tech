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
  new: "Submitted", reviewing: "Under Review", shortlisted: "Shortlisted", interview: "Interview Scheduled", assignment: "Assignment", selected: "Selected",
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
    db.from("applicant_profiles").select("current_location, portfolio_url, linkedin_url, github_url, behance_url, website_url").eq("user_id", userId).maybeSingle(),
  ]);
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    full_name: p?.full_name ?? "", phone: p?.phone ?? "",
    location: s(a?.current_location), portfolio_url: s(a?.portfolio_url), linkedin_url: s(a?.linkedin_url),
    github_url: s(a?.github_url), behance_url: s(a?.behance_url), website_url: s(a?.website_url),
  };
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export type MyInterview = {
  id: string; application_id: string; job_title: string; scheduled_at: string; timezone: string;
  interview_type: string; meeting_url: string | null; location: string | null; public_notes: string | null; status: string;
};
export const INTERVIEW_TYPE_LABEL: Record<string, string> = { video: "Video call", phone: "Phone call", in_person: "In person" };
export const INTERVIEW_STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", rescheduled: "Rescheduled", completed: "Completed", cancelled: "Cancelled" };

export async function fetchMyInterviews() {
  const { data, error } = await rpc("my_interviews");
  if (error) throw new Error("load failed");
  return (data ?? []) as MyInterview[];
}
export const isUpcoming = (i: MyInterview) => i.status !== "cancelled" && i.status !== "completed" && new Date(i.scheduled_at).getTime() > Date.now() - 2 * 3600_000;

/** Date + time shown in the interview's own timezone. */
export function fmtInterview(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(new Date(iso));
  } catch { return new Date(iso).toLocaleString("en-GB"); }
}

/** Share of useful application fields filled in (no weighting, no gating). */
export async function fetchProfileCompleteness(userId: string, hasResume: boolean) {
  const [{ data: p }, { data: a }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    db.from("applicant_profiles").select("current_location, institute, linkedin_url, portfolio_url").eq("user_id", userId).maybeSingle(),
  ]);
  const checks: [string, boolean][] = [
    ["Full name", !!p?.full_name], ["Phone", !!p?.phone], ["Location", !!a?.current_location], ["University / institute", !!a?.institute],
    ["LinkedIn or portfolio link", !!(a?.linkedin_url || a?.portfolio_url)], ["Resume", hasResume],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([k]) => k) };
}
