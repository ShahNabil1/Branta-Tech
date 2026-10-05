import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Section } from "@/components/layout/primitives";
import { ApplyWizard, AppliedCard } from "@/components/careers/ApplyWizard";
import { siteChromeQuery } from "@/lib/navigation";
import { jobQuery, type Job } from "@/lib/company.functions";
import { getMyResume, type MyResume } from "@/lib/careers.functions";
import { supabase } from "@/integrations/supabase/client";
import { ensureApplicantProfile } from "@/lib/applicant-auth";
import { fetchApplyPrefill, fetchMyApplications } from "@/lib/applicant-data";

export const Route = createFileRoute("/careers/$slug_/apply")({
  ssr: false,
  loader: async ({ context, params }) => {
    const [, job] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(jobQuery(params.slug))]);
    if (!job || "redirect" in job) throw notFound();
    return { title: job.title };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Apply${loaderData ? ` — ${loaderData.title}` : ""} | Branta Tech Careers` }, { name: "robots", content: "noindex" }] }),
  errorComponent: () => <p className="p-8">Something went wrong loading this application.</p>,
  notFoundComponent: () => (
    <SiteShell><Section tone="warm"><h1 className="text-h1">This role isn't open</h1><Link to="/careers" className="text-body mt-6 inline-block underline underline-offset-4">See open roles</Link></Section></SiteShell>
  ),
  component: ApplyPage,
});

type Gate = { kind: "loading" } | { kind: "applied"; id: string } | { kind: "done"; id: string } | { kind: "form"; userId: string; email: string; prefill: Record<string, string>; jobId: string | null; saved: MyResume };

function ApplyPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(jobQuery(slug));
  const job = data as Job;
  const navigate = useNavigate();
  const getSaved = useServerFn(getMyResume);
  const [gate, setGate] = useState<Gate>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return void navigate({ to: "/careers/sign-in", search: { next: `/careers/${slug}/apply` }, replace: true });
      await ensureApplicantProfile();
      const [apps, prefill, jobRow, saved] = await Promise.all([
        fetchMyApplications().catch(() => []), fetchApplyPrefill(u.user.id),
        supabase.from("jobs").select("id").eq("slug", slug).eq("status", "published").maybeSingle(), getSaved().catch(() => null),
      ]);
      if (!alive) return;
      const active = apps.find((x) => x.job_slug === slug && x.status !== "withdrawn");
      setGate(active ? { kind: "applied", id: active.id } : { kind: "form", userId: u.user.id, email: u.user.email ?? "", prefill, jobId: (jobRow.data as { id: string } | null)?.id ?? null, saved });
    })();
    return () => { alive = false; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const closed = job.window !== "open" || job.details.application.method !== "form";
  return (
    <SiteShell>
      <Section tone="warm">
        <Link to="/careers/$slug" params={{ slug }} className="text-small text-muted-foreground hover:text-foreground">← {job.title}</Link>
        <h1 className="text-h1 mt-6 max-w-[24ch] break-words text-foreground">Apply for {job.title}</h1>
        <div className="mt-10">
          {closed ? <p className="text-body text-muted-foreground">Applications for this role are closed.</p>
            : gate.kind === "loading" ? <p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>
            : gate.kind === "applied" ? <AppliedCard id={gate.id} title={job.title} already />
            : gate.kind === "done" ? <AppliedCard id={gate.id} title={job.title} submittedAt={new Date().toISOString()} />
            : <ApplyWizard job={job} jobId={gate.jobId} prefill={gate.prefill} email={gate.email} saved={gate.saved} userId={gate.userId} onDone={(id) => setGate({ kind: "done", id })} />}
        </div>
      </Section>
    </SiteShell>
  );
}
