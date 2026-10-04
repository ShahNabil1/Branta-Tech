import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { RichText } from "@/components/content/RichText";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { jobQuery, type Job } from "@/lib/company.functions";
import { RESUME_ACCEPT, RESUME_MAX, submitApplication } from "@/lib/careers.functions";
import { pageMeta, canonical } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { ensureApplicantProfile } from "@/lib/applicant-auth";
import { fetchApplyPrefill, fetchMyApplications } from "@/lib/applicant-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/$slug")({
  loader: async ({ context, params }) => {
    const [, job] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(jobQuery(params.slug))]);
    if (!job) throw notFound();
    return { title: job.title, summary: job.summary };
  },
  head: ({ loaderData, params }) => loaderData
    ? { links: canonical(`/careers/${params.slug}`), meta: pageMeta({ title: `${loaderData.title} | Careers | Branta Tech`, description: loaderData.summary || `Apply for the ${loaderData.title} role at Branta.` }) }
    : { meta: [{ title: "Role not available | Branta Tech" }, { name: "robots", content: "noindex" }] },
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
  const j = data!;
  const meta = [j.department, j.type, j.location, j.workMode].filter(Boolean);
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="job-title">
        <Link to="/careers" className="text-small text-muted-foreground hover:text-foreground">← Careers</Link>
        <h1 id="job-title" className="text-display mt-10 max-w-[20ch] break-words text-foreground">{j.title}</h1>
        {meta.length > 0 && <ul className="mt-8 flex flex-wrap gap-2">{meta.map((m) => <li key={m} className="text-caption rounded-sm border border-border px-2.5 py-1 text-muted-foreground">{m}</li>)}</ul>}
        {j.summary && <p className="text-body-lg mt-8 max-w-2xl text-muted-foreground">{j.summary}</p>}
        <a href="#apply" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-10")}>Apply Now</a>
      </Section>
      <SiteContainer>
        <div className="grid gap-16 py-16 md:py-24 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            {j.blocks.length > 0 && <RichText blocks={j.blocks} />}
            {j.requirements.length > 0 && (
              <div className="mt-12">
                <h2 className="text-h2 text-foreground">What we're looking for</h2>
                <ul className="text-body-lg mt-6 flex list-disc flex-col gap-2 pl-6 text-foreground/85">{j.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
          </div>
          <div id="apply" className="min-w-0 scroll-mt-24 lg:col-span-5"><ApplyForm job={j} /></div>
        </div>
      </SiteContainer>
    </SiteShell>
  );
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
    if (!file) { setErrs({ resume: "Attach your CV" }); return setError("Please attach your CV."); }
    fd.set("resume", file);
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
        <Field id="phone" label="Phone" required error={errs["phone"]}><input id="phone" name="phone" defaultValue={prefill["phone"]} type="tel" required autoComplete="tel" className={cn(fieldCls, "h-11")} {...a("phone")} /></Field>
        <Field id="location" label="Location" error={errs["location"]}><input id="location" name="location" defaultValue={prefill["location"]} autoComplete="address-level2" className={cn(fieldCls, "h-11")} {...a("location")} /></Field>
        <Field id="portfolio_url" label="Portfolio link" error={errs["portfolio_url"]}><input id="portfolio_url" name="portfolio_url" defaultValue={prefill["portfolio_url"]} type="url" placeholder="https://" className={cn(fieldCls, "h-11")} {...a("portfolio_url")} /></Field>
        <Field id="linkedin_url" label="LinkedIn" error={errs["linkedin_url"]}><input id="linkedin_url" name="linkedin_url" defaultValue={prefill["linkedin_url"]} type="url" placeholder="https://linkedin.com/in/…" className={cn(fieldCls, "h-11")} {...a("linkedin_url")} /></Field>
        <Field id="cover_note" label="Cover note" required error={errs["cover_note"]}><textarea id="cover_note" name="cover_note" required rows={6} className={cn(fieldCls, "py-2")} {...a("cover_note")} /></Field>
        <Field id="resume" label="CV / résumé" required error={errs["resume"]} hint="PDF, DOC or DOCX, up to 5 MB">
          <input id="resume" type="file" accept={RESUME_ACCEPT} onChange={(e) => pick(e.target.files?.[0])}
            className="text-small block w-full file:mr-4 file:rounded-sm file:border file:border-input file:bg-surface file:px-3 file:py-2 file:text-foreground" {...a("resume")} />
          {file && <p className="text-caption mt-1 text-foreground" aria-live="polite">Attached: {file.name} ({Math.ceil(file.size / 1024)} KB)</p>}
        </Field>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Sending…" : "Send application"}
        </button>
        <p className="text-caption text-muted-foreground">Your details and CV are only seen by the Branta hiring team.</p>
      </div>
    </form>
  );
}
