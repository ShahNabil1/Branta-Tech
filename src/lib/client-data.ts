import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Client-safe reads: requests/bookings come from self-only database functions without internal fields. */
export const myRequestsQuery = queryOptions({
  queryKey: ["client", "requests"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_requests");
    if (error) throw error;
    return data ?? [];
  },
});
export const myBookingsQuery = queryOptions({
  queryKey: ["client", "bookings"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_bookings");
    if (error) throw error;
    return data ?? [];
  },
});
export const myFilesQuery = (userId: string) => queryOptions({
  queryKey: ["client", "files", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("client_files").select("id,title,description,file_name,file_size,created_at,storage_path").eq("client_user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export function formatWhen(iso: string, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}
export const formatDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
export const formatSize = (n: number | null) => (n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export async function openSignedFile(path: string) {
  const { data, error } = await supabase.storage.from("client-private").createSignedUrl(path, 60);
  if (error || !data) throw error ?? new Error("No link");
  window.open(data.signedUrl, "_blank", "noopener");
}
