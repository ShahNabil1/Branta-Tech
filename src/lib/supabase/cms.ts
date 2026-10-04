import { supabase } from "@/integrations/supabase/client";

/** Shared meta for Control Centre routes (always noindex). */
export function adminHead(title: string) {
  const t = `${title} — Branta Control Centre`;
  const d = `${title} in the Branta Control Centre.`;
  return {
    meta: [
      { title: t },
      { name: "description", content: d },
      { property: "og:title", content: t },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
}

export async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

export const MEDIA_BUCKET = "site-public";

export function publicUrl(path: string) {
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Reads one site_settings group's JSON object. */
export async function getSettingsGroup<T = Record<string, unknown>>(group: string): Promise<T | null> {
  const row = await must(
    supabase.from("site_settings").select("settings").eq("setting_group", group).maybeSingle(),
  );
  return (row?.settings as T) ?? null;
}

export async function saveSettingsGroup(group: string, settings: unknown) {
  await must(
    supabase
      .from("site_settings")
      .upsert({ setting_group: group, settings: settings as never }, { onConflict: "setting_group" })
      .select("id"),
  );
}
