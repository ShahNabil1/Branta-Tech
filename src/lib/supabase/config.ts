/**
 * Browser-safe Supabase configuration check.
 * Reads only public values (project URL + publishable/anon key). Never logs key values.
 */
export type SupabaseConfigStatus =
  | { ok: true; url: string; host: string }
  | { ok: false; problems: string[] };

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  const problems: string[] = [];

  if (!url) problems.push("VITE_SUPABASE_URL is missing");
  if (!key) problems.push("VITE_SUPABASE_PUBLISHABLE_KEY is missing");
  if (key?.startsWith("sb_secret_")) problems.push("A secret key is configured as the public key — replace it immediately");

  let host = "";
  if (url) {
    try {
      const parsed = new URL(url);
      host = parsed.host;
      if (parsed.protocol !== "https:") problems.push("VITE_SUPABASE_URL must use https");
    } catch {
      problems.push("VITE_SUPABASE_URL is not a valid URL");
    }
  }

  return problems.length ? { ok: false, problems } : { ok: true, url: url!, host };
}
