import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { applicationWindow, parseDetails, COLUMN_KEYS, FILE_KEYS, RECORD_KEYS, type FormKey, type JobDetails } from "./job-details";
import { RecordsSchema, emptyRecords, recordErrors, DOC_KEYS, type Records } from "./application-records";

export const RESUME_MAX = 5 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const Fields = z.object({
  job_slug: z.string().trim().min(1).max(120),
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  website: z.string().max(0).optional(), // honeypot
  started_at: z.coerce.number(),
});


const ATT_MAX = 5 * 1024 * 1024;
const ATT_CT: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
function sniffAtt(b: Uint8Array): "pdf" | "png" | "jpg" | "webp" | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}
const urlOk = (v: string) => /^https?:\/\/[^\s"<>]+$/.test(v);
const TEXT_MAX: Partial<Record<FormKey, number>> = { phone: 40, location: 200, city: 120, country: 80, dob: 10, gender: 40, current_status: 40, cover_note: 4000, expected_salary: 80, current_salary: 80, current_company: 160, current_position: 160, notice_period: 80, joining_date: 20 };
type Att = { key: string; ext: string; bytes: Uint8Array };

/** Validates the job's configured form fields + custom questions (server-side source of truth). */
async function checkConfiguredFields(fd: FormData, det: JobDetails): Promise<{ fields: Record<string, string> } | { values: Partial<Record<FormKey, string>>; answers: Record<string, string | string[]>; files: Att[]; records: Records }> {
  const fields: Record<string, string> = {};
  const values: Partial<Record<FormKey, string>> = {};
  const files: Att[] = [];
  const readFile = async (name: string, key: string, imagesOnly: boolean, required: boolean) => {
    const f = fd.get(name);
    if (!(f instanceof File) || f.size === 0) { if (required) fields[key] = "Please attach a file"; return; }
    if (f.size > ATT_MAX) { fields[key] = "Maximum size is 5 MB"; return; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const ext = sniffAtt(bytes);
    if (!ext || (imagesOnly && ext === "pdf")) { fields[key] = imagesOnly ? "Use a PNG, JPG or WEBP image" : "Use a PDF, PNG, JPG or WEBP file"; return; }
    files.push({ key, ext, bytes });
  };
  let records: Records = emptyRecords();
  try {
    const p = RecordsSchema.safeParse(JSON.parse(String(fd.get("records") ?? "{}")));
    if (p.success) records = p.data; else fields["records"] = "Some entries couldn't be read";
  } catch { fields["records"] = "Some entries couldn't be read"; }
  const on = (k: FormKey) => det.form.find((x) => x.key === k && x.enabled);
  if (!on("education")) records.education = [];
  if (!on("experience")) { records.experience = []; records.has_experience = ""; }
  if (records.has_experience === "no") records.experience = [];
  if (!on("skills")) records.skills = [];
  if (!on("languages")) records.languages = [];
  Object.assign(fields, recordErrors(records));
  for (const c of det.form.filter((x) => x.enabled && x.key !== "resume")) {
    if (RECORD_KEYS.includes(c.key)) {
      if (!c.required) continue;
      if (c.key === "education" && !records.education.length) fields["education"] = "Add at least one education record";
      if (c.key === "experience" && (!records.has_experience || (records.has_experience === "yes" && !records.experience.length))) fields["experience"] = "Tell us about your work experience";
      if (c.key === "skills" && !records.skills.length) fields["skills"] = "Add at least one skill";
      if (c.key === "languages" && !records.languages.length) fields["languages"] = "Add at least one language";
      continue;
    }
    if (FILE_KEYS.includes(c.key)) { await readFile(`file_${c.key}`, c.key, c.key === "photo", c.required); continue; }
    const raw = String(fd.get(c.key) ?? "").trim().slice(0, TEXT_MAX[c.key] ?? 500);
    if (!raw) { if (c.required) fields[c.key] = "This field is required"; continue; }
    if (c.key.endsWith("_url") && !urlOk(raw)) { fields[c.key] = "Enter a full link starting with https://"; continue; }
    if (c.key === "phone" && (raw.length < 6 || !/^[+\d\s().-]+$/.test(raw))) { fields[c.key] = "Use digits, spaces, + ( ) -"; continue; }
    if ((c.key === "joining_date" || c.key === "dob") && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) { fields[c.key] = "Choose a date"; continue; }
    values[c.key] = raw;
  }
  const answers: Record<string, string | string[]> = {};
  for (const q of det.questions.filter((x) => x.enabled)) {
    const key = `q_${q.id}`;
    if (q.type === "file") { await readFile(`qf_${q.id}`, key, false, q.required); continue; }
    if (q.type === "multi") {
      const vals = fd.getAll(key).map(String).filter((x) => q.options.includes(x));
      if (!vals.length && q.required) fields[key] = "Choose at least one"; else if (vals.length) answers[q.id] = vals;
      continue;
    }
    const raw = String(fd.get(key) ?? "").trim().slice(0, q.type === "long" ? 4000 : 500);
    if (!raw) { if (q.required) fields[key] = "This question is required"; continue; }
    const opts = q.type === "yesno" ? ["Yes", "No"] : q.options;
    if (["yesno", "single", "dropdown"].includes(q.type) && !opts.includes(raw)) { fields[key] = "Choose an option"; continue; }
    if (q.type === "number" && !Number.isFinite(Number(raw))) { fields[key] = "Enter a number"; continue; }
    if (q.type === "url" && !urlOk(raw)) { fields[key] = "Enter a full link starting with https://"; continue; }
    if (q.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) { fields[key] = "Choose a date"; continue; }
    answers[q.id] = raw;
  }
  return Object.keys(fields).length ? { fields } : { values, answers, files, records };
}

export type ApplyResult = { ok: true; id: string } | { ok: false; error: string; fields?: Record<string, string>; duplicateId?: string; signIn?: boolean };

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization");
    const who = auth?.startsWith("Bearer ") ? (await supabaseAdmin.auth.getUser(auth.slice(7))).data.user : null;
    if (!who) return { ok: false, error: "Please sign in to apply.", signIn: true };
    if (Date.now() - f.started_at < 3000) return { ok: false, error: "That was quick — please review your application and send it again." };

    const useSaved = data.get("use_saved") === "1";
    const file = data.get("resume");
    let bytes: Uint8Array | null = null;
    let kind: "pdf" | "doc" | "docx" | null = null;
    const hasFile = file instanceof File && file.size > 0;
    if (!useSaved && hasFile) {
      if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Please attach your CV.", fields: { resume: "Attach a PDF, DOC or DOCX file" } };
      if (file.size > RESUME_MAX) return { ok: false, error: "Your CV is too large.", fields: { resume: "Maximum size is 5 MB" } };
      bytes = new Uint8Array(await file.arrayBuffer());
      kind = sniff(bytes);
      const ext = file.name.toLowerCase().split(".").pop();
      if (!kind || ext !== kind) return { ok: false, error: "That file type isn't accepted.", fields: { resume: "Use a PDF, DOC or DOCX file" } };
    }

    const { createHash, randomUUID } = await import("crypto");
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(`branta-careers:${ip}`).digest("hex");

    const { data: job } = await supabaseAdmin.from("jobs").select("id,status,open_at,deadline_at,details").eq("slug", f.job_slug).eq("status", "published").maybeSingle();
    if (!job) return { ok: false, error: "This role is no longer open." };
    const det = parseDetails(job.details);
    if (det.application.method !== "form" || applicationWindow(job, det) !== "open") return { ok: false, error: "Applications for this role are closed." };
    const checked = await checkConfiguredFields(data, det);
    if ("fields" in checked) return { ok: false, error: "Please check the highlighted fields.", fields: checked.fields };
    const resumeOn = det.form.find((x) => x.key === "resume");

    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const [byIp, byUser, existing] = await Promise.all([
      supabaseAdmin.from("job_applications").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("submitted_at", hourAgo),
      supabaseAdmin.from("job_applications").select("id", { count: "exact", head: true }).eq("applicant_user_id", who.id).gte("submitted_at", dayAgo),
      supabaseAdmin.from("job_applications").select("id").eq("job_id", job.id).eq("applicant_user_id", who.id).neq("status", "withdrawn").maybeSingle(),
    ]);
    if (existing.data) return { ok: false, error: "Application already submitted", duplicateId: existing.data.id };
    if ((byIp.count ?? 0) >= 5 || (byUser.count ?? 0) >= 10) return { ok: false, error: "Too many applications right now. Please try again later." };

    const wantResume = !!resumeOn?.enabled;
    if (wantResume && resumeOn!.required && !useSaved && !hasFile) return { ok: false, error: "Please attach your CV.", fields: { resume: "Attach a PDF, DOC or DOCX file" } };
    let path: string | null = null;
    const uploaded: string[] = [];
    if (wantResume && useSaved && !hasFile) {
      const copied = await copySavedResume(supabaseAdmin, who.id, job.id);
      if (!copied) return { ok: false, error: "Your saved CV couldn't be attached. Please upload one.", fields: { resume: "Attach a PDF, DOC or DOCX file" } };
      path = copied;
    } else if (wantResume && hasFile) {
      path = `${job.id}/${randomUUID()}.${kind}`;
      const up = await supabaseAdmin.storage.from("career-private").upload(path, bytes!, { contentType: CT[kind!], upsert: false });
      if (up.error) {
        console.error("resume upload failed", up.error.message);
        return { ok: false, error: "We couldn't upload your CV. Please try again." };
      }
    }
    if (path) uploaded.push(path);
    // Extra attachments (portfolio, photo, file questions) — already sniffed by checkConfiguredFields.
    const filesOut: Record<string, string> = {};
    for (const att of checked.files) {
      const p = `${job.id}/${randomUUID()}-att.${att.ext}`;
      const up = await supabaseAdmin.storage.from("career-private").upload(p, att.bytes, { contentType: ATT_CT[att.ext] ?? "application/octet-stream", upsert: false });
      if (up.error) { await supabaseAdmin.storage.from("career-private").remove(uploaded); return { ok: false, error: "We couldn't upload your files. Please try again." }; }
      uploaded.push(p); filesOut[att.key] = p;
    }
    const v = checked.values;
    const answers: Record<string, { label: string; value: string | string[] }> = {};
    let eligible: boolean | null = null;
    for (const q of det.questions.filter((x) => x.enabled)) {
      const val = q.type === "file" ? filesOut[`q_${q.id}`] ?? "" : checked.answers[q.id] ?? "";
      if (val === "" || (Array.isArray(val) && !val.length)) continue;
      answers[q.id] = { label: q.label, value: q.type === "file" ? `file:${val}` : val };
      if (q.eligibility && q.eligible_answer.trim()) {
        const ok = Array.isArray(val) ? val.includes(q.eligible_answer.trim()) : String(val).trim().toLowerCase() === q.eligible_answer.trim().toLowerCase();
        eligible = (eligible ?? true) && ok;
      }
    }
    if (eligible === null && det.questions.some((q) => q.enabled && q.eligibility && q.eligible_answer.trim())) eligible = false;
    const extra: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) if (val && !COLUMN_KEYS.includes(k as FormKey)) extra[k] = val;
    for (const k of DOC_KEYS) if (filesOut[k]) extra[k] = filesOut[k];
    const rec = checked.records;
    if (rec.education.length) extra["education_records"] = rec.education;
    if (rec.has_experience) extra["has_experience"] = rec.has_experience;
    if (rec.experience.length) extra["experience_records"] = rec.experience;
    if (rec.skills.length) extra["skills"] = rec.skills;
    if (rec.languages.length) extra["languages"] = rec.languages;
    const n = (s?: string) => (s ? s : null);
    const ins = await supabaseAdmin.from("job_applications").insert({
      job_id: job.id, full_name: f.full_name, email: f.email.toLowerCase(), phone: v.phone ?? "", location: n(v.location),
      portfolio_url: n(v.portfolio_url), linkedin_url: n(v.linkedin_url), cover_note: v.cover_note ?? "", resume_url: path, ip_hash: ipHash, applicant_user_id: who.id,
      answers, extra, eligibility_passed: eligible,
      ...(eligible === false && det.application.auto_reject ? { status: "rejected" } : {}),
    } as never).select("id").single();
    if (ins.error) {
      if (uploaded.length) await supabaseAdmin.storage.from("career-private").remove(uploaded);
      if (ins.error.code === "23505") {
        const again = await supabaseAdmin.from("job_applications").select("id").eq("job_id", job.id).eq("applicant_user_id", who.id).neq("status", "withdrawn").maybeSingle();
        return { ok: false, error: "Application already submitted", ...(again.data ? { duplicateId: again.data.id } : {}) };
      }
      console.error("application insert failed", ins.error.message);
      return { ok: false, error: "We couldn't send your application. Please try again." };
    }
    return { ok: true, id: (ins.data as { id: string }).id };
  });

/** Short-lived download link for the caller's own CV on one of their applications. */
export const getMyResumeLink = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization");
    const who = auth?.startsWith("Bearer ") ? (await supabaseAdmin.auth.getUser(auth.slice(7))).data.user : null;
    if (!who) return { url: null };
    const { data: row } = await supabaseAdmin.from("job_applications").select("resume_url, applicant_user_id").eq("id", data.id).maybeSingle();
    const r = row as { resume_url: string | null; applicant_user_id: string | null } | null;
    if (!r || r.applicant_user_id !== who.id || !r.resume_url) return { url: null };
    const { data: s } = await supabaseAdmin.storage.from("career-private").createSignedUrl(r.resume_url, 300, { download: true });
    return { url: s?.signedUrl ?? null };
  });

// ---------- Applicant current resume (career-private/profiles/<uid>/...) ----------
async function caller() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const auth = getRequestHeader("authorization");
  const who = auth?.startsWith("Bearer ") ? (await supabaseAdmin.auth.getUser(auth.slice(7))).data.user : null;
  return { supabaseAdmin, who };
}
export type MyResume = { file_name: string; file_size: number; uploaded_at: string } | null;
type ResumeRow = { file_path: string; file_name: string; file_size: number; content_type: string; uploaded_at: string };
const safeName = (s: string) => s.replace(/[^\w .()-]+/g, "_").slice(0, 200) || "resume";

export const getMyResume = createServerFn({ method: "GET" }).handler(async (): Promise<MyResume> => {
  const { supabaseAdmin, who } = await caller();
  if (!who) return null;
  const { data } = await supabaseAdmin.from("applicant_resumes" as never).select("file_name, file_size, uploaded_at").eq("user_id", who.id).maybeSingle();
  return (data as MyResume) ?? null;
});

export const uploadMyResume = createServerFn({ method: "POST" })
  .inputValidator((d: FormData) => { if (!(d instanceof FormData)) throw new Error("Invalid form"); return d; })
  .handler(async ({ data }): Promise<{ ok: true; resume: MyResume } | { ok: false; error: string }> => {
    const { supabaseAdmin, who } = await caller();
    if (!who) return { ok: false, error: "Please sign in again." };
    const file = data.get("resume");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF, DOC or DOCX file." };
    if (file.size > RESUME_MAX) return { ok: false, error: "Maximum size is 5 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    const ext = file.name.toLowerCase().split(".").pop();
    if (!kind || ext !== kind) return { ok: false, error: "Only real PDF, DOC or DOCX files are accepted." };
    const { randomUUID } = await import("crypto");
    const path = `profiles/${who.id}/${randomUUID()}.${kind}`;
    const up = await supabaseAdmin.storage.from("career-private").upload(path, bytes, { contentType: CT[kind], upsert: false });
    if (up.error) return { ok: false, error: "Upload failed. Please try again." };
    const { data: old } = await supabaseAdmin.from("applicant_resumes" as never).select("file_path").eq("user_id", who.id).maybeSingle();
    const row = { user_id: who.id, file_path: path, file_name: safeName(file.name), file_size: file.size, content_type: CT[kind], uploaded_at: new Date().toISOString() };
    const res = await supabaseAdmin.from("applicant_resumes" as never).upsert(row as never);
    if (res.error) { await supabaseAdmin.storage.from("career-private").remove([path]); return { ok: false, error: "Upload failed. Please try again." }; }
    const oldPath = (old as { file_path: string } | null)?.file_path;
    if (oldPath && oldPath.startsWith(`profiles/${who.id}/`)) await supabaseAdmin.storage.from("career-private").remove([oldPath]);
    return { ok: true, resume: { file_name: row.file_name, file_size: row.file_size, uploaded_at: row.uploaded_at } };
  });

export const getMyCurrentResumeLink = createServerFn({ method: "POST" }).handler(async (): Promise<{ url: string | null }> => {
  const { supabaseAdmin, who } = await caller();
  if (!who) return { url: null };
  const { data } = await supabaseAdmin.from("applicant_resumes" as never).select("file_path, file_name").eq("user_id", who.id).maybeSingle();
  const r = data as { file_path: string; file_name: string } | null;
  if (!r || !r.file_path.startsWith(`profiles/${who.id}/`)) return { url: null };
  const { data: s } = await supabaseAdmin.storage.from("career-private").createSignedUrl(r.file_path, 300, { download: r.file_name });
  return { url: s?.signedUrl ?? null };
});

export const removeMyResume = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: boolean }> => {
  const { supabaseAdmin, who } = await caller();
  if (!who) return { ok: false };
  const { data } = await supabaseAdmin.from("applicant_resumes" as never).select("file_path").eq("user_id", who.id).maybeSingle();
  const p = (data as { file_path: string } | null)?.file_path;
  await supabaseAdmin.from("applicant_resumes" as never).delete().eq("user_id", who.id);
  if (p && p.startsWith(`profiles/${who.id}/`)) await supabaseAdmin.storage.from("career-private").remove([p]);
  return { ok: true };
});

/** Copies the applicant's saved resume into an application-owned file so later replacements never alter it. */
async function copySavedResume(supabaseAdmin: Awaited<ReturnType<typeof caller>>["supabaseAdmin"], uid: string, jobId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("applicant_resumes" as never).select("*").eq("user_id", uid).maybeSingle();
  const r = data as ResumeRow | null;
  if (!r || !r.file_path.startsWith(`profiles/${uid}/`)) return null;
  const { randomUUID } = await import("crypto");
  const dest = `${jobId}/${randomUUID()}.${r.file_path.split(".").pop()}`;
  const cp = await supabaseAdmin.storage.from("career-private").copy(r.file_path, dest);
  return cp.error ? null : dest;
}
