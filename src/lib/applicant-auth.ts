import { supabase } from "@/integrations/supabase/client";

export const APPLICANT_HOME = "/careers/account";

/** Only same-origin /careers paths are allowed as applicant post-login destinations. */
export function safeCareersNext(v: unknown) {
  return typeof v === "string" && /^\/careers(\/[\w\-/?=&.%]*)?$/.test(v) && !/^\/careers\/(sign-|forgot-|reset-)/.test(v) ? v : APPLICANT_HOME;
}

/** Profile + applicant role for the caller only; the database refuses to touch staff accounts. */
export async function ensureApplicantProfile() {
  await (supabase.rpc as unknown as (fn: string) => Promise<unknown>)("ensure_applicant_profile");
}

export async function signInApplicantWithGoogle(next: string) {
  const redirectTo = `${window.location.origin}/careers/sign-in?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  return error ? "Google sign-in isn't available right now. Please use email instead." : null;
}

export async function myRoles(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}
