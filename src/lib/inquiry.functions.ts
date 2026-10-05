import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ATTACH_MAX, BUDGET_OPTIONS, SERVICE_OPTIONS, TIMELINE_OPTIONS } from "./inquiry";

export type FormResult = { ok: true; bookingReference?: string; status?: string } | { ok: false; error: string; fields?: Record<string, string> };

const phone = z.string().trim().max(40).refine((v) => !v || /^[+\d\s().-]{6,}$/.test(v), "Use digits, spaces, + ( ) -");
const optUrl = z.string().trim().max(500).refine((v) => !v || /^https?:\/\/[^\s"<>]+$/.test(v), "Enter a full link starting with https://");
const base = {
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone,
  company: z.string().trim().max(120),
  hp_field: z.string().max(0).optional(),
  started_at: z.coerce.number(),
};

function fieldErrors(err: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const i of err.issues) fields[String(i.path[0])] ??= i.message;
  return fields;
}

async function context(scope: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { createHash, randomUUID } = await import("crypto");
  const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256").update(`branta-${scope}:${ip}`).digest("hex");
  // Optional signed-in user: the token is verified with Supabase Auth, never trusted as-is.
  let userId: string | null = null;
  const auth = getRequestHeader("authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    userId = data.user?.id ?? null;
  }
  return { supabaseAdmin, ipHash, userId, randomUUID };
}

function sniff(b: Uint8Array): "pdf" | "png" | "jpg" | "docx" | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "docx";
  return null;
}
const CT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

const LeadFields = z.object({
  ...base,
  website: optUrl,
  services: z.array(z.enum(SERVICE_OPTIONS)).min(1, "Choose at least one"),
  project_summary: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(5000),
  budget_range: z.enum(BUDGET_OPTIONS).or(z.literal("")),
  budget_note: z.string().trim().max(200),
  timeline: z.enum(TIMELINE_OPTIONS).or(z.literal("")),
  reference_links: z.string().max(2000),
  consent: z.literal("on", { message: "Please confirm so we can contact you" }),
});

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Invalid form");
    return d;
  })
  .handler(async ({ data }): Promise<FormResult> => {
    const raw: Record<string, unknown> = Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === "string"));
    raw["services"] = data.getAll("services").filter((v) => typeof v === "string");
    const parsed = LeadFields.safeParse(raw);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      if (fields["hp_field"] || fields["started_at"]) return { ok: false, error: "We couldn't send your request. Please try again." };
      return { ok: false, error: "Please check the highlighted fields.", fields };
    }
    const f = parsed.data;
    if (Date.now() - f.started_at < 3000) return { ok: false, error: "That was quick — please review your request and send it again." };
    const links = f.reference_links.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (links.length > 10 || links.some((l) => !/^https?:\/\/[^\s"<>]+$/.test(l) || l.length > 500)) return { ok: false, error: "Please check the highlighted fields.", fields: { reference_links: "Use full links starting with https://, one per line (up to 10)" } };

    const file = data.get("attachment");
    let bytes: Uint8Array | null = null;
    let kind: keyof typeof CT | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > ATTACH_MAX) return { ok: false, error: "Your file is too large.", fields: { attachment: "Maximum size is 10 MB" } };
      bytes = new Uint8Array(await file.arrayBuffer());
      kind = sniff(bytes);
      if (!kind) return { ok: false, error: "That file type isn't accepted.", fields: { attachment: "Use a PDF, PNG, JPG or DOCX file" } };
    }

    const { supabaseAdmin, ipHash, userId, randomUUID } = await context("leads");
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [byIp, byEmail] = await Promise.all([
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).ilike("email", f.email).gte("created_at", hourAgo),
    ]);
    if ((byIp.count ?? 0) >= 5 || (byEmail.count ?? 0) >= 3) return { ok: false, error: "We've received several requests from you already. Please try again later." };

    const id = randomUUID();
    let attachment_path: string | null = null;
    if (bytes && kind && file instanceof File) {
      attachment_path = `leads/${id}/${randomUUID()}.${kind}`;
      const up = await supabaseAdmin.storage.from("client-private").upload(attachment_path, bytes, { contentType: CT[kind], upsert: false });
      if (up.error) {
        console.error("lead attachment upload failed", up.error.message);
        return { ok: false, error: "We couldn't upload your file. Please try again." };
      }
    }
    const n = (v: string) => (v ? v : null);
    const budget = [f.budget_range, f.budget_note].filter(Boolean).join(" — ");
    const ins = await supabaseAdmin.from("leads").insert({
      id, client_user_id: userId, name: f.name, email: f.email, phone: n(f.phone), company: n(f.company), website: n(f.website),
      service_interest: f.services, project_summary: f.project_summary, budget_range: n(budget), timeline: n(f.timeline),
      reference_links: links, attachment_path, attachment_name: attachment_path && file instanceof File ? file.name.slice(0, 200) : null,
      source: "start_a_project", ip_hash: ipHash,
    });
    if (ins.error) {
      console.error("lead insert failed", ins.error.message);
      return { ok: false, error: "We couldn't send your request. Please try again." };
    }
    // Email hook: send confirmation here once a transactional email provider is configured.
    return { ok: true };
  });

const BookingFields = z.object({
  ...base,
  topic: z.string().trim().min(3, "Tell us what you'd like to discuss").max(300),
  requested_start_at: z.string().datetime({ offset: true, message: "Choose a date and time" }),
  timezone: z.string().trim().min(1).max(64).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Choose a valid timezone"),
  notes: z.string().trim().max(2000),
  services: z.array(z.string().trim().min(1).max(120)).min(1, "Choose at least one service").max(10),
});

export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as Record<string, string>)
  .handler(async ({ data }): Promise<FormResult> => {
    const parsed = BookingFields.safeParse(data);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      if (fields["hp_field"] || fields["started_at"]) return { ok: false, error: "We couldn't send your request. Please try again." };
      return { ok: false, error: "Please check the highlighted fields.", fields };
    }
    const f = parsed.data;
    if (Date.now() - f.started_at < 3000) return { ok: false, error: "That was quick — please review your request and send it again." };
    const when = new Date(f.requested_start_at).getTime();
    if (when < Date.now() + 30 * 60_000 || when > Date.now() + 365 * 86400_000) return { ok: false, error: "Please check the highlighted fields.", fields: { date: "Choose a time at least 30 minutes from now and within a year" } };

    const { supabaseAdmin, ipHash, userId, randomUUID } = await context("bookings");
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [byIp, byEmail] = await Promise.all([
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).ilike("email", f.email).gte("created_at", hourAgo),
    ]);
    if ((byIp.count ?? 0) >= 5 || (byEmail.count ?? 0) >= 3) return { ok: false, error: "We've received several requests from you already. Please try again later." };

    const n = (v: string) => (v ? v : null);
    const [{ data: setting }, { data: published }] = await Promise.all([
      supabaseAdmin.from("site_settings").select("settings").eq("setting_group", "booking").maybeSingle(),
      supabaseAdmin.from("services").select("name").eq("status", "published"),
    ]);
    const cfg = (setting?.settings && typeof setting.settings === "object" && !Array.isArray(setting.settings) ? setting.settings : {}) as Record<string, unknown>;
    const enabled = Array.isArray(cfg["services"]) ? cfg["services"].filter((v): v is string => typeof v === "string") : [];
    const allowed = new Set([...(published ?? []).map((s) => s.name), ...(enabled.includes("Something Else") ? ["Something Else"] : [])]);
    if (f.services.some((s) => !allowed.has(s))) return { ok: false, error: "Please check the highlighted fields.", fields: { services: "Choose a currently available service" } };
    const duration = Number.isInteger(Number(cfg["duration_minutes"])) ? Math.min(180, Math.max(15, Number(cfg["duration_minutes"]))) : 30;
    const ref = `BR-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const ins = await supabaseAdmin.from("bookings").insert({
      client_user_id: userId, name: f.name, email: f.email, phone: n(f.phone), company: n(f.company), topic: f.topic,
      requested_start_at: new Date(when).toISOString(), timezone: f.timezone, notes: n(f.notes), ip_hash: ipHash,
      service_interest: f.services, duration_minutes: duration, booking_reference: ref,
      status: cfg["instant_confirmation"] === true ? "confirmed" : "requested",
    }).select("booking_reference,status").single();
    if (ins.error) {
      if (ins.error.code === "23505" || ins.error.code === "23P01") return { ok: false, error: "That time was just taken. Please choose another available time.", fields: { time: "This time is no longer available" } };
      console.error("booking insert failed", ins.error.message);
      return { ok: false, error: "We couldn't send your request. Please try again." };
    }
    return { ok: true, bookingReference: ins.data.booking_reference, status: ins.data.status };
  });
