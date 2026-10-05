export type ChatSettings = {
  enabled: boolean; title: string; subtitle: string; opening: string; placeholder: string; offline: string;
  handoff: boolean; booking: boolean; portfolio: boolean; language: "auto" | "en" | "bn";
  hours: { enabled: boolean; timezone: string; days: number[]; start: string; end: string };
  lead: LeadSettings;
};

export type LeadSettings = {
  enabled: boolean; requireName: boolean; requireWhatsapp: boolean; requireEmail: boolean;
  welcomeTitle: string; welcomeMessage: string; privacy: string; privacyUrl: string; completion: string;
};
export type LeadProfile = { name: string | null; whatsapp: string | null; email: string | null; complete: boolean; returning: boolean };

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  enabled: true, title: "Branta Assistant", subtitle: "Creative. AI. Technology.",
  opening: "Hi. What are you looking to create?", placeholder: "Ask about our services, work or booking...",
  offline: "Our team is currently offline. Leave your details and message and we’ll get back to you.",
  handoff: true, booking: true, portfolio: true, language: "auto",
  hours: { enabled: false, timezone: "Asia/Dhaka", days: [0, 1, 2, 3, 4], start: "10:00", end: "20:00" },
  lead: {
    enabled: true, requireName: true, requireWhatsapp: true, requireEmail: true,
    welcomeTitle: "Hi, I’m Branta Assistant.", welcomeMessage: "Before we get started, let’s know who we’re speaking with.",
    privacy: "Your details are used only to respond to your enquiry, provide support or arrange requested follow-up.",
    privacyUrl: "", completion: "You're all set.",
  },
};

const o = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown, d: string, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);
const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const time = (v: unknown, d: string) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : d);

export function parseChatSettings(raw: unknown): ChatSettings {
  const r = o(raw), h = o(r["hours"]), l = o(r["lead"]), D = DEFAULT_CHAT_SETTINGS, L = D.lead;
  const url = typeof l["privacyUrl"] === "string" && /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(l["privacyUrl"].trim()) ? l["privacyUrl"].trim().slice(0, 300) : "";
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
    lead: {
      enabled: b(l["enabled"], L.enabled), requireName: b(l["requireName"], L.requireName), requireWhatsapp: b(l["requireWhatsapp"], L.requireWhatsapp),
      requireEmail: b(l["requireEmail"], L.requireEmail), welcomeTitle: s(l["welcomeTitle"], L.welcomeTitle, 80),
      welcomeMessage: s(l["welcomeMessage"], L.welcomeMessage, 200), privacy: s(l["privacy"], L.privacy, 300), privacyUrl: url,
      completion: s(l["completion"], L.completion, 80),
    },
  };
}

export type QuickAction = { label: string; type: "intent" | "message" | "link" | "booking" | "human" | "portfolio"; target: string | null };

export type ServiceCard = { id?: string; name: string; slug: string; summary: string | null; groupId?: string; group?: string | null };
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

export const FUNNEL_EVENTS = ["widget_opened", "lead_started", "name_completed", "whatsapp_completed", "email_completed", "lead_completed", "chat_started"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Shared lead validators (client + server). */
export const LEAD_NAME_RE = /^[\p{L}\p{M}' .-]{2,80}$/u;
export const LEAD_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
export const LEAD_PHONE_RE = /^\+[1-9]\d{6,14}$/;
export const normalizePhone = (v: string) => { const t = v.replace(/[\s().-]/g, ""); return t.startsWith("00") ? `+${t.slice(2)}` : t; };
