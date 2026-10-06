import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Quote } from "./pricing/engine";
import { businessToday, shouldMarkRequestExpired, autoLeadLink } from "./pricing/phase5";

/* Public quotation endpoints. All DB access uses the service role inside handlers; callers never see other rows. */

async function ctx(scope: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { createHash, randomBytes } = await import("crypto");
  const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256").update(`branta-${scope}:${ip}`).digest("hex");
  let userId: string | null = null;
  const auth = getRequestHeader("authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    userId = data.user?.id ?? null;
  }
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  return { supabaseAdmin, ipHash, userId, randomBytes, sha };
}

export type QuoteSubmitResult =
  | { ok: false; error: string; fields?: Record<string, string> }
  | { ok: true; reference: string; status: string; videoType: string | null; model: string | null; durationSeconds: number | null; estimate: { total: number; currency: string } | null; booking: BookingHint };

export type BookingHint = { quote: string; group: string | null; service: string | null; type: string | null };

/** Category → service for Book a Call, only when both are currently published. */
async function bookingHint(sb: Awaited<ReturnType<typeof ctx>>["supabaseAdmin"], reference: string, videoTypeId: string | null): Promise<BookingHint> {
  const hint: BookingHint = { quote: reference, group: null, service: null, type: null };
  if (!videoTypeId) return hint;
  const { data: vt } = await sb.from("pricing_video_types").select("name,related_service_id").eq("id", videoTypeId).maybeSingle();
  hint.type = vt?.name ?? null;
  if (!vt?.related_service_id) return hint;
  const { data: svc } = await sb.from("services").select("slug,status,service_groups(slug,status)").eq("id", vt.related_service_id).maybeSingle();
  const g = svc?.service_groups as { slug: string; status: string } | null;
  if (svc?.status === "published" && g?.status === "published") { hint.service = svc.slug; hint.group = g.slug; }
  return hint;
}

export const submitQuoteRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<QuoteSubmitResult> => {
    const { processQuoteRequest } = await import("./pricing/quote-request");
    const { loadPublicConfig } = await import("./pricing.functions");
    const config = await loadPublicConfig().catch(() => null);
    const chatToken = typeof (data as Record<string, unknown> | null)?.["chatToken"] === "string" ? String((data as Record<string, unknown>)["chatToken"]).slice(0, 100) : null;
    const r = processQuoteRequest(data, config);
    if (!r.ok) return r;
    const { supabaseAdmin, ipHash, userId, randomBytes } = await ctx("quotes");
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [byIp, byEmail] = await Promise.all([
      supabaseAdmin.from("pricing_quote_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
      supabaseAdmin.from("pricing_quote_requests").select("id", { count: "exact", head: true }).ilike("customer_email", r.data.email).gte("created_at", hourAgo),
    ]);
    if ((byIp.count ?? 0) >= 5 || (byEmail.count ?? 0) >= 3) return { ok: false, error: "We've received several requests from you already. Please try again later." };
    const reference = `Q-${randomBytes(5).toString("hex").toUpperCase()}`;
    const e = r.estimate, s = r.selection;
    const n = (v: string) => (v ? v : null);
    // CRM: link to an existing lead only through the verified account — never by email alone.
    const leads = userId ? (await supabaseAdmin.from("leads").select("id,client_user_id,email,created_at").eq("client_user_id", userId).limit(20)).data ?? [] : [];
    const leadId = autoLeadLink(userId, leads);
    // Branta Assistant: associate the caller's own conversation, proven by their session token.
    const chat = chatToken ? await (await import("./chat.server")).visitorForQuote(chatToken).catch(() => null) : null;
    const ins = await supabaseAdmin.from("pricing_quote_requests").insert({
      public_reference: reference, requester_user_id: userId, lead_id: leadId, chat_conversation_id: chat?.conversationId ?? null,
      customer_name: r.data.name, customer_email: r.data.email, customer_whatsapp: r.data.whatsapp,
      company_name: n(r.data.company), project_description: n(r.data.description), requested_deadline: n(r.data.deadline),
      video_type_id: s?.videoTypeId ?? null, ai_model_id: s?.modelId ?? null, production_tier_id: s?.tierId ?? null,
      duration_seconds: s?.durationSeconds ?? null, selections: (s ? { addons: s.addons } : {}) as never,
      status: r.status, estimated_price_minor: e?.total ?? null, estimated_currency: e?.currency ?? config?.settings.currency ?? "BDT",
      original_pricing_snapshot: e ? ({ quote: e, settings: config?.settings, captured_at: new Date().toISOString() } as never) : null,
      pricing_version: e ? `rate:${e.rateId}` : null, ip_hash: ipHash,
    }).select("id").single();
    if (ins.error) {
      console.error("quote insert failed", ins.error.message);
      return { ok: false, error: "We couldn't send your request. Please try again." };
    }
    await supabaseAdmin.from("pricing_quote_activity").insert({ quote_id: ins.data.id, actor_type: "system", kind: "request_submitted", detail: { status: r.status } });
    return { ok: true, reference, status: r.status, videoType: e?.videoType.name ?? null, model: e?.model.name ?? null, durationSeconds: e?.durationSeconds ?? null, estimate: e ? { total: e.total, currency: e.currency } : null, booking: await bookingHint(supabaseAdmin, reference, s?.videoTypeId ?? null) };
  });

/** Prefill for the quote form from the caller's OWN completed chat onboarding (token-proven). */
export const getQuotePrefill = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chatToken: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const v = await (await import("./chat.server")).visitorForQuote(data.chatToken);
    return v ? { name: v.name ?? "", whatsapp: v.whatsapp ?? "", email: v.email ?? "" } : null;
  });

/** Privacy-conscious funnel counter: fixed event names, hashed network, capped per hour. */
export const trackPricingEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ event: z.enum(["calculator_start", "quote_modal_open"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, ipHash } = await ctx("pricing-events");
    const { count } = await supabaseAdmin.from("pricing_events").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) < 20) await supabaseAdmin.from("pricing_events").insert({ event: data.event, ip_hash: ipHash });
    return { ok: true };
  });

export type CustomerQuote =
  | { ok: false; reason: "not_found" | "superseded" }
  | {
      ok: true; reference: string; version: number; customer: { name: string; company: string | null; email: string };
      issuedAt: string; validUntil: string | null; expired: boolean;
      production: { videoType: string | null; model: string | null; tier: string | null; durationSeconds: number | null; addons: string[] };
      lines: { label: string; quantity: number; unit_minor: number; amount_minor: number }[];
      subtotal: number; discount: number; tax: { label: string; percentage: number; inclusive: boolean; amount: number } | null; total: number; currency: string;
      scope: string | null; deliverables: string | null; revisions: number | null; timeline: string | null; paymentTerms: string | null; notes: string | null;
      response: { kind: string; at: string; note: string | null } | null;
      company: { name: string; email: string | null; phone: string | null };
      booking: BookingHint;
    };

const TokenSchema = z.object({ token: z.string().min(30).max(80).regex(/^[A-Za-z0-9_-]+$/) });

async function findVersion(token: string) {
  const c = await ctx("quote-view");
  const { data: v } = await c.supabaseAdmin.from("pricing_quote_versions").select("*").eq("access_token_hash", c.sha(token)).is("token_revoked_at", null).maybeSingle();
  return { c, v };
}
const today = () => businessToday();

export const getCustomerQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }): Promise<CustomerQuote> => {
    const { c, v } = await findVersion(data.token);
    if (!v || v.status === "draft") return { ok: false, reason: "not_found" };
    if (v.status === "superseded") return { ok: false, reason: "superseded" };
    const sb = c.supabaseAdmin;
    const [{ data: q }, { data: chrome }] = await Promise.all([
      sb.from("pricing_quote_requests").select("id,public_reference,customer_name,customer_email,company_name,status,duration_seconds,original_pricing_snapshot,video_type_id").eq("id", v.quote_id).single(),
      sb.from("site_settings").select("setting_group,settings").in("setting_group", ["company", "contact"]),
    ]);
    if (!q) return { ok: false, reason: "not_found" };
    const expired = !v.customer_response && !!v.valid_until && v.valid_until < today();
    if (shouldMarkRequestExpired(q.status, v, today())) {
      await sb.from("pricing_quote_requests").update({ status: "expired", status_changed_at: new Date().toISOString() }).eq("id", q.id);
      await sb.from("pricing_quote_activity").insert({ quote_id: q.id, actor_type: "system", kind: "quote_expired", detail: { version: v.version } });
    }
    const snap = (q.original_pricing_snapshot as { quote?: Quote } | null)?.quote ?? null;
    const set = (g: string) => (chrome ?? []).find((r) => r.setting_group === g)?.settings as Record<string, string> | undefined;
    const lines = (Array.isArray(v.line_items) ? v.line_items : []) as { label: string; quantity: number; unit_minor: number }[];
    return {
      ok: true, reference: q.public_reference, version: v.version,
      customer: { name: q.customer_name, company: q.company_name, email: q.customer_email },
      issuedAt: v.issued_at ?? v.created_at, validUntil: v.valid_until, expired,
      production: { videoType: snap?.videoType.name ?? null, model: snap?.model.name ?? null, tier: snap?.tier.name ?? null, durationSeconds: q.duration_seconds, addons: snap?.addonLines.map((l) => l.name) ?? [] },
      lines: lines.map((l) => ({ ...l, amount_minor: Math.round(l.unit_minor * l.quantity) })),
      subtotal: Number(v.subtotal_minor), discount: Number(v.discount_minor),
      tax: Number(v.tax_percentage) > 0 ? { label: v.tax_label, percentage: Number(v.tax_percentage), inclusive: v.tax_inclusive, amount: Number(v.tax_minor) } : null,
      total: Number(v.total_minor), currency: v.currency,
      scope: v.scope, deliverables: v.deliverables, revisions: v.revisions, timeline: v.delivery_timeline, paymentTerms: v.payment_terms, notes: v.customer_notes,
      response: v.customer_response ? { kind: v.customer_response, at: v.responded_at!, note: v.response_note } : null,
      company: { name: set("company")?.["company_name"] || "Branta Tech", email: set("contact")?.["email"] || null, phone: set("contact")?.["phone"] || null },
      booking: await bookingHint(sb, q.public_reference, q.video_type_id),
    };
  });

const RespondSchema = TokenSchema.extend({
  action: z.enum(["accepted", "declined", "changes_requested"]),
  note: z.string().trim().max(2000).default(""),
  name: z.string().trim().max(120).default(""),
  termsAccepted: z.boolean().default(false),
});

export const respondToQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RespondSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { c, v } = await findVersion(data.token);
    if (!v || v.status !== "issued") return { ok: false, error: "This quote is no longer available." };
    if (v.customer_response) return { ok: false, error: "A response has already been recorded for this quote." };
    if (v.valid_until && v.valid_until < today()) return { ok: false, error: "This quote has expired. Please contact us for an updated quote." };
    if (data.action === "accepted" && (!data.termsAccepted || data.name.length < 2)) return { ok: false, error: "Please type your name and confirm the terms to accept." };
    if (data.action === "changes_requested" && data.note.length < 5) return { ok: false, error: "Tell us what you'd like changed." };
    const sb = c.supabaseAdmin;
    const now = new Date().toISOString();
    const upd = await sb.from("pricing_quote_versions").update({
      customer_response: data.action, responded_at: now, response_terms_accepted: data.action === "accepted",
      response_note: [data.action === "accepted" ? `Accepted by ${data.name}` : "", data.note].filter(Boolean).join(" — ") || null,
    }).eq("id", v.id).is("customer_response", null);
    if (upd.error) return { ok: false, error: "We couldn't record your response. Please try again." };
    const status = data.action === "accepted" ? "accepted" : data.action === "declined" ? "declined" : "more_info_needed";
    await sb.from("pricing_quote_requests").update({ status, status_changed_at: now }).eq("id", v.quote_id);
    await sb.from("pricing_quote_activity").insert({ quote_id: v.quote_id, actor_type: "customer", kind: `customer_${data.action}`, detail: { version: v.version, total_minor: v.total_minor, note: data.note || null } });
    return { ok: true };
  });
