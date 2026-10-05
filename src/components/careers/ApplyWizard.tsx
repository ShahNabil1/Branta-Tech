/**
 * Multi-step job application. Steps come from the job's form config (WIZARD_STEPS + questions + review);
 * text progress autosaves to application_drafts (own row); files are kept in memory only.
 * submitApplication on the server remains the source of truth for validation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/brand-button";
import { supabase } from "@/integrations/supabase/client";
import { RESUME_ACCEPT, RESUME_MAX, submitApplication, type MyResume } from "@/lib/careers.functions";
import type { Job } from "@/lib/company.functions";
import {
  CURRENT_STATUSES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, FILE_KEYS, FORM_LABEL, GENDERS, PROFICIENCY, RECORD_KEYS, SKILL_LEVELS, WIZARD_STEPS,
  type FormKey, type PublicQuestion,
} from "@/lib/job-details";
import { DOC_LABEL, RecordsSchema, emptyEducation, emptyExperience, emptyRecords, recordErrors, yearSpan, type Records } from "@/lib/application-records";
import { cn } from "@/lib/utils";

export const fieldCls = "w-full rounded-sm border border-input bg-surface px-3 text-body outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring";
const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const IMG_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const fileCls = "text-small block w-full file:mr-4 file:rounded-sm file:border file:border-input file:bg-surface file:px-3 file:py-2 file:text-foreground";
const URL_RE = /^https?:\/\/[^\s"<>]+$/;

export function Field({ id, label, required, error, hint, children, className }: { id: string; label: string; required?: boolean; error?: string | undefined; hint?: string | undefined; children: React.ReactNode; className?: string | undefined }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-small mb-1.5 block font-medium text-foreground">{label}{required ? <span aria-hidden className="text-accent"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}</label>
      {children}
      {error ? <p id={`${id}-err`} className="text-caption mt-1 text-destructive">{error}</p> : hint ? <p className="text-caption mt-1 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type Answers = Record<string, string | string[]>;
type Draft = { vals: Record<string, string>; answers: Answers; rec: Records };
type Step = { id: string; title: string; keys: FormKey[] };
const INPUT: Partial<Record<FormKey, { type?: string; auto?: string; area?: boolean; ph?: string; options?: string[] }>> = {
  phone: { type: "tel", auto: "tel" }, location: { auto: "street-address" }, city: { auto: "address-level2" }, country: { auto: "country-name" }, dob: { type: "date", auto: "bday" },
  gender: { options: GENDERS }, current_status: { options: CURRENT_STATUSES },
  linkedin_url: { type: "url", ph: "https://linkedin.com/in/…" }, portfolio_url: { type: "url", ph: "https://" }, website_url: { type: "url", ph: "https://" }, github_url: { type: "url", ph: "https://github.com/…" }, behance_url: { type: "url", ph: "https://behance.net/…" },
  current_company: { auto: "organization" }, current_position: { auto: "organization-title" }, joining_date: { type: "date" }, cover_note: { area: true },
};

export function ApplyWizard({ job, jobId, prefill, email, saved, userId, onDone }: {
  job: Job; jobId: string | null; prefill: Record<string, string>; email: string; saved: MyResume; userId: string; onDone: (id: string) => void;
}) {
  const submit = useServerFn(submitApplication);
  const started = useRef(Date.now());
  const enabled = useMemo(() => new Map(job.details.form.filter((x) => x.enabled).map((x) => [x.key, x.required])), [job]);
  const steps: Step[] = useMemo(() => {
    const s: Step[] = WIZARD_STEPS.map((w) => ({ ...w, keys: w.keys.filter((k) => enabled.has(k)) })).filter((w) => w.id === "personal" || w.keys.length);
    if (job.questions.length) s.push({ id: "questions", title: "Job Questions", keys: [] });
    s.push({ id: "review", title: "Review & Submit", keys: [] });
    return s;
  }, [enabled, job.questions.length]);

  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, string>>(() => ({ ...prefill, email, full_name: prefill["full_name"] ?? "" }));
  const [answers, setAnswers] = useState<Answers>({});
  const [rec, setRec] = useState<Records>(emptyRecords());
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "restored">("idle");
  const loaded = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  // Restore a saved draft once.
  useEffect(() => {
    if (!jobId) { loaded.current = true; return; }
    void (async () => {
      const { data } = await supabase.from("application_drafts" as never).select("data, step").eq("user_id", userId).eq("job_id", jobId).maybeSingle();
      const d = data as { data: Partial<Draft>; step: number } | null;
      if (d?.data) {
        if (d.data.vals) setVals((v) => ({ ...v, ...d.data.vals, email }));
        if (d.data.answers) setAnswers(d.data.answers);
        const r = RecordsSchema.safeParse(d.data.rec ?? {});
        if (r.success) setRec(r.data);
        setI(Math.min(Math.max(0, d.step), steps.length - 1));
        setDraftState("restored");
      }
      loaded.current = true;
    })();
  }, [jobId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave text progress (debounced).
  useEffect(() => {
    if (!loaded.current || !jobId) return;
    const t = setTimeout(async () => {
      setDraftState("saving");
      const { error: e } = await supabase.from("application_drafts" as never).upsert({ user_id: userId, job_id: jobId, data: { vals, answers, rec }, step: i } as never);
      setDraftState(e ? "idle" : "saved");
    }, 1200);
    return () => clearTimeout(t);
  }, [vals, answers, rec, i, jobId, userId]);

  const set = (k: string, v: string) => { setVals((s) => ({ ...s, [k]: v })); setErrs((e) => ({ ...e, [k]: "" })); };
  const req = (k: FormKey) => !!enabled.get(k);
  const step = steps[i]!;

  function validate(s: Step): Record<string, string> {
    const e: Record<string, string> = {};
    if (s.id === "personal") {
      if ((vals["full_name"] ?? "").trim().length < 2) e["full_name"] = "Enter your full name";
      if (!/^\S+@\S+\.\S+$/.test(vals["email"] ?? "")) e["email"] = "Enter a valid email";
    }
    const re = recordErrors(rec);
    for (const k of s.keys) {
      const r = req(k);
      if (RECORD_KEYS.includes(k)) {
        const pre = `${k}.`;
        for (const [ek, ev] of Object.entries(re)) if (ek.startsWith(pre) && (k !== "experience" || rec.has_experience === "yes")) e[ek] = ev;
        if (r && k === "education" && !rec.education.length) e["education"] = "Add at least one education record";
        if (r && k === "experience" && (!rec.has_experience || (rec.has_experience === "yes" && !rec.experience.length))) e["experience"] = rec.has_experience ? "Add at least one experience" : "Choose Yes or No";
        if (r && k === "skills" && !rec.skills.length) e["skills"] = "Add at least one skill";
        if (r && k === "languages" && !rec.languages.length) e["languages"] = "Add at least one language";
        continue;
      }
      if (k === "resume") { if (r && !files["resume"] && !saved) e["resume"] = "Attach your CV"; continue; }
      if (FILE_KEYS.includes(k)) { if (r && !files[k]) e[k] = "Please attach a file"; continue; }
      const v = (vals[k] ?? "").trim();
      if (!v) { if (r) e[k] = "This field is required"; continue; }
      if (k.endsWith("_url") && !URL_RE.test(v)) e[k] = "Enter a full link starting with https://";
      if (k === "phone" && (v.length < 6 || !/^[+\d\s().-]+$/.test(v))) e[k] = "Use digits, spaces, + ( ) -";
    }
    if (s.id === "questions") for (const q of job.questions) {
      const a = answers[q.id]; const empty = q.type === "file" ? !files[`qf_${q.id}`] : !a || (Array.isArray(a) ? !a.length : !a.trim());
      if (q.required && empty) e[`q_${q.id}`] = "This question is required";
      else if (!empty && q.type === "url" && typeof a === "string" && !URL_RE.test(a)) e[`q_${q.id}`] = "Enter a full link starting with https://";
    }
    return e;
  }

  function go(n: number) { setI(n); setError(null); requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }
  function next() {
    const e = validate(step);
    if (Object.keys(e).length) { setErrs(e); setError("Please check the highlighted fields."); return; }
    setErrs({}); go(i + 1);
  }
  const stepOf = (key: string) => {
    if (key.startsWith("q_")) return steps.findIndex((s) => s.id === "questions");
    const base = key.split(".")[0] as FormKey;
    const idx = steps.findIndex((s) => s.keys.includes(base));
    return idx === -1 ? 0 : idx;
  };

  async function send() {
    if (busy) return;
    for (let n = 0; n < steps.length - 1; n++) {
      const e = validate(steps[n]!);
      if (Object.keys(e).length) { setErrs(e); setError("Please complete this step first."); return go(n); }
    }
    if (!confirm) return setError("Please confirm the information is accurate.");
    const fd = new FormData();
    fd.set("job_slug", job.slug); fd.set("started_at", String(started.current)); fd.set("website", "");
    fd.set("full_name", vals["full_name"] ?? ""); fd.set("email", vals["email"] ?? "");
    for (const k of enabled.keys()) if (!FILE_KEYS.includes(k) && !RECORD_KEYS.includes(k) && vals[k]) fd.set(k, vals[k]!);
    fd.set("records", JSON.stringify(rec));
    for (const [k, f] of Object.entries(files)) if (f) fd.set(k === "resume" ? "resume" : k.startsWith("qf_") ? k : `file_${k}`, f);
    if (enabled.has("resume") && !files["resume"] && saved) fd.set("use_saved", "1");
    for (const q of job.questions) { const a = answers[q.id]; if (Array.isArray(a)) a.forEach((x) => fd.append(`q_${q.id}`, x)); else if (a) fd.set(`q_${q.id}`, a); }
    setBusy(true); setError(null);
    try {
      const r = await submit({ data: fd });
      if (r.ok) return onDone(r.id);
      if (r.duplicateId) return onDone(r.duplicateId);
      setError(r.error); setErrs(r.fields ?? {});
      const first = Object.keys(r.fields ?? {})[0];
      if (first) go(stepOf(first));
    } catch { setError("We couldn't send your application. Please try again."); }
    finally { setBusy(false); }
  }

  const a = (k: string) => ({ "aria-invalid": !!errs[k] || undefined, "aria-describedby": errs[k] ? `${k}-err` : undefined });
  const text = (k: FormKey, className?: string) => {
    const c = INPUT[k] ?? {};
    return (
      <Field key={k} id={k} label={FORM_LABEL[k]} required={req(k)} error={errs[k]} className={className}>
        {c.options ? <select id={k} value={vals[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={cn(fieldCls, "h-11")} {...a(k)}><option value="">Choose…</option>{c.options.map((o) => <option key={o}>{o}</option>)}</select>
          : c.area ? <textarea id={k} rows={6} value={vals[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={cn(fieldCls, "py-2")} {...a(k)} />
          : <input id={k} type={c.type ?? "text"} value={vals[k] ?? ""} onChange={(e) => set(k, e.target.value)} autoComplete={c.auto} placeholder={c.ph} className={cn(fieldCls, "h-11")} {...a(k)} />}
      </Field>
    );
  };
  const fileField = (k: string, label: string, required: boolean, accept: string, hint: string, check?: (f: File) => string | null) => (
    <Field key={k} id={k} label={label} required={required} error={errs[k]} hint={hint}>
      <input id={k} type="file" accept={accept} className={fileCls} {...a(k)} onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        const bad = f ? (f.size > 5 * 1024 * 1024 ? "Maximum size is 5 MB" : check?.(f) ?? null) : null;
        setErrs((s) => ({ ...s, [k]: bad ?? "" })); setFiles((s) => ({ ...s, [k]: bad ? null : f }));
        if (bad) e.target.value = "";
      }} />
      {files[k] && <p className="text-caption mt-1 text-foreground">Attached: {files[k]!.name}</p>}
    </Field>
  );
  const docField = (k: FormKey) => {
    if (k === "resume") return (
      <div key={k}>
        {fileField("resume", "CV / résumé", req("resume") && !saved, RESUME_ACCEPT, "PDF, DOC or DOCX, up to 5 MB", (f) => (!/\.(pdf|docx?)$/i.test(f.name) ? "Use a PDF, DOC or DOCX file" : f.size > RESUME_MAX ? "Maximum size is 5 MB" : null))}
        {!files["resume"] && saved && <p className="text-caption mt-1 text-foreground">Using your saved CV: {saved.file_name}. Choose a file to send a different one.</p>}
      </div>
    );
    if (k === "cover_note") return text(k);
    const img = k === "photo";
    return fileField(k, DOC_LABEL[k] ?? FORM_LABEL[k], req(k), img ? IMG_ACCEPT : FILE_ACCEPT, img ? "PNG, JPG or WEBP, up to 5 MB" : "PDF, PNG or JPG, up to 5 MB", (f) => (/\.(exe|bat|cmd|sh|js|msi|apk|scr|com)$/i.test(f.name) ? "This file type isn't accepted" : null));
  };

  const body = (() => {
    switch (step.id) {
      case "personal": return (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="full_name" label="Full name" required error={errs["full_name"]} className="sm:col-span-2"><input id="full_name" value={vals["full_name"] ?? ""} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" className={cn(fieldCls, "h-11")} {...a("full_name")} /></Field>
          <Field id="email" label="Email" required error={errs["email"]}><input id="email" type="email" value={vals["email"] ?? ""} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={cn(fieldCls, "h-11")} {...a("email")} /></Field>
          {step.keys.map((k) => (k === "photo" ? <div key={k} className="sm:col-span-2">{docField(k)}</div> : text(k, k === "location" ? "sm:col-span-2" : undefined)))}
        </div>
      );
      case "education": return <EducationStep rec={rec} setRec={setRec} errs={errs} required={req("education")} />;
      case "experience": return (
        <div className="flex flex-col gap-8">
          {enabled.has("experience") && <ExperienceStep rec={rec} setRec={setRec} errs={errs} required={req("experience")} />}
          {step.keys.some((k) => k !== "experience") && (
            <div><h3 className="text-h4 text-foreground">Current employment & availability</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">{step.keys.filter((k) => k !== "experience").map((k) => text(k))}</div></div>)}
        </div>
      );
      case "skills": return (
        <div className="flex flex-col gap-8">
          {enabled.has("skills") && <PairList title="Skills" err={errs["skills"]} required={req("skills")} rows={rec.skills.map((s) => [s.name, s.level])} levels={SKILL_LEVELS} placeholder="e.g. Lead generation" addLabel="Add skill" errPrefix="skills" errs={errs}
            onChange={(rows) => setRec((r) => ({ ...r, skills: rows.map(([name, level]) => ({ name, level })) }))} />}
          {enabled.has("languages") && <PairList title="Languages" err={errs["languages"]} required={req("languages")} rows={rec.languages.map((s) => [s.language, s.proficiency])} levels={PROFICIENCY} placeholder="e.g. English" addLabel="Add language" errPrefix="languages" errs={errs}
            onChange={(rows) => setRec((r) => ({ ...r, languages: rows.map(([language, proficiency]) => ({ language, proficiency })) }))} />}
        </div>
      );
      case "documents": return <div className="flex flex-col gap-5">{step.keys.map(docField)}<p className="text-caption text-muted-foreground">Files are private to you and the Branta hiring team. Attached files aren't kept in your saved draft.</p></div>;
      case "questions": return (
        <div className="flex flex-col gap-5">
          {job.questions.map((q) => <QuestionField key={q.id} q={q} value={answers[q.id]} err={errs[`q_${q.id}`]} a={a}
            onChange={(v) => { setAnswers((s) => ({ ...s, [q.id]: v })); setErrs((e) => ({ ...e, [`q_${q.id}`]: "" })); }}
            file={files[`qf_${q.id}`] ?? null} fileField={() => fileField(`qf_${q.id}`, q.label, q.required, FILE_ACCEPT, q.help || "PDF, PNG or JPG, up to 5 MB")} />)}
        </div>
      );
      default: return <Review steps={steps} vals={vals} answers={answers} rec={rec} files={files} saved={saved} job={job} enabled={enabled} onEdit={go} confirm={confirm} setConfirm={setConfirm} />;
    }
  })();

  return (
    <div ref={top} className="scroll-mt-24 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Application steps" className="hidden lg:block">
        <ol className="sticky top-28 flex flex-col gap-1">
          {steps.map((s, n) => (
            <li key={s.id}>
              <button type="button" disabled={n > i} onClick={() => go(n)} aria-current={n === i ? "step" : undefined}
                className={cn("text-small flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors", n === i ? "bg-muted font-medium text-foreground" : n < i ? "text-foreground hover:bg-muted/60" : "text-muted-foreground")}>
                <span className={cn("text-caption flex size-6 shrink-0 items-center justify-center rounded-full border", n < i ? "border-accent bg-accent text-accent-foreground" : n === i ? "border-foreground" : "border-border")}>{n < i ? <Check className="size-3.5" aria-hidden /> : n + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="min-w-0 max-w-2xl rounded-md border border-border bg-surface p-5 sm:p-8">
        <div className="lg:hidden">
          <p className="text-caption text-muted-foreground">Step {i + 1} of {steps.length}</p>
          <div className="mt-2 h-1 w-full rounded-full bg-muted" aria-hidden><div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 lg:mt-0">
          <h2 className="text-h2 text-foreground">{step.title}</h2>
          <p className="text-caption text-muted-foreground" aria-live="polite">{draftState === "saving" ? "Saving draft…" : draftState === "saved" ? "Draft saved" : draftState === "restored" ? "Continuing your saved draft" : ""}</p>
        </div>
        <p className="text-caption mt-1 hidden text-muted-foreground lg:block">Step {i + 1} of {steps.length}</p>
        {error && <p role="alert" className="text-small mt-6 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">{error}</p>}
        <div className="mt-6">{body}</div>
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {i > 0 ? <button type="button" onClick={() => { setErrs({}); go(i - 1); }} className={buttonVariants({ variant: "ghost", size: "md" })}>Back</button> : <span />}
          {step.id === "review"
            ? <button type="button" onClick={send} disabled={busy} className={buttonVariants({ variant: "primary", size: "md" })}>{busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Submitting…" : "Submit Application"}</button>
            : <button type="button" onClick={next} className={buttonVariants({ variant: "primary", size: "md" })}>Continue</button>}
        </div>
      </div>
    </div>
  );
}

// ---------- Steps ----------
function Card({ title, onRemove, children }: { title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2"><p className="text-small font-medium text-foreground">{title}</p>
        <button type="button" onClick={onRemove} className="text-caption inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" aria-hidden />Remove</button></div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
const addBtn = "text-small inline-flex items-center gap-2 self-start rounded-sm border border-dashed border-border px-3 py-2 text-foreground hover:border-foreground";

function EducationStep({ rec, setRec, errs, required }: { rec: Records; setRec: React.Dispatch<React.SetStateAction<Records>>; errs: Record<string, string>; required: boolean }) {
  const put = (n: number, p: Partial<Records["education"][number]>) => setRec((r) => ({ ...r, education: r.education.map((x, j) => (j === n ? { ...x, ...p } : x)) }));
  const levels = EDUCATION_LEVELS.filter((l) => l !== "No Specific Requirement" && l !== "Custom").concat("Diploma in Engineering", "PhD", "Other");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-muted-foreground">Add your education, most recent first.{required ? "" : " You can skip this step."}</p>
      {errs["education"] && <p className="text-caption text-destructive">{errs["education"]}</p>}
      {rec.education.map((e, n) => {
        const id = (f: string) => `education.${n}.${f}`;
        const inp = (f: keyof typeof e, label: string, req = false, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
          <Field id={id(f)} label={label} required={req} error={errs[id(f)]}><input id={id(f)} value={String(e[f] ?? "")} onChange={(ev) => put(n, { [f]: ev.target.value })} className={cn(fieldCls, "h-11")} {...extra} /></Field>);
        return (
          <Card key={n} title={`Education ${n + 1}`} onRemove={() => setRec((r) => ({ ...r, education: r.education.filter((_, j) => j !== n) }))}>
            <div className="sm:col-span-2">{inp("institution", "Institution name", true)}</div>
            <Field id={id("level")} label="Degree / level" required error={errs[id("level")]}><select id={id("level")} value={e.level} onChange={(ev) => put(n, { level: ev.target.value })} className={cn(fieldCls, "h-11")}><option value="">Choose…</option>{[...new Set([...levels, ...(e.level ? [e.level] : [])])].map((l) => <option key={l}>{l}</option>)}</select></Field>
            {inp("field", "Department / subject")}
            {inp("major", "Major")}
            {inp("result", "Result / GPA / CGPA")}
            {inp("start_year", "Start year", false, { inputMode: "numeric", maxLength: 4, placeholder: "2021" })}
            {inp("end_year", e.is_current ? "Expected graduation" : "End year", false, { inputMode: "numeric", maxLength: 4, placeholder: "2025" })}
            <label className="text-small flex items-center gap-2 text-foreground sm:col-span-2"><input type="checkbox" checked={e.is_current} onChange={(ev) => put(n, { is_current: ev.target.checked })} className="size-4 accent-[var(--accent)]" />I'm currently studying here</label>
            <Field id={id("description")} label="Description" className="sm:col-span-2"><textarea id={id("description")} rows={2} value={e.description} onChange={(ev) => put(n, { description: ev.target.value })} className={cn(fieldCls, "py-2")} /></Field>
          </Card>
        );
      })}
      <button type="button" className={addBtn} onClick={() => setRec((r) => ({ ...r, education: [...r.education, emptyEducation()] }))}><Plus className="size-4" aria-hidden />Add Education</button>
    </div>
  );
}

function ExperienceStep({ rec, setRec, errs, required }: { rec: Records; setRec: React.Dispatch<React.SetStateAction<Records>>; errs: Record<string, string>; required: boolean }) {
  const put = (n: number, p: Partial<Records["experience"][number]>) => setRec((r) => ({ ...r, experience: r.experience.map((x, j) => (j === n ? { ...x, ...p } : x)) }));
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-small mb-2 font-medium text-foreground">Do you have work experience?{required && <span aria-hidden className="text-accent"> *</span>}</legend>
        <div className="flex gap-6">{(["yes", "no"] as const).map((v) => (
          <label key={v} className="text-small flex items-center gap-2 text-foreground"><input type="radio" name="has_experience" checked={rec.has_experience === v} className="size-4 accent-[var(--accent)]"
            onChange={() => setRec((r) => ({ ...r, has_experience: v, experience: v === "yes" && !r.experience.length ? [emptyExperience()] : r.experience }))} />{v === "yes" ? "Yes" : "No"}</label>))}</div>
        {errs["experience"] && <p className="text-caption mt-1 text-destructive">{errs["experience"]}</p>}
      </fieldset>
      {rec.has_experience === "yes" && <>
        {rec.experience.map((e, n) => {
          const id = (f: string) => `experience.${n}.${f}`;
          const inp = (f: keyof typeof e, label: string, req = false, type = "text") => (
            <Field id={id(f)} label={label} required={req} error={errs[id(f)]}><input id={id(f)} type={type} value={String(e[f] ?? "")} onChange={(ev) => put(n, { [f]: ev.target.value })} className={cn(fieldCls, "h-11")} /></Field>);
          return (
            <Card key={n} title={`Experience ${n + 1}`} onRemove={() => setRec((r) => ({ ...r, experience: r.experience.filter((_, j) => j !== n) }))}>
              {inp("company", "Company name", true)}
              {inp("title", "Job title", true)}
              <Field id={id("employment_type")} label="Employment type"><select id={id("employment_type")} value={e.employment_type} onChange={(ev) => put(n, { employment_type: ev.target.value })} className={cn(fieldCls, "h-11")}><option value="">Choose…</option>{EMPLOYMENT_TYPES.map((o) => <option key={o}>{o}</option>)}</select></Field>
              <span className="hidden sm:block" />
              {inp("start_date", "Start (month)", false, "month")}
              {!e.is_current ? inp("end_date", "End (month)", false, "month") : <span className="hidden sm:block" />}
              <label className="text-small flex items-center gap-2 text-foreground sm:col-span-2"><input type="checkbox" checked={e.is_current} onChange={(ev) => put(n, { is_current: ev.target.checked, ...(ev.target.checked ? { end_date: "" } : {}) })} className="size-4 accent-[var(--accent)]" />I currently work here</label>
              <Field id={id("responsibilities")} label="Responsibilities" className="sm:col-span-2"><textarea id={id("responsibilities")} rows={3} value={e.responsibilities} onChange={(ev) => put(n, { responsibilities: ev.target.value })} className={cn(fieldCls, "py-2")} /></Field>
              <Field id={id("achievements")} label="Key achievements" className="sm:col-span-2"><textarea id={id("achievements")} rows={2} value={e.achievements} onChange={(ev) => put(n, { achievements: ev.target.value })} className={cn(fieldCls, "py-2")} /></Field>
            </Card>
          );
        })}
        <button type="button" className={addBtn} onClick={() => setRec((r) => ({ ...r, experience: [...r.experience, emptyExperience()] }))}><Plus className="size-4" aria-hidden />Add Experience</button>
      </>}
    </div>
  );
}

function PairList({ title, rows, onChange, levels, placeholder, addLabel, err, required, errPrefix, errs }: { title: string; rows: [string, string][]; onChange: (r: [string, string][]) => void; levels: string[]; placeholder: string; addLabel: string; err?: string | undefined; required: boolean; errPrefix: string; errs: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h4 text-foreground">{title}{required ? <span aria-hidden className="text-accent"> *</span> : <span className="text-small font-normal text-muted-foreground"> (optional)</span>}</h3>
      {err && <p className="text-caption text-destructive">{err}</p>}
      {rows.map(([n, l], j) => (
        <div key={j} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="col-span-2 sm:col-span-1">
            <input aria-label={`${title} ${j + 1}`} value={n} placeholder={placeholder} onChange={(e) => onChange(rows.map((r, k) => (k === j ? [e.target.value, r[1]] : r)))} className={cn(fieldCls, "h-11")} />
            {errs[`${errPrefix}.${j}.name`] || errs[`${errPrefix}.${j}.language`] ? <p className="text-caption mt-1 text-destructive">{errs[`${errPrefix}.${j}.name`] || errs[`${errPrefix}.${j}.language`]}</p> : null}
          </div>
          <select aria-label="Level" value={l} onChange={(e) => onChange(rows.map((r, k) => (k === j ? [r[0], e.target.value] : r)))} className={cn(fieldCls, "h-11")}><option value="">Level…</option>{levels.map((o) => <option key={o}>{o}</option>)}</select>
          <button type="button" aria-label="Remove" onClick={() => onChange(rows.filter((_, k) => k !== j))} className="flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive"><Trash2 className="size-4" aria-hidden /></button>
        </div>
      ))}
      <button type="button" className={addBtn} onClick={() => onChange([...rows, ["", ""]])}><Plus className="size-4" aria-hidden />{addLabel}</button>
    </div>
  );
}

function QuestionField({ q, value, onChange, err, a, fileField }: { q: PublicQuestion; value: string | string[] | undefined; onChange: (v: string | string[]) => void; err?: string | undefined; a: (k: string) => Record<string, unknown>; file: File | null; fileField: () => React.ReactNode }) {
  const id = `q_${q.id}`;
  if (q.type === "file") return <>{fileField()}</>;
  const str = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  const choice = (opts: string[], multi: boolean) => (
    <fieldset aria-describedby={err ? `${id}-err` : undefined} className="flex flex-col gap-2">
      <legend className="sr-only">{q.label}</legend>
      {opts.map((o) => <label key={o} className="text-small flex items-center gap-2 text-foreground"><input type={multi ? "checkbox" : "radio"} name={id} checked={multi ? list.includes(o) : str === o}
        onChange={(e) => onChange(multi ? (e.target.checked ? [...list, o] : list.filter((x) => x !== o)) : o)} className="size-4 accent-[var(--accent)]" />{o}</label>)}
    </fieldset>
  );
  const body = q.type === "long" ? <textarea id={id} rows={4} value={str} onChange={(e) => onChange(e.target.value)} className={cn(fieldCls, "py-2")} {...a(id)} />
    : q.type === "yesno" ? choice(["Yes", "No"], false)
    : q.type === "single" ? choice(q.options, false)
    : q.type === "multi" ? choice(q.options, true)
    : q.type === "dropdown" ? <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className={cn(fieldCls, "h-11")} {...a(id)}><option value="">Choose…</option>{q.options.map((o) => <option key={o}>{o}</option>)}</select>
    : <input id={id} value={str} onChange={(e) => onChange(e.target.value)} type={q.type === "number" ? "number" : q.type === "date" ? "date" : q.type === "url" ? "url" : "text"} className={cn(fieldCls, "h-11")} {...a(id)} />;
  return <Field id={id} label={q.label} required={q.required} error={err} hint={q.help || undefined}>{body}</Field>;
}

function Review({ steps, vals, answers, rec, files, saved, job, enabled, onEdit, confirm, setConfirm }: {
  steps: Step[]; vals: Record<string, string>; answers: Answers; rec: Records; files: Record<string, File | null>; saved: MyResume; job: Job; enabled: Map<FormKey, boolean>;
  onEdit: (n: number) => void; confirm: boolean; setConfirm: (v: boolean) => void;
}) {
  const sec = (id: string, title: string, rows: [string, string][]) => {
    const n = steps.findIndex((s) => s.id === id);
    if (n === -1) return null;
    return (
      <section key={id} className="border-b border-border pb-5">
        <div className="flex items-center justify-between gap-2"><h3 className="text-h4 text-foreground">{title}</h3><button type="button" onClick={() => onEdit(n)} className="text-small underline underline-offset-4">Edit</button></div>
        {rows.length ? <dl className="mt-3 grid gap-3 sm:grid-cols-2">{rows.map(([k, v], j) => <div key={j} className="min-w-0"><dt className="text-caption text-muted-foreground">{k}</dt><dd className="text-small whitespace-pre-line break-words text-foreground">{v}</dd></div>)}</dl>
          : <p className="text-small mt-3 text-muted-foreground">Nothing added.</p>}
      </section>
    );
  };
  const keyRows = (id: string) => (steps.find((s) => s.id === id)?.keys ?? []).filter((k) => !FILE_KEYS.includes(k) && !RECORD_KEYS.includes(k) && vals[k]).map((k) => [FORM_LABEL[k], vals[k]!] as [string, string]);
  const docs: [string, string][] = [];
  for (const k of steps.find((s) => s.id === "documents")?.keys ?? []) {
    if (k === "cover_note") { if (vals[k]) docs.push(["Cover letter", vals[k]!]); continue; }
    const f = files[k]; if (f) docs.push([DOC_LABEL[k] ?? k, f.name]); else if (k === "resume" && saved) docs.push(["CV / Resume", `${saved.file_name} (saved CV)`]);
  }
  if (files["photo"]) docs.push(["Profile photo", files["photo"].name]);
  return (
    <div className="flex flex-col gap-5">
      {sec("personal", "Personal Information", [["Full name", vals["full_name"] ?? ""], ["Email", vals["email"] ?? ""], ...keyRows("personal")])}
      {sec("education", "Education", rec.education.map((e) => [[e.level, e.field].filter(Boolean).join(" in "), [e.institution, yearSpan(e.start_year, e.end_year, e.is_current), e.result && `Result: ${e.result}`].filter(Boolean).join(" · ")]))}
      {sec("experience", "Experience", [...(enabled.has("experience") ? (rec.has_experience === "no" ? [["Work experience", "None yet"] as [string, string]] : rec.experience.map((e) => [`${e.title} — ${e.company}`, [e.employment_type, yearSpan(e.start_date, e.end_date, e.is_current)].filter(Boolean).join(" · ")] as [string, string])) : []), ...keyRows("experience")])}
      {sec("skills", "Skills", [...rec.skills.map((s) => [s.name, s.level || "—"] as [string, string]), ...rec.languages.map((l) => [`Language: ${l.language}`, l.proficiency || "—"] as [string, string])])}
      {sec("documents", "Documents", docs)}
      {sec("questions", "Application Questions", job.questions.map((q) => [q.label, q.type === "file" ? files[`qf_${q.id}`]?.name ?? "—" : Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).join(", ") || "—" : (answers[q.id] as string) || "—"]))}
      <label className="text-small flex items-start gap-3 text-foreground"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />I confirm that the information provided is accurate.</label>
    </div>
  );
}

export function AppliedCard({ id, title, already, submittedAt }: { id: string; title: string; already?: boolean; submittedAt?: string }) {
  return (
    <div role="status" className="rounded-md border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-h2 text-foreground">{already ? "You already applied for this position." : "Application Submitted"}</h2>
      {!already && <p className="text-body mt-4 text-muted-foreground">Thank you for applying to Branta Tech.</p>}
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div><dt className="text-caption text-muted-foreground">Job</dt><dd className="text-small text-foreground">{title}</dd></div>
        <div><dt className="text-caption text-muted-foreground">Application reference</dt><dd className="text-small font-mono text-foreground">{id.slice(0, 8).toUpperCase()}</dd></div>
        {submittedAt && <div><dt className="text-caption text-muted-foreground">Submitted</dt><dd className="text-small text-foreground">{new Date(submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd></div>}
      </dl>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to="/careers/account/applications/$id" params={{ id }} className={buttonVariants({ variant: "primary", size: "md" })}>View My Application</Link>
        <Link to="/careers" className={buttonVariants({ variant: "secondary", size: "md" })}>Back to Careers</Link>
      </div>
    </div>
  );
}
