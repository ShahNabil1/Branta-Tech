import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChatMsg, ChatSettings, ChatState, QuickAction } from "./chat/types";

/**
 * Branta Assistant server boundary. Guests never query chat tables directly: every call
 * proves ownership with a random session token (stored only as a SHA-256 hash) and only
 * that visitor's own conversation is returned. Replies come from the internal knowledge base.
 */

const FAIL = "Something went wrong. Please try again or talk to our team.";
const MAX_TEXT = 1200;
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim().slice(0, MAX_TEXT);

const GROUP_FOR: Record<string, string> = {
  service_ai_commercial: "ai_commercial", service_ai_photography: "ai_photography", service_brand: "brand_creative",
  service_website: "web_digital", service_software: "software_saas", service_automation: "ai_automation",
};

async function ctx() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { createHash, randomBytes } = await import("crypto");
  const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const hash = (v: string) => createHash("sha256").update(`branta-chat:${v}`).digest("hex");
  let userId: string | null = null;
  const auth = getRequestHeader("authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    userId = data.user?.id ?? null;
  }
  return { sb: supabaseAdmin, ipHash: hash(`ip:${ip}`), hash, newToken: () => randomBytes(32).toString("base64url"), userId };
}
type Ctx = Awaited<ReturnType<typeof ctx>>;
type Conv = { id: string; status: string; mode: string; channel_key: string; assigned_agent_id: string | null; visitor_id: string };

async function loadSettings(sb: Ctx["sb"]): Promise<ChatSettings> {
  const { parseChatSettings } = await import("./chat/types");
  const { data } = await sb.from("site_settings").select("settings").eq("setting_group", "chat").maybeSingle();
  return parseChatSettings(data?.settings);
}

function withinHours(s: ChatSettings) {
  if (!s.hours.enabled) return true;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: s.hours.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(p["weekday"]));
  const now = `${p["hour"]}:${p["minute"]}`;
  return s.hours.days.includes(day) && now >= s.hours.start && now < s.hours.end;
}

async function teamOnline(sb: Ctx["sb"], s: ChatSettings) {
  if (!s.handoff || !withinHours(s)) return false;
  const { count } = await sb.from("chat_agents").select("user_id", { count: "exact", head: true }).eq("status", "online");
  return (count ?? 0) > 0;
}

async function agentName(sb: Ctx["sb"], id: string | null) {
  if (!id) return null;
  const { data } = await sb.from("chat_agents").select("display_name").eq("user_id", id).maybeSingle();
  if (data?.display_name) return data.display_name;
  const { data: p } = await sb.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return p?.full_name?.split(" ")[0] ?? "A team member";
}

async function state(sb: Ctx["sb"], c: Conv | null): Promise<ChatState> {
  if (!c) return { status: "none", mode: "assistant", channel: null, agentName: null };
  return { status: c.status as ChatState["status"], mode: c.mode as ChatState["mode"], channel: c.channel_key, agentName: c.mode === "human" ? await agentName(sb, c.assigned_agent_id) : null };
}

const CONV_COLS = "id,status,mode,channel_key,assigned_agent_id,visitor_id";

async function findConversation(c: Ctx, token: string | null): Promise<Conv | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const { data: v } = await c.sb.from("chat_visitors").select("id").eq("session_hash", c.hash(token)).maybeSingle();
  if (!v) return null;
  const { data } = await c.sb.from("chat_conversations").select(CONV_COLS).eq("visitor_id", v.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

function toMsg(r: { id: string; sender_type: string; message: string; message_type: string; payload: unknown; created_at: string }): ChatMsg {
  return { id: r.id, from: r.sender_type as ChatMsg["from"], text: r.message, type: r.message_type as ChatMsg["type"], payload: (r.payload ?? null) as ChatMsg["payload"], at: r.created_at };
}
const MSG_COLS = "id,sender_type,message,message_type,payload,created_at";

async function messages(sb: Ctx["sb"], convId: string, after?: string) {
  let q = sb.from("chat_messages").select(MSG_COLS).eq("conversation_id", convId).order("created_at").limit(200);
  if (after) q = q.gt("created_at", after);
  const { data } = await q;
  return (data ?? []).map(toMsg);
}

async function quickActions(sb: Ctx["sb"]): Promise<QuickAction[]> {
  const { data } = await sb.from("chat_quick_actions").select("label,action_type,target").eq("is_published", true).order("sort_order").limit(16);
  return (data ?? []).map((q) => ({ label: q.label, type: q.action_type as QuickAction["type"], target: q.target }));
}

/** First load / refresh: settings, shortcuts and (if the token is valid) the visitor's own history. */
export const chatOpen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(100).nullable() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const c = await ctx();
      const settings = await loadSettings(c.sb);
      const conv = await findConversation(c, data.token);
      return {
        ok: true as const, settings, quickActions: await quickActions(c.sb), online: await teamOnline(c.sb, settings),
        state: await state(c.sb, conv), messages: conv ? await messages(c.sb, conv.id) : [],
      };
    } catch {
      return { ok: false as const, error: FAIL };
    }
  });

/** Poll / realtime follow-up: messages newer than `after` for the caller's own conversation. */
export const chatSync = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(100), after: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const c = await ctx();
      const conv = await findConversation(c, data.token);
      if (!conv) return { ok: true as const, state: await state(c.sb, null), messages: [] as ChatMsg[] };
      return { ok: true as const, state: await state(c.sb, conv), messages: await messages(c.sb, conv.id, data.after) };
    } catch {
      return { ok: false as const, error: FAIL };
    }
  });

const SendInput = z.object({
  token: z.string().max(100).nullable(),
  page: z.string().max(300).optional(),
  text: z.string().max(4000).optional(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("intent"), key: z.string().max(80), label: z.string().max(120) }),
    z.object({ type: z.literal("portfolio"), label: z.string().max(120) }),
    z.object({ type: z.literal("human"), label: z.string().max(120) }),
    z.object({ type: z.literal("handoff_topic"), topic: z.string().max(60) }),
    z.object({ type: z.literal("offline_contact"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200).or(z.literal("")), whatsapp: z.string().trim().max(40), message: z.string().trim().min(2).max(MAX_TEXT) }),
    z.object({ type: z.literal("booking_started") }),
    z.object({ type: z.literal("booking_done"), reference: z.string().max(40), date: z.string().max(60), time: z.string().max(40), service: z.string().max(300), status: z.string().max(40) }),
    z.object({ type: z.literal("assistant") }),
    z.object({ type: z.literal("restart") }),
  ]).optional(),
});

type Reply = { text: string; type?: ChatMsg["type"]; payload?: ChatMsg["payload"]; intent?: string | null; from?: "assistant" | "system" };

/** Visitor message or action. Creates the session lazily, stores the message, and answers from the knowledge base. */
export const chatSend = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const c = await ctx();
      const settings = await loadSettings(c.sb);
      if (!settings.enabled) return { ok: false as const, error: FAIL };
      let token = data.token;
      let conv = await findConversation(c, token);
      const act = data.action;
      const text = data.text ? clean(data.text) : "";
      if (!act && !text) return { ok: false as const, error: "Type a message first." };

      if (act?.type === "restart" || (conv && conv.status === "closed" && act?.type !== "assistant")) {
        if (conv && act?.type === "restart") await c.sb.from("chat_conversations").update({ status: "closed" }).eq("id", conv.id).neq("status", "closed");
        conv = conv ? { ...conv, id: "", status: "new" } : null;
        if (act?.type === "restart") return { ok: true as const, token, state: await state(c.sb, null), messages: [] as ChatMsg[], reset: true };
      }

      // Create visitor + conversation on first real interaction (rate limited per network).
      if (!conv || !conv.id) {
        let visitorId = conv?.visitor_id ?? null;
        if (!visitorId) {
          const hourAgo = new Date(Date.now() - 3600_000).toISOString();
          const { count } = await c.sb.from("chat_visitors").select("id", { count: "exact", head: true }).eq("ip_hash", c.ipHash).gte("created_at", hourAgo);
          if ((count ?? 0) >= 15) return { ok: false as const, error: "Too many new chats from your network. Please try again later." };
          token = c.newToken();
          const { data: v, error } = await c.sb.from("chat_visitors").insert({ session_hash: c.hash(token), ip_hash: c.ipHash, user_id: c.userId }).select("id").single();
          if (error) throw error;
          visitorId = v.id;
        }
        const { data: nc, error } = await c.sb.from("chat_conversations")
          .insert({ visitor_id: visitorId, user_id: c.userId, source_page: data.page?.slice(0, 300) ?? null }).select(CONV_COLS).single();
        if (error) throw error;
        conv = nc;
      } else {
        const minuteAgo = new Date(Date.now() - 60_000).toISOString();
        const { count } = await c.sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("sender_type", "visitor").gte("created_at", minuteAgo);
        if ((count ?? 0) >= 15) return { ok: false as const, error: "You're sending messages quickly. Please wait a moment." };
        await c.sb.from("chat_visitors").update({ last_seen_at: new Date().toISOString(), ...(c.userId ? { user_id: c.userId } : {}) }).eq("id", conv.visitor_id);
      }
      const cv = conv;
      const started = new Date().toISOString();

      const insert = async (rows: { sender_type: string; message: string; message_type?: string; payload?: unknown; intent_key?: string | null }[]) => {
        if (!rows.length) return;
        const base = Date.now();
        const { error } = await c.sb.from("chat_messages").insert(rows.map((r, i) => ({
          conversation_id: cv.id, sender_type: r.sender_type, message: r.message, message_type: r.message_type ?? "text",
          payload: (r.payload ?? null) as never, intent_key: r.intent_key ?? null, created_at: new Date(base + i * 5).toISOString(),
        })));
        if (error) throw error;
      };
      const visitorLine = text || ("label" in (act ?? {}) ? (act as { label: string }).label : act?.type === "handoff_topic" ? act.topic : "");
      if (visitorLine) await insert([{ sender_type: "visitor", message: visitorLine }]);

      const replies: Reply[] = [];
      const human = async () => {
        if (!settings.handoff) return offline();
        replies.push({ text: "What do you need help with?", type: "quick_replies", payload: { replies: (await import("./chat/types")).HANDOFF_TOPICS, kind: "handoff_topic" }, intent: "human_request" });
      };
      const offline = () => {
        replies.push({ text: settings.offline, type: "contact_form", payload: null, from: "assistant" });
      };

      if (act?.type === "handoff_topic") {
        await c.sb.from("chat_conversations").update({ handoff_topic: act.topic }).eq("id", cv.id);
        if (await teamOnline(c.sb, settings)) {
          await c.sb.from("chat_conversations").update({ status: "waiting_for_agent" }).eq("id", cv.id);
          replies.push({ text: "Connecting you with the Branta team...", type: "system", from: "system" });
        } else offline();
      } else if (act?.type === "offline_contact") {
        await c.sb.from("chat_visitors").update({ name: act.name, email: act.email || null, whatsapp: act.whatsapp || null }).eq("id", cv.visitor_id);
        await insert([{ sender_type: "visitor", message: act.message }]);
        await c.sb.from("chat_conversations").update({ status: "waiting_for_agent" }).eq("id", cv.id);
        replies.push({ text: "Thanks. Your details and message are saved, and the team will get back to you.", type: "system", from: "system" });
      } else if (act?.type === "booking_started") {
        await c.sb.from("chat_messages").insert({ conversation_id: cv.id, sender_type: "system", message: "Booking started", message_type: "system", intent_key: "booking_started" });
      } else if (act?.type === "booking_done") {
        const { data: b } = await c.sb.from("bookings").select("id").eq("booking_reference", act.reference).maybeSingle();
        if (b) await c.sb.from("chat_conversations").update({ booking_id: b.id, interested_service: act.service.slice(0, 200) }).eq("id", cv.id);
        replies.push({ text: "Your call request has been submitted.", type: "booking", payload: { booking: { reference: act.reference, date: act.date, time: act.time, service: act.service, status: act.status } }, intent: "booking_completed" });
      } else if (act?.type === "assistant") {
        await c.sb.from("chat_conversations").update({ status: "active", mode: "assistant", assigned_agent_id: null }).eq("id", cv.id);
        replies.push({ text: "You're back with Branta Assistant. How can I help?", type: "system", from: "system" });
      } else if (act?.type === "human") {
        await human();
      } else if (cv.mode === "assistant" && cv.status !== "waiting_for_agent") {
        await answer(c, settings, cv.id, act?.type === "intent" ? act.key : null, act?.type === "portfolio" ? "__portfolio" : text, replies, human);
      }

      await insert(replies.map((r) => ({ sender_type: r.from ?? "assistant", message: r.text, message_type: r.type ?? "text", payload: r.payload ?? null, intent_key: r.intent ?? null })));
      const { data: fresh } = await c.sb.from("chat_conversations").select(CONV_COLS).eq("id", cv.id).single();
      return { ok: true as const, token, state: await state(c.sb, fresh ?? cv), messages: await messages(c.sb, cv.id, new Date(new Date(started).getTime() - 1).toISOString()), reset: false };
    } catch {
      return { ok: false as const, error: FAIL };
    }
  });

async function answer(c: Ctx, settings: ChatSettings, convId: string, forcedKey: string | null, text: string, replies: Reply[], human: () => Promise<void>) {
  const { matchIntents, MATCH_THRESHOLD, normalize, detectLang, PORTFOLIO_WORDS } = await import("./chat/match");
  const [{ data: intents }, { data: services }] = await Promise.all([
    c.sb.from("chat_intents").select("id,key,name,answer,answer_bn,follow_up,service_id,category_id,quick_replies,ctas,action,priority,chat_intent_phrases(phrase,lang)").eq("is_published", true),
    c.sb.from("services").select("id,name,slug,short_description").eq("status", "published").order("sort_order"),
  ]);
  const list = intents ?? [];
  const portfolioOnly = text === "__portfolio";
  const msg = portfolioOnly ? "" : normalize(text);
  const lang = settings.language === "auto" ? detectLang(text) : settings.language;

  let ranked = forcedKey ? list.filter((i) => i.key === forcedKey).map((i) => ({ key: i.key, id: i.id, score: 100 }))
    : portfolioOnly ? list.filter((i) => i.key === "portfolio_request").map((i) => ({ key: i.key, id: i.id, score: 100 }))
    : matchIntents(text, list.map((i) => ({ id: i.id, key: i.key, priority: i.priority, phrases: i.chat_intent_phrases ?? [] })));
  // Direct service-name mentions count as a match too.
  const named = msg ? (services ?? []).filter((s) => { const n = normalize(s.name); return n.length > 2 && ` ${msg} `.includes(` ${n} `); }) : [];
  ranked = ranked.filter((r) => r.score >= MATCH_THRESHOLD);

  if (!ranked.length && !named.length) {
    if (msg) {
      const norm = msg.slice(0, 300);
      const { data: ex } = await c.sb.from("chat_unanswered_questions").select("id,count").eq("normalized_question", norm).maybeSingle();
      if (ex) await c.sb.from("chat_unanswered_questions").update({ count: ex.count + 1, last_asked_at: new Date().toISOString(), conversation_id: convId }).eq("id", ex.id);
      else await c.sb.from("chat_unanswered_questions").insert({ question: text.slice(0, MAX_TEXT), normalized_question: norm, conversation_id: convId });
    }
    replies.push({ text: lang === "bn" ? "এই বিষয়ে সঠিক তথ্য আমার কাছে এখনো নেই। আপনি কি আমাদের টিমের সাথে কথা বলতে চান?" : "I’m not confident I have the right information for that yet. Would you like to talk to our team?",
      type: "quick_replies", payload: { replies: ["Talk to a Human", "Book a Call", "Ask Something Else"] }, intent: "unknown" });
    return;
  }

  const top = list.find((i) => i.id === ranked[0]?.id);
  const wantsWork = portfolioOnly || top?.action === "portfolio" || (msg && PORTFOLIO_WORDS.some((w) => ` ${msg} `.includes(` ${w} `)));
  if (top?.action === "human") return human();
  if (top?.action === "booking") {
    if (!settings.booking) { replies.push({ text: "You can book a call on our Book a Call page.", payload: { ctas: [{ label: "Book a Call", url: "/book-a-call" }] }, intent: top.key }); return; }
    replies.push({ text: lang === "bn" && top.answer_bn ? top.answer_bn : top.answer || "Let's book a call.", type: "booking", payload: null, intent: top.key });
    return;
  }

  const serviceIntents = ranked.map((r) => list.find((i) => i.id === r.id)!).filter((i) => i && GROUP_FOR[i.key]);
  const mainService = serviceIntents[0] ?? null;

  if (top && !(wantsWork && top.key === "portfolio_request" && mainService)) {
    const body = (lang === "bn" && top.answer_bn ? top.answer_bn : top.answer).trim();
    const qr = Array.isArray(top.quick_replies) ? (top.quick_replies as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 6) : [];
    const ctas = Array.isArray(top.ctas) ? (top.ctas as { label?: unknown; url?: unknown }[]).filter((x) => typeof x.label === "string" && typeof x.url === "string" && /^\/|^https:\/\//.test(x.url as string)).map((x) => ({ label: x.label as string, url: x.url as string })) : [];
    if (!(top.key === "portfolio_request" && wantsWork)) {
      if (body) replies.push({ text: top.follow_up ? `${body}\n\n${top.follow_up}` : body, type: qr.length ? "quick_replies" : "text", payload: qr.length || ctas.length ? { replies: qr, ctas } : null, intent: top.key });
    }
  }

  // Related real services: explicit links on matched intents + names typed by the visitor (max 3).
  if (!wantsWork) {
    const ids = new Set([...serviceIntents.map((i) => i.service_id).filter(Boolean), ...named.map((s) => s.id)]);
    let cards = (services ?? []).filter((s) => ids.has(s.id));
    if (!cards.length && serviceIntents.length) {
      const { data: groups } = await c.sb.from("service_groups").select("id,name").eq("status", "published");
      const wanted = serviceIntents.map((i) => normalize(i.name));
      const gid = (groups ?? []).filter((g) => wanted.some((w) => normalize(g.name).includes(w) || w.includes(normalize(g.name)))).map((g) => g.id);
      if (gid.length) {
        const { data } = await c.sb.from("services").select("id,name,slug,short_description").eq("status", "published").in("group_id", gid).order("sort_order").limit(3);
        cards = data ?? [];
      }
    }
    if (cards.length) replies.push({ text: "Related services", type: "service_card", payload: { services: cards.slice(0, 3).map((s) => ({ name: s.name, slug: s.slug, summary: s.short_description })) } });
    return;
  }

  if (!settings.portfolio) { replies.push({ text: "You can see our work on the Work page.", payload: { ctas: [{ label: "View Work", url: "/work" }] } }); return; }
  const projects = await portfolio(c, mainService ? GROUP_FOR[mainService.key] ?? null : null, mainService?.category_id ?? top?.category_id ?? null);
  if (!projects.length) {
    replies.push({ text: "I don't have published projects to show for that yet. You can browse all work on the Work page.", payload: { ctas: [{ label: "View Work", url: "/work" }] }, intent: "portfolio_request" });
    return;
  }
  replies.push({ text: mainService ? `Here are some selected ${mainService.name} projects.` : "Here is some selected work.", type: "portfolio_card", payload: { projects, ctas: [{ label: "View all work", url: "/work" }] }, intent: "portfolio_request" });
}

async function portfolio(c: Ctx, group: string | null, categoryId: string | null) {
  let catIds: string[] | null = null;
  if (categoryId) catIds = [categoryId];
  else if (group) {
    const { data } = await c.sb.from("portfolio_categories").select("id").eq("status", "published").eq("homepage_group", group);
    catIds = (data ?? []).map((x) => x.id);
    if (!catIds.length) return [];
  }
  let q = c.sb.from("portfolio_projects").select("slug,title,cover_type,cover_url,cover_poster_url,category_id,portfolio_categories(name)").eq("status", "published")
    .order("is_featured", { ascending: false }).order("sort_order").limit(3);
  if (catIds) q = q.in("category_id", catIds);
  const { data } = await q;
  return (data ?? []).map((p) => ({
    slug: p.slug, title: p.title, category: (p.portfolio_categories as { name: string } | null)?.name ?? null,
    poster: p.cover_type === "image" && p.cover_url?.startsWith("https://") ? p.cover_url : p.cover_poster_url?.startsWith("https://") ? p.cover_poster_url : null,
  }));
}
