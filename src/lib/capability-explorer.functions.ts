import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { parseCapConfig, type CapSectionRow, type CapService } from "./capabilities";

type Result = { section: CapSectionRow | null; services: CapService[] };

/** Reads the visible Capability Explorer section on the published Home page plus linked published services (anon RLS). Never throws. */
export const getCapabilityExplorer = createServerFn({ method: "GET" }).handler(async (): Promise<Result> => {
  const empty: Result = { section: null, services: [] };
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return empty;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return empty;
    const { data } = await sb
      .from("page_sections")
      .select("eyebrow,title,body,config")
      .eq("page_id", page.data.id)
      .eq("section_type", "capability_explorer")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!data) return empty;
    const ids = [...new Set(parseCapConfig(data.config).items.flatMap((i) => i.service_ids))];
    let services: CapService[] = [];
    if (ids.length) {
      const r = await sb.from("services").select("id,name,slug").in("id", ids).eq("status", "published");
      services = r.data ?? [];
    }
    return { section: data as CapSectionRow, services };
  } catch {
    return empty;
  }
});

export const capabilityExplorerQuery = queryOptions({
  queryKey: ["public", "capability-explorer"],
  queryFn: () => getCapabilityExplorer(),
  staleTime: 5 * 60 * 1000,
});
