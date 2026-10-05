/** Homepage Work Showcase: display groups that portfolio_categories.homepage_group maps into. */
export const HOME_GROUPS = [
  { key: "ai_commercial", label: "AI Commercial", tone: "warm", description: "Commercials, TVCs, OVCs and branded films built through AI-native production." },
  { key: "ai_motion", label: "AI Motion", tone: "dark", description: "Motion ads, animation and visual effects with AI in the pipeline." },
  { key: "ai_content", label: "AI Content / UGC", tone: "white", description: "Social-first content, reels and UGC-style videos at scale." },
  { key: "ai_photography", label: "AI Photography", tone: "warm", description: "Product, fashion and campaign visuals created with AI." },
  { key: "brand_creative", label: "Brand & Creative", tone: "dark", description: "Identity, campaign creative, packaging and design." },
  { key: "web_digital", label: "Web & Digital", tone: "white", description: "Websites, landing pages, e-commerce and UI/UX." },
  { key: "software_saas", label: "Software / SaaS", tone: "dark", description: "Custom software, SaaS and business platforms." },
  { key: "ai_automation", label: "AI Automation", tone: "warm", description: "AI agents, chatbots and automated workflows." },
] as const;
export type HomeGroupKey = (typeof HOME_GROUPS)[number]["key"];
export type Tone = "warm" | "white" | "dark";

/** Options for the category editor (featured_only / hidden never get a category row). */
export const HOME_GROUP_OPTIONS = [
  { value: "", label: "Not set (hidden)" },
  { value: "featured_only", label: "Featured only" },
  ...HOME_GROUPS.map((g) => ({ value: g.key, label: g.label })),
  { value: "hidden", label: "Other / Hidden" },
];

export type ShowcaseConfig = {
  maxFeatured: number;
  showJumpNav: boolean;
  speed: number;
  hoverPreview: boolean;
  groupOrder: HomeGroupKey[];
  descriptions: Partial<Record<HomeGroupKey, string>>;
};

const KEYS = new Set<string>(HOME_GROUPS.map((g) => g.key));

export function parseShowcaseConfig(raw: unknown): ShowcaseConfig {
  const c = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const order = Array.isArray(c["group_order"]) ? (c["group_order"] as unknown[]).filter((k): k is HomeGroupKey => typeof k === "string" && KEYS.has(k)) : [];
  for (const g of HOME_GROUPS) if (!order.includes(g.key)) order.push(g.key);
  const d = (c["descriptions"] && typeof c["descriptions"] === "object" ? c["descriptions"] : {}) as Record<string, unknown>;
  const descriptions: ShowcaseConfig["descriptions"] = {};
  for (const k of KEYS) if (typeof d[k] === "string" && (d[k] as string).trim()) descriptions[k as HomeGroupKey] = (d[k] as string).trim().slice(0, 240);
  return {
    maxFeatured: Math.min(16, Math.max(1, Number(c["max_featured"]) || 10)),
    showJumpNav: c["show_jump_nav"] !== false,
    speed: Math.min(90, Math.max(20, Number(c["speed"]) || 40)),
    hoverPreview: c["hover_preview"] !== false,
    groupOrder: [...new Set(order)],
    descriptions,
  };
}
