import { supabase } from "@/integrations/supabase/client";

/** Google via Supabase Auth; returns to the public sign-in page, which forwards once the session exists. */
export async function signInWithGoogle(next: string) {
  const redirectTo = `${window.location.origin}/sign-in?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  return error ? "Google sign-in isn't available right now. Please use email instead." : null;
}

/** Makes sure the profile exists and the account has the client role if it has no role (database decides). */
export async function ensureClientProfile() {
  await supabase.rpc("ensure_client_profile");
}
