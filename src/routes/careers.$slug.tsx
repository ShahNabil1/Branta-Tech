import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { JobBadges, JobBody, JobFacts } from "@/components/careers/JobDetail";
import { FORM_LABEL, formatDeadline, type FormKey, type PublicQuestion } from "@/lib/job-details";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { jobQuery, type Job } from "@/lib/company.functions";
import { RESUME_ACCEPT, RESUME_MAX, submitApplication, getMyResume, type MyResume } from "@/lib/careers.functions";
import { pageMeta, canonical } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { ensureApplicantProfile } from "@/lib/applicant-auth";
import { fetchApplyPrefill, fetchMyApplications } from "@/lib/applicant-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/$slug")({
  loader: async ({ context, params }) => {
    const [, job] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(jobQuery(params.slug))]);
    if (job && "redirect" in job) throw redirect({ to: "/careers/$slug", params: { slug: job.redirect }, statusCode: 301 });
    if (!job) throw notFound();
    return { title: job.title, summary: job.summary, seo: job.seo };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Role not available | Branta Tech" }, { name: "robots", content: "noindex" }] };
    const s = loaderData.seo;
    const title = s.title || `${loaderData.title} | Careers | Branta Tech`;
    const description = s.description || loaderData.summary || `Apply for the ${loaderData.title} role at Branta.`;
    const meta = pageMeta({ title, description, image: s.og_image || null }).map((m) =>
      m["property"] === "og:title" && s.og_title ? { ...m, content: s.og_title } : m["property"] === "og:description" && s.og_description ? { ...m, content: s.og_description } : m);
    return { links: canonical(`/careers/${params.slug}`, s.canonical), meta };
  },
  errorComponent: () => <p className="p-8">Something went wrong loading this role.</p>,
  notFoundComponent: () => (
    <SiteShell>
      <Section tone="warm">
        <h1 className="text-h1">This role isn't open</h1>
        <Link to="/careers" className="text-body mt-6 inline-block underline underline-offset-4">See open roles</Link>
      </Section>
    </SiteShell>
  ),
  component: JobPage,
});

function JobPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(jobQuery(slug));
  return <SiteShell><JobView j={data as Job} /></SiteShell>;
}

/** Full public job layout; also used by the Control Centre preview (with preview = true). */
export function JobView({ j, preview }: { j: Job; preview?: boolean }) {
  const meta = [j.department, j.details.category, j.jobCode && `Ref. ${j.jobCode}`].filter(Boolean) as string[];
  const cta = j.details.application.cta_label || "Apply Now";
  return (
    <>
      <Section tone="dark" aria-labelledby="job-title">
        <Link to="/careers" className="text-small text-muted-foreground hover:text-foreground">← Careers</Link>
        <div className="mt-10 flex flex-wrap gap-2"><JobBadges j={j} /></div>
        <h1 id="job-title" className="text-display mt-4 max-w-[20ch] break-words text-foreground">{j.title}</h1>
        {meta.length > 0 && <p className="text-small mt-6 text-muted-foreground">{meta.join(" · ")}</p>}
        {j.summary && <p className="text-body-lg mt-6 max-w-2xl text-muted-foreground">{j.summary}</p>}
        {j.window === "open" && <a href="#apply" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-10")}>{cta}</a>}
      </Section>
      <SiteContainer>
        <div className="py-12 md:py-16"><JobFacts j={j} /></div>
        <div className="grid gap-16 pb-16 md:pb-24 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7"><JobBody j={j} /></div>
          <div id="apply" className="min-w-0 scroll-mt-24 lg:col-span-5">
            {preview ? <div className="rounded-md border border-border bg-surface p-6 md:p-8"><h2 className="text-h2 text-foreground">Apply</h2><p className="text-body mt-4 text-muted-foreground">Preview — the application form appears here for signed-in applicants{j.window !== "open" ? " (currently closed)" : ""}.</p></div>
              : <ApplyEntry job={j} />}
          </div>
        </div>
      </SiteContainer>
    </>
  );
}

function ApplyEntry({ job }: { job: Job }) {
  const a = job.details.application;
  const box = "rounded-md border border-border bg-surface p-6 md:p-8";
  if (job.window === "not_yet") return <div className={box}><h2 className="text-h2 text-foreground">Applications open soon</h2><p className="text-body mt-4 text-muted-foreground">Applications open on {formatDeadline(job.openAt)}.</p></div>;
  if (job.window === "closed") return <div className={box}><h2 className="text-h2 text-foreground">Applications closed</h2><p className="text-body mt-4 text-muted-foreground">This role is no longer accepting applications.</p><Link to="/careers" className="text-body mt-6 inline-block underline underline-offset-4">See open roles</Link></div>;
  if (a.method !== "form") {
    const href = a.method === "email" && a.email ? `mailto:${a.email}?subject=${encodeURIComponent(`Application: ${job.title}`)}`
      : a.method === "link" && /^https:\/\//.test(a.url) ? a.url
      : a.method === "whatsapp" && a.whatsapp ? `https://wa.me/${a.whatsapp.replace(/[^\d]/g, "")}` : null;
    return (
      <div className={box}>
        <h2 className="text-h2 text-foreground">How to apply</h2>
        {a.custom_text && <p className="text-body mt-4 whitespace-pre-line text-muted-foreground">{a.custom_text}</p>}
        {href && <a href={href} target={a.method === "email" ? undefined : "_blank"} rel="noopener noreferrer" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6 w-full")}>{a.cta_label || "Apply Now"}</a>}
      </div>
    );
  }
  return <ApplyForm job={job} />;
}

const fieldCls = "w-full rounded-sm border border-input bg-surface px-3 text-body outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring";

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string | undefined; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-small mb-1.5 block font-medium text-foreground">{label}{required ? <span aria-hidden className="text-accent"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}</label>
      {children}
      {error ? <p id={`${id}-err`} className="text-caption mt-1 text-destructive">{error}</p> : hint ? <p id={`${id}-hint`} className="text-caption mt-1 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type Gate = { kind: "loading" } | { kind: "signed-out" } | { kind: "applied"; id: string } | { kind: "form"; prefill: Record<string, string>; email: string };

function ApplyForm({ job }: { job: Job }) {
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (!data.user) return setGate({ kind: "signed-out" });
      await ensureApplicantProfile();
      const [apps, prefill] = await Promise.all([fetchMyApplications().catch(() => []), fetchApplyPrefill(data.user.id)]);
      if (!alive) return;
      const active = apps.find((x) => x.job_slug === job.slug && x.status !== "withdrawn");
      setGate(active ? { kind: "applied", id: active.id } : { kind: "form", prefill, email: data.user.email ?? "" });
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => (e === "SIGNED_IN" || e === "SIGNED_OUT") && void load());
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [job.slug]);

  const box = "rounded-md border border-border bg-surface p-6 md:p-8";
  if (gate.kind === "loading") return <div className={box}><p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p></div>;
  if (gate.kind === "signed-out") {
    const next = `/careers/${job.slug}`;
    return (
      <div className={box}>
        <h2 className="text-h2 text-foreground">Apply</h2>
        <p className="text-body mt-4 text-muted-foreground">Sign in or create an applicant account to apply. You'll come straight back to this role, and you can follow your application afterwards.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/careers/sign-in" search={{ next }} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>Sign in to apply</Link>
          <Link to="/careers/sign-up" search={{ next }} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}>Create an account</Link>
        </div>
      </div>
    );
  }
  if (gate.kind === "applied") return <Applied id={gate.id} title={job.title} already />;
  return <ApplyFields job={job} prefill={gate.prefill} email={gate.email} />;
}

function Applied({ id, title, already }: { id: string; title: string; already?: boolean }) {
  return (
    <div role="status" className="rounded-md border border-border bg-surface p-8">
      <h2 className="text-h2 text-foreground">{already ? "Application already submitted" : "Application sent"}</h2>
      <p className="text-body mt-4 text-muted-foreground">{already ? `You've already applied for ${title}.` : `Thank you for applying for ${title}. Our team will review it and get back to you.`}</p>
      <Link to="/careers/account/applications/$id" params={{ id }} className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-6")}>View Application</Link>
    </div>
  );
}

function ApplyFields({ job, prefill, email }: { job: Job; prefill: Record<string, string>; email: string }) {
  const submit = useServerFn(submitApplication);
  const started = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const fields = job.details.form.filter((x) => x.enabled);
  const resumeField = fields.find((x) => x.key === "resume");
  const getSaved = useServerFn(getMyResume);
  const [saved, setSaved] = useState<MyResume>(null);
  useEffect(() => { getSaved().then(setSaved).catch(() => setSaved(null)); }, [getSaved]);

  function pick(f: File | undefined) {
    setErrs((e) => ({ ...e, resume: "" }));
    if (!f) return setFile(null);
    if (!/\.(pdf|docx?)$/i.test(f.name)) { setFile(null); return setErrs((e) => ({ ...e, resume: "Use a PDF, DOC or DOCX file" })); }
    if (f.size > RESUME_MAX) { setFile(null); return setErrs((e) => ({ ...e, resume: "Maximum size is 5 MB" })); }
    setFile(f);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    fd.set("job_slug", job.slug);
    fd.set("started_at", String(started.current));
    if (file) fd.set("resume", file);
    else if (resumeField && saved) fd.set("use_saved", "1");
    else if (resumeField?.required) { setErrs({ resume: "Attach your CV" }); return setError("Please attach your CV."); }
    setBusy(true); setError(null); setErrs({});
    try {
      const r = await submit({ data: fd });
      if (r.ok) setDoneId(r.id);
      else if (r.duplicateId) setDupId(r.duplicateId);
      else { setError(r.error); setErrs(r.fields ?? {}); }
    } catch {
      setError("We couldn't send your application. Please try again.");
    } finally { setBusy(false); }
  }

  if (doneId) return <Applied id={doneId} title={job.title} />;
  if (dupId) return <Applied id={dupId} title={job.title} already />;

  const a = (k: string) => ({ "aria-invalid": !!errs[k] || undefined, "aria-describedby": errs[k] ? `${k}-err` : undefined });
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-md border border-border bg-surface p-6 md:p-8" aria-labelledby="apply-title">
      <h2 id="apply-title" className="text-h2 text-foreground">Apply</h2>
      <p className="text-small mt-2 text-muted-foreground">We've filled in what we know from your profile. You can change anything for this application. Fields marked * are required.</p>
      {error && <p role="alert" className="text-small mt-6 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">{error}</p>}
      <div className="mt-6 flex flex-col gap-5">
        <Field id="full_name" label="Full name" required error={errs["full_name"]}><input id="full_name" name="full_name" defaultValue={prefill["full_name"]} required autoComplete="name" className={cn(fieldCls, "h-11")} {...a("full_name")} /></Field>
        <Field id="email" label="Email" required error={errs["email"]}><input id="email" name="email" defaultValue={email} type="email" required autoComplete="email" className={cn(fieldCls, "h-11")} {...a("email")} /></Field>
        {fields.filter((x) => x.key !== "resume").map((x) => <ConfigField key={x.key} k={x.key} required={x.required} prefill={prefill} err={errs[x.key]} a={a} />)}
        {resumeField && (
        <Field id="resume" label="CV / résumé" required={resumeField.required} error={errs["resume"]} hint="PDF, DOC or DOCX, up to 5 MB">
          <input id="resume" type="file" accept={RESUME_ACCEPT} onChange={(e) => pick(e.target.files?.[0])}
            className="text-small block w-full file:mr-4 file:rounded-sm file:border file:border-input file:bg-surface file:px-3 file:py-2 file:text-foreground" {...a("resume")} />
          {file ? <p className="text-caption mt-1 text-foreground" aria-live="polite">Attached: {file.name} ({Math.ceil(file.size / 1024)} KB)</p>
            : saved && <p className="text-caption mt-1 text-foreground" aria-live="polite">Using your saved CV: {saved.file_name}. Choose a file to send a different one.</p>}
        </Field>)}
        {job.questions.map((q) => <QuestionField key={q.id} q={q} err={errs[`q_${q.id}`]} a={a} />)}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Sending…" : job.details.application.cta_label === "Apply Now" ? "Send application" : job.details.application.cta_label}
        </button>
        <p className="text-caption text-muted-foreground">Your details and CV are only seen by the Branta hiring team.</p>
      </div>
    </form>
  );
}

type A = (k: string) => Record<string, unknown>;
const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const INPUT: Partial<Record<FormKey, { type?: string; auto?: string; area?: boolean; ph?: string; accept?: string }>> = {
  phone: { type: "tel", auto: "tel" }, location: { auto: "street-address" }, linkedin_url: { type: "url", ph: "https://linkedin.com/in/…" }, portfolio_url: { type: "url", ph: "https://" },
  website_url: { type: "url", ph: "https://" }, current_company: { auto: "organization" }, current_position: { auto: "organization-title" }, education: { area: true }, experience: { area: true },
  joining_date: { type: "date" }, cover_note: { area: true }, portfolio_file: { type: "file", accept: FILE_ACCEPT }, photo: { type: "file", accept: ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" },
};
function ConfigField({ k, required, prefill, err, a }: { k: FormKey; required: boolean; prefill: Record<string, string>; err?: string | undefined; a: A }) {
  const c = INPUT[k] ?? {};
  const label = FORM_LABEL[k];
  if (c.type === "file") return <Field id={k} label={label} required={required} error={err} hint="PDF, PNG, JPG or WEBP, up to 5 MB"><input id={k} name={`file_${k}`} type="file" accept={c.accept} className="text-small block w-full file:mr-4 file:rounded-sm file:border file:border-input file:bg-surface file:px-3 file:py-2 file:text-foreground" {...a(k)} /></Field>;
  return (
    <Field id={k} label={label} required={required} error={err}>
      {c.area ? <textarea id={k} name={k} required={required} rows={k === "cover_note" ? 6 : 3} className={cn(fieldCls, "py-2")} {...a(k)} />
        : <input id={k} name={k} type={c.type ?? "text"} required={required} defaultValue={prefill[k]} autoComplete={c.auto} placeholder={c.ph} className={cn(fieldCls, "h-11")} {...a(k)} />}
    </Field>
  );
}
function QuestionField({ q, err, a }: { q: PublicQuestion; err?: string | undefined; a: A }) {
  const id = `q_${q.id}`;
  const choice = (type: "radio" | "checkbox", opts: string[]) => (
    <fieldset aria-describedby={err ? `${id}-err` : undefined} className="flex flex-col gap-2">
      <legend className="sr-only">{q.label}</legend>
      {opts.map((o) => <label key={o} className="text-small flex items-center gap-2 text-foreground"><input type={type} name={id} value={o} className="size-4 accent-[var(--accent)]" />{o}</label>)}
    </fieldset>
  );
  const body = q.type === "long" ? <textarea id={id} name={id} rows={4} className={cn(fieldCls, "py-2")} {...a(id)} />
    : q.type === "yesno" ? choice("radio", ["Yes", "No"])
    : q.type === "single" ? choice("radio", q.options)
    : q.type === "multi" ? choice("checkbox", q.options)
    : q.type === "dropdown" ? <select id={id} name={id} className={cn(fieldCls, "h-11")} {...a(id)}><option value="">Choose…</option>{q.options.map((o) => <option key={o}>{o}</option>)}</select>
    : q.type === "file" ? <input id={id} name={`qf_${q.id}`} type="file" accept={FILE_ACCEPT} className="text-small block w-full file:mr-4 file:rounded-sm file:border file:border-input file:bg-surface file:px-3 file:py-2 file:text-foreground" {...a(id)} />
    : <input id={id} name={id} type={q.type === "number" ? "number" : q.type === "date" ? "date" : q.type === "url" ? "url" : "text"} className={cn(fieldCls, "h-11")} {...a(id)} />;
  return <Field id={id} label={q.label} required={q.required} error={err} hint={q.help || undefined}>{body}</Field>;
}
