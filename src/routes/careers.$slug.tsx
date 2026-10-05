import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Briefcase, Building2, CalendarDays, Loader2, MapPin, Wallet } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { JobBadges, JobFacts } from "@/components/careers/JobDetail";
import { AboutRole, CompBenefits, DayInRole, GoodToKnow, HiringProcess, JobFaq, MeetTeam, RoleTabs, SkillsBlock } from "@/components/careers/JobLanding";
import { formatDeadline } from "@/lib/job-details";
import { AppliedCard } from "@/components/careers/ApplyWizard";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { jobQuery, type Job } from "@/lib/company.functions";
import { pageMeta, canonical } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyApplications } from "@/lib/applicant-data";
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
  const chips = ([[MapPin, j.location], [Briefcase, j.type], [Building2, j.workMode], [Wallet, j.salary !== "Not disclosed" ? j.salary : ""], [CalendarDays, j.deadlineAt ? `Apply by ${formatDeadline(j.deadlineAt)}` : ""]] as [typeof MapPin, string | null][]).filter(([, v]) => v);
  const open = j.window === "open";
  return (
    <>
      <section aria-labelledby="job-title" className="dark relative overflow-hidden bg-background text-foreground">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 size-[34rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_28%,transparent),transparent)]" />
        <SiteContainer>
          <div className="relative py-10 md:py-16">
            <Link to="/careers" className="text-small text-muted-foreground hover:text-foreground">← All roles</Link>
            <div className="mt-8 flex flex-wrap gap-2"><JobBadges j={j} /></div>
            {meta.length > 0 && <p className="text-eyebrow mt-4 text-accent">{meta.join(" · ")}</p>}
            <h1 id="job-title" className="text-h1 mt-3 max-w-[22ch] break-words">{j.title}</h1>
            {j.summary && <p className="text-body-lg mt-5 max-w-2xl text-muted-foreground">{j.summary}</p>}
            {chips.length > 0 && <ul className="mt-7 flex flex-wrap gap-2">{chips.map(([I, v]) => <li key={v} className="text-small inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5"><I className="size-4 text-accent" aria-hidden />{v}</li>)}</ul>}
            {open && <a href="#apply" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8")}>{cta}</a>}
          </div>
        </SiteContainer>
      </section>
      <div className="bg-muted">
        <SiteContainer>
          <div className="grid gap-10 py-10 md:py-14 lg:grid-cols-12 lg:gap-12">
            <div className="min-w-0 lg:col-span-8">
              <div className="pb-10"><JobFacts j={j} /></div>
              <AboutRole j={j} />
              <RoleTabs j={j} />
              <SkillsBlock j={j} />
              <CompBenefits j={j} />
              <DayInRole j={j} />
              <GoodToKnow j={j} />
              <MeetTeam j={j} />
            </div>
            <aside id="apply" aria-label="Apply" className="min-w-0 scroll-mt-24 lg:col-span-4">
              <div className="flex flex-col gap-3 lg:sticky lg:top-24">
                <div className="rounded-md border border-border bg-surface p-5">
                  <p className="text-small font-medium text-foreground">{j.title}</p>
                  <dl className="text-caption mt-3 grid gap-1.5 text-muted-foreground">
                    {([["Salary", j.salary !== "Not disclosed" ? j.salary : ""], ["Location", j.location], ["Type", j.type], ["Deadline", j.deadlineAt ? formatDeadline(j.deadlineAt) : ""]] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3"><dt>{k}</dt><dd className="text-right text-foreground">{v}</dd></div>
                    ))}
                  </dl>
                </div>
                {preview ? <div className="rounded-md border border-border bg-surface p-6"><h2 className="text-h4 text-foreground">Apply</h2><p className="text-small mt-3 text-muted-foreground">Preview — the apply panel appears here{open ? "" : " (currently closed)"}.</p></div>
                  : <ApplyEntry job={j} />}
              </div>
            </aside>
          </div>
        </SiteContainer>
      </div>
      <HiringProcess j={j} />
      {j.details.faqs.length > 0 && <div className="bg-muted"><SiteContainer><div className="mx-auto max-w-3xl py-12 md:py-16"><JobFaq j={j} /></div></SiteContainer></div>}
      {open && (
        <section className="dark bg-background pb-24 text-foreground lg:pb-0">
          <SiteContainer>
            <div className="glow-soft my-10 flex flex-col items-start gap-6 rounded-md border border-border p-8 md:my-14 md:flex-row md:items-center md:justify-between md:p-12">
              <div><p className="text-eyebrow text-accent">Ready?</p><h2 className="text-h2 mt-3 max-w-[20ch]">Apply for {j.title}</h2>{j.deadlineAt && <p className="text-small mt-3 text-muted-foreground">Applications close {formatDeadline(j.deadlineAt)}.</p>}</div>
              <a href="#apply" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "shrink-0")}>{cta}</a>
            </div>
          </SiteContainer>
        </section>
      )}
      {open && !preview && (
        <div className="dark fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 text-foreground backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-small truncate font-medium">{j.title}</p>{j.salary !== "Not disclosed" && <p className="text-caption truncate text-muted-foreground">{j.salary}</p>}</div>
            <a href="#apply" className={cn(buttonVariants({ variant: "primary", size: "sm" }), "shrink-0")}>{cta}</a>
          </div>
        </div>
      )}
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

type Gate = { kind: "loading" } | { kind: "signed-out" } | { kind: "applied"; id: string } | { kind: "ready"; draft: boolean };

function ApplyForm({ job }: { job: Job }) {
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (!data.user) return setGate({ kind: "signed-out" });
      const [apps, jobRow] = await Promise.all([fetchMyApplications().catch(() => []), supabase.from("jobs").select("id").eq("slug", job.slug).maybeSingle()]);
      const jobId = (jobRow.data as { id: string } | null)?.id;
      const draft = jobId ? (await supabase.from("application_drafts" as never).select("job_id").eq("user_id", data.user.id).eq("job_id", jobId).maybeSingle()).data : null;
      if (!alive) return;
      const active = apps.find((x) => x.job_slug === job.slug && x.status !== "withdrawn");
      setGate(active ? { kind: "applied", id: active.id } : { kind: "ready", draft: !!draft });
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => (e === "SIGNED_IN" || e === "SIGNED_OUT") && void load());
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [job.slug]);

  const box = "rounded-md border border-border bg-surface p-6 md:p-8";
  const next = `/careers/${job.slug}/apply`;
  if (gate.kind === "loading") return <div className={box}><p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p></div>;
  if (gate.kind === "applied") return <AppliedCard id={gate.id} title={job.title} already />;
  if (gate.kind === "signed-out") return (
    <div className={box}>
      <h2 className="text-h2 text-foreground">Apply</h2>
      <p className="text-body mt-4 text-muted-foreground">Sign in or create an applicant account to apply. You'll come straight back to this application, and you can follow it afterwards.</p>
      <div className="mt-6 flex flex-col gap-3">
        <Link to="/careers/sign-in" search={{ next }} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>Sign in to apply</Link>
        <Link to="/careers/sign-up" search={{ next }} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}>Create Applicant Account</Link>
      </div>
    </div>
  );
  return (
    <div className={box}>
      <h2 className="text-h2 text-foreground">Apply</h2>
      <p className="text-body mt-4 text-muted-foreground">{gate.draft ? "You have an unfinished application for this role. Pick up where you left off." : "A short step-by-step application. Your progress saves automatically, so you can finish later."}</p>
      <Link to="/careers/$slug/apply" params={{ slug: job.slug }} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6 w-full")}>{gate.draft ? "Continue Application" : job.details.application.cta_label || "Apply Now"}</Link>
    </div>
  );
}
