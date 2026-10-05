export type ChatSettings = {
  enabled: boolean; title: string; subtitle: string; opening: string; placeholder: string; offline: string;
  handoff: boolean; booking: boolean; portfolio: boolean; language: "auto" | "en" | "bn";
  hours: { enabled: boolean; timezone: string; days: number[]; start: string; end: string };
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  enabled: true, title: "Branta Assistant", subtitle: "Creative. AI. Technology.",
  opening: "Hi. What are you looking to create?", placeholder: "Ask about our services, work or booking...",
  offline: "Our team is currently offline. Leave your details and message and we’ll get back to you.",
  handoff: true, booking: true, portfolio: true, language: "auto",
  hours: { enabled: false, timezone: "Asia/Dhaka", days: [0, 1, 2, 3, 4], start: "10:00", end: "20:00" },
};

const o = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown, d: string, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);
const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const time = (v: unknown, d: string) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : d);

export function parseChatSettings(raw: unknown): ChatSettings {
  const r = o(raw), h = o(r["hours"]), D = DEFAULT_CHAT_SETTINGS;
  const lang = r["language"];
  return {
    enabled: b(r["enabled"], D.enabled), title: s(r["title"], D.title, 60), subtitle: s(r["subtitle"], D.subtitle, 80),
    opening: s(r["opening"], D.opening), placeholder: s(r["placeholder"], D.placeholder, 120), offline: s(r["offline"], D.offline),
    handoff: b(r["handoff"], D.handoff), booking: b(r["booking"], D.booking), portfolio: b(r["portfolio"], D.portfolio),
    language: lang === "en" || lang === "bn" ? lang : "auto",
    hours: {
      enabled: b(h["enabled"], false), timezone: s(h["timezone"], D.hours.timezone, 64),
      days: Array.isArray(h["days"]) ? h["days"].filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : D.hours.days,
      start: time(h["start"], D.hours.start), end: time(h["end"], D.hours.end),
    },
  };
}

export type QuickAction = { label: string; type: "intent" | "message" | "link" | "booking" | "human" | "portfolio"; target: string | null };

export type ServiceCard = { name: string; slug: string; summary: string | null };
export type ProjectCard = { slug: string; title: string; category: string | null; poster: string | null };

export type ChatMsg = {
  id: string; from: "visitor" | "assistant" | "agent" | "system"; text: string;
  type: "text" | "quick_replies" | "service_card" | "portfolio_card" | "booking" | "contact_form" | "system";
  payload: {
    replies?: string[]; kind?: "handoff_topic";
    services?: ServiceCard[]; projects?: ProjectCard[];
    ctas?: { label: string; url: string }[];
    booking?: { reference?: string; date?: string; time?: string; service?: string; status?: string };
    agentName?: string;
  } | null;
  at: string;
};

export type ChatState = { status: "none" | "active" | "waiting_for_agent" | "human_active" | "closed"; mode: "assistant" | "human"; channel: string | null; agentName: string | null };

export const HANDOFF_TOPICS = ["Sales", "New Project", "Existing Project", "Technical Question", "Partnership", "Other"];
