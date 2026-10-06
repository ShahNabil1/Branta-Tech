import { useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { aria, Field, FormAlert, Honeypot, fieldCls, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { submitLead } from "@/lib/inquiry.functions";
import { ATTACH_ACCEPT, ATTACH_MAX, BUDGET_OPTIONS, SERVICE_OPTIONS, TIMELINE_OPTIONS } from "@/lib/inquiry";
import { useClientSession } from "@/lib/client-session";
import { pageMeta, canonical } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/start-a-project")({
  validateSearch: (s: Record<string, unknown>): { brief?: string | undefined } => ({
    brief: typeof s["brief"] === "string" ? s["brief"].slice(0, 1500) : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ links: canonical("/start-a-project"), meta: pageMeta({ title: "Start a Project | Branta Tech", description: "Tell Branta about your film, visuals, brand, product, website, software or automation project." }) }),
  component: StartProject,
});

function StartProject() {
  const submit = useServerFn(submitLead);
  const { brief } = Route.useSearch();
  const { user } = useClientSession();
  const started = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);

  function pick(f: File | undefined) {
    setErrs((e) => ({ ...e, attachment: "" }));
    if (!f) return setFile(null);
    if (!/\.(pdf|png|jpe?g|docx)$/i.test(f.name)) { setFile(null); return setErrs((e) => ({ ...e, attachment: "Use a PDF, PNG, JPG or DOCX file" })); }
    if (f.size > ATTACH_MAX) { setFile(null); return setErrs((e) => ({ ...e, attachment: "Maximum size is 10 MB" })); }
    setFile(f);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    fd.set("started_at", String(started.current));
    fd.delete("attachment");
    if (file) fd.set("attachment", file);
    if (fd.getAll("services").length === 0) { setErrs({ services: "Choose at least one" }); return setError("Please check the highlighted fields."); }
    setBusy(true); setError(null); setErrs({});
    try {
      const r = await submit({ data: fd });
      if (r.ok) { setDone(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else { setError(r.error); setErrs(r.fields ?? {}); }
    } catch {
      setError("We couldn't send your request. Please try again.");
    } finally { setBusy(false); }
  }

  const a = (k: string) => aria(errs, k);
  return (
    <SiteShell>
      <section className="dark bg-background py-16 text-foreground md:py-24">
        <SiteContainer>
          <Eyebrow>START A PROJECT</Eyebrow>
          <h1 className="text-display mt-4 max-w-3xl">Tell us what you're making.</h1>
          <p className="text-body-lg mt-5 max-w-2xl text-muted-foreground">A few details help us come back with the right people and the right questions.</p>
        </SiteContainer>
      </section>
      <section className="bg-background py-12 md:py-20">
        <SiteContainer>
          <div className="mx-auto max-w-3xl">
            {done ? (
              <div role="status" className="rounded-md border border-border bg-surface p-8">
                <h2 className="text-h2 text-foreground">Request received</h2>
                <p className="text-body mt-4 text-muted-foreground">Thank you. Someone from the Branta team will review your project and get back to you.</p>
                {user ? <Link to="/client/requests" className={cn(buttonVariants({ variant: "secondary", size: "md" }), "mt-6")}>View your requests</Link>
                  : <p className="text-small mt-6 text-muted-foreground"><Link to="/sign-up" className="text-foreground underline underline-offset-4">Create an account</Link> to keep track of future requests.</p>}
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6 rounded-md border border-border bg-surface p-6 md:p-10" aria-label="Start a project">
                <p className="text-small text-muted-foreground">Fields marked * are required.{!user && <> Have an account? <Link to="/sign-in" search={{ next: "/start-a-project" }} className="text-foreground underline underline-offset-4">Sign in</Link> to track this request.</>}</p>
                {error && <FormAlert>{error}</FormAlert>}
                <div className="grid gap-5 md:grid-cols-2">
                  <Field id="name" label="Name" required error={errs["name"]}><input id="name" name="name" autoComplete="name" defaultValue={(user?.user_metadata?.["full_name"] as string) ?? ""} className={inputCls} {...a("name")} /></Field>
                  <Field id="email" label="Email" required error={errs["email"]}><input id="email" name="email" type="email" autoComplete="email" defaultValue={user?.email ?? ""} className={inputCls} {...a("email")} /></Field>
                  <Field id="phone" label="Phone" error={errs["phone"]}><input id="phone" name="phone" type="tel" autoComplete="tel" className={inputCls} {...a("phone")} /></Field>
                  <Field id="company" label="Company" error={errs["company"]}><input id="company" name="company" autoComplete="organization" className={inputCls} {...a("company")} /></Field>
                  <div className="md:col-span-2"><Field id="website" label="Website" error={errs["website"]}><input id="website" name="website" type="url" placeholder="https://" className={inputCls} {...a("website")} /></Field></div>
                </div>
                <fieldset aria-describedby={errs["services"] ? "services-err" : undefined}>
                  <legend className="text-small mb-3 font-medium text-foreground">What do you need?<span aria-hidden className="text-accent"> *</span></legend>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_OPTIONS.map((s) => (
                      <label key={s} className="text-small cursor-pointer rounded-full border border-input px-4 py-2 text-foreground has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                        <input type="checkbox" name="services" value={s} className="sr-only" />{s}
                      </label>
                    ))}
                  </div>
                  {errs["services"] && <p id="services-err" className="text-caption mt-2 text-destructive">{errs["services"]}</p>}
                </fieldset>
                <Field id="project_summary" label="Project summary" required error={errs["project_summary"]} hint="What you're making, who it's for and what success looks like.">
                  <textarea id="project_summary" name="project_summary" rows={6} className={cn(fieldCls, "py-2")} defaultValue={brief} {...a("project_summary")} />
                </Field>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field id="budget_range" label="Estimated budget" error={errs["budget_range"]}>
                    <select id="budget_range" name="budget_range" className={inputCls} defaultValue=""><option value="">Choose…</option>{BUDGET_OPTIONS.map((b) => <option key={b}>{b}</option>)}</select>
                  </Field>
                  <Field id="timeline" label="Preferred timeline" error={errs["timeline"]}>
                    <select id="timeline" name="timeline" className={inputCls} defaultValue=""><option value="">Choose…</option>{TIMELINE_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select>
                  </Field>
                  <div className="md:col-span-2"><Field id="budget_note" label="Budget note" error={errs["budget_note"]} hint="If you have a figure or range in mind, add it here."><input id="budget_note" name="budget_note" maxLength={200} className={inputCls} /></Field></div>
                </div>
                <Field id="reference_links" label="Reference links" error={errs["reference_links"]} hint="One link per line — examples you like, briefs or existing work.">
                  <textarea id="reference_links" name="reference_links" rows={3} placeholder="https://" className={cn(fieldCls, "py-2")} {...a("reference_links")} />
                </Field>
                <Field id="attachment" label="Attachment" error={errs["attachment"]} hint="PDF, PNG, JPG or DOCX, up to 10 MB">
                  <input id="attachment" name="attachment" type="file" accept={ATTACH_ACCEPT} onChange={(e) => pick(e.target.files?.[0])}
                    className="text-small block w-full file:mr-4 file:rounded-sm file:border file:border-input file:bg-surface file:px-3 file:py-2 file:text-foreground" {...a("attachment")} />
                </Field>
                <label className="text-small flex items-start gap-3 text-foreground">
                  <input type="checkbox" name="consent" className="mt-1 size-4 accent-[var(--color-accent)]" aria-describedby={errs["consent"] ? "consent-err" : undefined} />
                  <span>I agree that Branta can use these details to contact me about this request.<span aria-hidden className="text-accent"> *</span>
                    {errs["consent"] && <span id="consent-err" className="text-caption mt-1 block text-destructive">{errs["consent"]}</span>}</span>
                </label>
                <Honeypot />
                <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full md:w-auto md:self-start")}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Sending…" : "Send request"}
                </button>
              </form>
            )}
          </div>
        </SiteContainer>
      </section>
    </SiteShell>
  );
}
