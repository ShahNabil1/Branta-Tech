import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Eyebrow } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/brand-button";
import { StatusPill } from "@/components/applicant/StatusPill";
import { displayName } from "@/lib/client-session";
import { canWithdraw, fetchMyApplications, fetchMyInterviews, fmtDate, fmtInterview, isUpcoming, statusLabel } from "@/lib/applicant-data";

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
        </>
      )}
    </div>
  );
}
