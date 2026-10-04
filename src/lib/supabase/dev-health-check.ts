import { getSupabaseConfigStatus } from "./config";

/**
 * Development-only connection check. Logs to the browser console; renders nothing.
 * Uses the public Auth health endpoint, so no tables are required.
 */
export async function runSupabaseDevHealthCheck() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  const status = getSupabaseConfigStatus();
  if (!status.ok) {
    console.error(`[Supabase] Configuration problem:\n- ${status.problems.join("\n- ")}`);
    return;
  }

  try {
    const res = await fetch(`${status.url}/auth/v1/health`, {
      headers: { apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string },
    });
    if (res.ok) console.info(`[Supabase] Connected to ${status.host} (auth health OK)`);
    else console.warn(`[Supabase] ${status.host} responded with status ${res.status}`);
  } catch {
    console.warn(`[Supabase] Could not reach ${status.host}`);
  }
}
