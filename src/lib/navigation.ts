import { queryOptions } from "@tanstack/react-query";
import { getSiteChrome } from "./site-chrome.functions";

export const siteChromeQuery = queryOptions({
  queryKey: ["site-chrome"],
  queryFn: () => getSiteChrome(),
  staleTime: 5 * 60_000,
});

export type NavLink = { label: string; url: string; description?: string };
export type NavColumn = { title: string; url?: string; links: NavLink[] };
export type NavEntry = { id: string; label: string; url: string; kind: "link" | "dropdown" | "mega"; columns: NavColumn[] };

/* ------------------------------------------------------------------
 * FALLBACK — used only while the CMS navigation (site_settings
 * "navigation") is empty. Once saved in the Control Centre, CMS wins.
 * ------------------------------------------------------------------ */
const L = (label: string, url = "#"): NavLink => ({ label, url });

export const FALLBACK_NAV: NavEntry[] = [
  { id: "explore", label: "Explore", url: "/", kind: "link", columns: [] },
  {
    id: "create", label: "Create", url: "/services", kind: "mega",
    columns: [
      { title: "AI Video", url: "/services/ai-video-film", links: ["AI Film & TVC", "AI Commercial", "AI Product Video", "AI Fashion Film", "AI UGC", "Reels", "Character Animation", "Motion Graphics", "VFX"].map((l) => L(l)) },
      { title: "AI Image", url: "/services/ai-photography", links: ["AI Product Photography", "AI Fashion Visuals", "Lifestyle Visuals", "Campaign Visuals", "Virtual Models", "E-commerce Images", "Image Restoration"].map((l) => L(l)) },
      { title: "Creative", url: "/services/brand-creative", links: ["Branding", "Graphic Design", "Campaign Creative", "Social Media Creative", "Packaging", "Presentation Design"].map((l) => L(l)) },
    ],
  },
  {
    id: "build", label: "Build", url: "/services", kind: "mega",
    columns: [
      { title: "Design", url: "/services/ui-ux-digital-design", links: ["UI/UX", "Website UI", "Mobile App UI", "SaaS Product Design", "Dashboard Design", "Landing Pages"].map((l) => L(l)) },
      { title: "Development", url: "/services/web-software", links: ["Business Website", "E-commerce", "SaaS", "LMS", "CRM", "ERP", "POS", "HRM", "Custom Software"].map((l) => L(l)) },
      { title: "Automation", url: "/services/ai-automation", links: ["AI Agents", "AI Chatbots", "n8n Automation", "Marketing Automation", "Sales Automation", "CRM Automation", "Internal AI Tools", "Business Process Automation"].map((l) => L(l)) },
    ],
  },
  { id: "work", label: "Work", url: "/work", kind: "link", columns: [] },
  { id: "ai-studio", label: "AI Studio", url: "/ai-studio", kind: "link", columns: [] },
  { id: "insights", label: "Insights", url: "/insights", kind: "link", columns: [] },
  {
    id: "company", label: "Company", url: "/about", kind: "dropdown",
    columns: [{
      title: "Company",
      links: [
        { label: "About", url: "/about", description: "Who Branta is." },
        { label: "Process", url: "/process", description: "How we turn ideas into finished work." },
        { label: "Team", url: "/team", description: "People behind Branta." },
        { label: "Careers", url: "/careers", description: "Build with us." },
        { label: "Contact", url: "/contact", description: "Start a conversation." },
      ],
    }],
  },
];

/* ---------------- CMS → header model ---------------- */

type CmsItem = { id?: string; label?: string; url?: string; menu_group?: string; sort_order?: number; enabled?: boolean; children?: CmsItem[] };

const byOrder = (a: CmsItem, b: CmsItem) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
const live = (i: CmsItem) => i.enabled !== false && !!i.label?.trim();

/**
 * Top-level CMS items (any group except "footer") become header entries.
 * Children are grouped into columns by their menu_group; 2+ columns = mega menu.
 * Returns null when the CMS has no usable items, so the caller uses the fallback.
 */
export function navFromCms(raw: unknown): NavEntry[] | null {
  const items = (raw as { items?: CmsItem[] } | null)?.items;
  if (!Array.isArray(items)) return null;
  const top = items.filter((i) => live(i) && (i.menu_group ?? "main").toLowerCase() !== "footer").sort(byOrder);
  if (top.length === 0) return null;
  return top.map((item, idx) => {
    const kids = (item.children ?? []).filter(live).sort(byOrder);
    const parentGroup = (item.menu_group ?? "main").toLowerCase();
    const groups = new Map<string, NavLink[]>();
    for (const k of kids) {
      const g = (k.menu_group ?? "").trim();
      const title = !g || g.toLowerCase() === parentGroup ? item.label! : g;
      groups.set(title, [...(groups.get(title) ?? []), { label: k.label!.trim(), url: (k.url ?? "").trim() }]);
    }
    const columns = [...groups].map(([title, links]) => ({ title, links }));
    return {
      id: item.id ?? `cms-${idx}`,
      label: item.label!.trim(),
      url: (item.url ?? "").trim(),
      kind: columns.length === 0 ? "link" : columns.length > 1 ? "mega" : "dropdown",
      columns,
    };
  });
}

/** Only https URLs, used for CMS-provided images. */
export const safeImage = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s"<>]+$/.test(u) ? u : null);
