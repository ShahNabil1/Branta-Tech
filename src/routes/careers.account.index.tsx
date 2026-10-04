import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { jobsQuery } from "@/lib/company.functions";
import { getMyResume } from "@/lib/careers.functions";
import { Loader2 } from "lucide-react";
import { Eyebrow } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/brand-button";
import { StatusPill } from "@/components/applicant/StatusPill";
import { displayName } from "@/lib/client-session";
import { canWithdraw, fetchMyApplications, fetchMyInterviews, fetchProfileCompleteness, INTERVIEW_STATUS_LABEL, fmtDate, fmtInterview, isUpcoming, statusLabel } from "@/lib/applicant-data";

export const Route = createFileRoute("/careers/account/")({
  component: AccountHome,
});

function Card({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-h3 mt-2 text-foreground">{value}</p>
      {hint && <p className="text-caption mt-1 truncate text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AccountHome() {
  const { user } = Route.useRouteContext();
  const apps = useQuery({ queryKey: ["applicant", "applications"], queryFn: fetchMyApplications });
  const ints = useQuery({ queryKey: ["applicant", "interviews"], queryFn: fetchMyInterviews });
  const list = apps.data ?? [];
  const active = list.filter((a) => canWithdraw(a.status)).length;
  const upcoming = (ints.data ?? []).filter(isUpcoming).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const latest = list[0];
  const loading = apps.isLoading || ints.isLoading;
  const resumeFn = useServerFn(getMyResume);
  const resume = useQuery({ queryKey: ["applicant", "resume"], queryFn: () => resumeFn() });
  const complete = useQuery({ queryKey: ["applicant", "completeness", !!resume.data], enabled: !resume.isLoading, queryFn: () => fetchProfileCompleteness(user.id, !!resume.data) });
  const jobs = useQuery(jobsQuery);
  const appliedSlugs = new Set(list.filter((a) => a.status !== "withdrawn").map((a) => a.job_slug));
  const openRoles = (jobs.data ?? []).filter((j) => !appliedSlugs.has(j.slug)).slice(0, 4);
  // Updates come only from real records: interview entries and non-initial application statuses.
  const updates = [
    ...(ints.data ?? []).map((i) => ({ key: `i${i.id}`, id: i.application_id, text: `Interview ${INTERVIEW_STATUS_LABEL[i.status]?.toLowerCase() ?? "updated"} — ${i.job_title}`, when: fmtInterview(i.scheduled_at, i.timezone) })),
    ...list.filter((a) => a.status !== "new").map((a) => ({ key: `a${a.id}`, id: a.id, text: `${a.job_title}: ${statusLabel(a.status)}`, when: "" })),
  ].slice(0, 6);

  return (
    <div className="max-w-3xl">
      <Eyebrow>BRANTA CAREERS</Eyebrow>
      <h1 className="text-h2 mt-4 text-foreground">Welcome, {displayName(user)}.</h1>
      <p className="text-body mt-3 text-muted-foreground">Signed in as {user.email}.</p>

      {loading ? (
        <p className="text-body mt-8 text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>
      ) : apps.error ? (
        <p className="text-body mt-8 text-muted-foreground">We couldn't load your applications. Please refresh the page.</p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card label="Active applications" value={String(active)} />
            <Card label="Upcoming interviews" value={String(upcoming.length)} hint={upcoming[0] ? fmtInterview(upcoming[0].scheduled_at, upcoming[0].timezone) : undefined} />
            <Card label="Latest application status" value={latest ? statusLabel(latest.status) : "—"} hint={latest?.job_title} />
          </div>

          {complete.data && complete.data.percent < 100 && (
            <div className="mt-6 rounded-md border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-small text-foreground">Profile {complete.data.percent}% complete</p>
                <Link to="/careers/account/profile" className="text-small text-muted-foreground hover:text-foreground">Update profile</Link>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${complete.data.percent}%` }} /></div>
              <p className="text-caption mt-2 text-muted-foreground">Missing: {complete.data.missing.join(", ")}</p>
            </div>
          )}

          {updates.length > 0 && (
            <section className="mt-10" aria-labelledby="updates">
              <h2 id="updates" className="text-h3 text-foreground">Updates</h2>
              <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
                {updates.map((u) => (
                  <li key={u.key} className="p-4">
                    <Link to="/careers/account/applications/$id" params={{ id: u.id }} className="text-small text-foreground hover:underline">{u.text}</Link>
                    {u.when && <p className="text-caption mt-1 text-muted-foreground">{u.when}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10" aria-labelledby="recent">
            <div className="flex items-center justify-between gap-4">
              <h2 id="recent" className="text-h3 text-foreground">Recent applications</h2>
              {list.length > 0 && <Link to="/careers/account/applications" className="text-small text-muted-foreground hover:text-foreground">View all</Link>}
            </div>
            {list.length === 0 ? (
              <div className="mt-4 rounded-md border border-border bg-surface p-6">
                <p className="text-body text-muted-foreground">You haven't applied for a role yet.</p>
                <Link to="/careers" className={buttonVariants({ variant: "primary", size: "md" }) + " mt-4"}>Browse open roles</Link>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
                {list.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-body truncate text-foreground">{a.job_title}</p>
                      <p className="text-caption mt-1 text-muted-foreground">Applied {fmtDate(a.submitted_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={a.status} />
                      <Link to="/careers/account/applications/$id" params={{ id: a.id }} className="text-small whitespace-nowrap text-foreground underline underline-offset-4">View Application</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10" aria-labelledby="open">
            <div className="flex items-center justify-between gap-4">
              <h2 id="open" className="text-h3 text-foreground">Open opportunities</h2>
              <Link to="/careers" className="text-small text-muted-foreground hover:text-foreground">All roles</Link>
            </div>
            {openRoles.length === 0 ? (
              <p className="text-body mt-4 text-muted-foreground">{jobs.isLoading ? "Loading…" : "No other open roles right now."}</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {openRoles.map((j) => (
                  <li key={j.slug} className="rounded-md border border-border bg-surface p-5">
                    <p className="text-body text-foreground">{j.title}</p>
                    <p className="text-caption mt-1 text-muted-foreground">{[j.type, j.location, j.workMode].filter(Boolean).join(" · ") || "Branta Tech"}</p>
                    <Link to="/careers/$slug" params={{ slug: j.slug }} className="text-small mt-3 inline-block text-foreground underline underline-offset-4">View role</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
