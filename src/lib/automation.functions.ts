import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { parseAutomationConfig, type AutomationConfig } from "./automation";

export type Automation = (AutomationConfig & { eyebrow: string; title: string; body: string; ctaLabel: string; ctaUrl: string }) | null;

/** Home "automation_showcase" section, read with the publishable key. Never throws. */
export const getAutomation = createServerFn({ method: "GET" }).handler(async (): Promise<Automation> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const page = await sb.from("site_pages").select("id").eq("slug", "home").eq("status", "published").maybeSingle();
    if (!page.data) return null;
    const { data: sec } = await sb.from("page_sections").select("eyebrow,title,body,cta_label,cta_url,config")
      .eq("page_id", page.data.id).eq("section_type", "automation_showcase").eq("is_visible", true).order("sort_order").limit(1).maybeSingle();
    if (!sec) return null;
    const cfg = parseAutomationConfig(sec.config);
    if (!cfg.use_cases.length) return null;
    return {
      ...cfg,
      eyebrow: sec.eyebrow || "AI AUTOMATION",
      title: sec.title || "Make the Work Happen Without Doing It Twice.",
      body: sec.body || "",
      ctaLabel: sec.cta_label || "Explore Automation",
      ctaUrl: sec.cta_url || "/services/ai-automation",
    };
  } catch {
    return null;
  }
});

export const automationQuery = queryOptions({ queryKey: ["public", "automation"], queryFn: () => getAutomation(), staleTime: 5 * 60 * 1000 });
