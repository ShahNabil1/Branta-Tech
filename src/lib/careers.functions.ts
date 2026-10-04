import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const RESUME_MAX = 5 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const optUrl = z.string().trim().max(500).refine((v) => !v || /^https?:\/\/[^\s"<>]+$/.test(v), "Enter a full link starting with https://");
const Fields = z.object({
  job_slug: z.string().trim().min(1).max(120),
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.string().trim().min(6, "Enter a phone number").max(40).regex(/^[+\d\s().-]+$/, "Use digits, spaces, + ( ) -"),
  location: z.string().trim().max(120),
  portfolio_url: optUrl,
  linkedin_url: optUrl,
  cover_note: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(4000),
  website: z.string().max(0).optional(), // honeypot
  started_at: z.coerce.number(),
});

export type ApplyResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

/** Detects PDF / DOC / DOCX by magic bytes (the browser's MIME type is not trusted). */
function sniff(b: Uint8Array): "pdf" | "doc" | "docx" | null {
  const h = (n: number) => b[n];
  if (h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46) return "pdf";
  if (h(0) === 0xd0 && h(1) === 0xcf && h(2) === 0x11 && h(3) === 0xe0) return "doc";
  if (h(0) === 0x50 && h(1) === 0x4b && h(2) === 0x03 && h(3) === 0x04) return "docx";
  return null;
}
const CT = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

/**
 * Public job application. Validates on the server, checks the job is published, rate-limits by
 * email and IP, stores the CV in the private career-private bucket and inserts the application
 * with the service role. Nothing private is returned.
 */
export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Invalid form");
    return d;
  })
  .handler(async ({ data }): Promise<ApplyResult> => {
    const raw = Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === "string"));
    const parsed = Fields.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
      if (fields["website"] || fields["started_at"]) return { ok: false, error: "We couldn't send your application. Please try again." };
      return { ok: false, error: "Please check the highlighted fields.", fields };
    }
    const f = parsed.data;
    if (Date.now() - f.started_at < 3000) return { ok: false, error: "That was quick — please review your application and send it again." };

    const file = data.get("resume");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Please attach your CV.", fields: { resume: "Attach a PDF, DOC or DOCX file" } };
    if (file.size > RESUME_MAX) return { ok: false, error: "Your CV is too large.", fields: { resume: "Maximum size is 5 MB" } };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    const ext = file.name.toLowerCase().split(".").pop();
    if (!kind || (ext !== kind && !(kind === "docx" && ext === "docx"))) return { ok: false, error: "That file type isn't accepted.", fields: { resume: "Use a PDF, DOC or DOCX file" } };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { createHash, randomUUID } = await import("crypto");
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(`branta-careers:${ip}`).digest("hex");

    const { data: job } = await supabaseAdmin.from("jobs").select("id").eq("slug", f.job_slug).eq("status", "published").maybeSingle();
    if (!job) return { ok: false, error: "This role is no longer open." };

    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const [byIp, byEmail] = await Promise.all([
      supabaseAdmin.from("job_applications").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("submitted_at", hourAgo),
      supabaseAdmin.from("job_applications").select("id", { count: "exact", head: true }).ilike("email", f.email).eq("job_id", job.id).gte("submitted_at", dayAgo),
    ]);
    if ((byIp.count ?? 0) >= 5) return { ok: false, error: "Too many applications from this connection. Please try again later." };
    if ((byEmail.count ?? 0) >= 1) return { ok: false, error: "We've already received your application for this role. We'll be in touch." };

    const path = `${job.id}/${randomUUID()}.${kind}`;
    const up = await supabaseAdmin.storage.from("career-private").upload(path, bytes, { contentType: CT[kind], upsert: false });
    if (up.error) {
      console.error("resume upload failed", up.error.message);
      return { ok: false, error: "We couldn't upload your CV. Please try again." };
    }
    const n = (v: string) => (v ? v : null);
    const ins = await supabaseAdmin.from("job_applications").insert({
      job_id: job.id, full_name: f.full_name, email: f.email.toLowerCase(), phone: f.phone, location: n(f.location),
      portfolio_url: n(f.portfolio_url), linkedin_url: n(f.linkedin_url), cover_note: f.cover_note, resume_url: path, ip_hash: ipHash,
    });
    if (ins.error) {
      console.error("application insert failed", ins.error.message);
      await supabaseAdmin.storage.from("career-private").remove([path]);
      return { ok: false, error: "We couldn't send your application. Please try again." };
    }
    return { ok: true };
  });
