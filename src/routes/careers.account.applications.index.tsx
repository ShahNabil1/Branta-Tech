import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";
import { AccountTitle } from "@/components/applicant/ComingNext";
import { StatusPill } from "@/components/applicant/StatusPill";
import { buttonVariants } from "@/components/ui/brand-button";
import { fetchMyApplications, fmtDate } from "@/lib/applicant-data";

export const Route = createFileRoute("/careers/account/applications/")({ component: MyApplications });

function MyApplications() {
  const q = useQuery({ queryKey: ["applicant", "applications"], queryFn: fetchMyApplications });
  return (
    <div className="max-w-3xl">
      <AccountTitle title="My Applications" intro="Every role you've applied for at Branta." />
      {q.isLoading ? <p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>
        : q.isError ? <p role="alert" className="text-body text-destructive">We couldn't load your applications. Please refresh.</p>
        : !q.data?.length ? (
          <div className="rounded-sm border border-border bg-surface p-6 md:p-8">
            <p className="text-body text-foreground">You haven't applied for any roles yet.</p>
            <Link to="/careers" className={buttonVariants({ variant: "primary", size: "md" }) + " mt-5"}>Browse open roles</Link>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-sm border border-border bg-surface">
            {q.data.map((a) => (
              <li key={a.id}>
                <Link to="/careers/account/applications/$id" params={{ id: a.id }} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="text-body truncate font-medium text-foreground">{a.job_title}</p>
                    <p className="text-small mt-1 text-muted-foreground">{[a.employment_type, `Applied ${fmtDate(a.submitted_at)}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <StatusPill status={a.status} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
