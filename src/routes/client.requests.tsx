import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/brand-button";
import { ClientHeader, Empty, Failed, Loading, Pill } from "@/components/client/ClientKit";
import { myRequestsQuery, formatDay } from "@/lib/client-data";
import { clientStatusLabel } from "@/lib/inquiry";

export const Route = createFileRoute("/client/requests")({ component: Requests });

function Requests() {
  const q = useQuery(myRequestsQuery);
  return (
    <div>
      <ClientHeader title="Requests" intro="Project requests sent while signed in to this account."
        actions={<Link to="/start-a-project" className={buttonVariants({ variant: "primary", size: "md" })}>New request</Link>} />
      {q.isLoading ? <Loading /> : q.error ? <Failed /> : q.data!.length === 0 ? <Empty>No requests yet.</Empty> : (
        <ul className="flex flex-col gap-3">
          {q.data!.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-small font-medium text-foreground">{r.service_interest.join(", ") || "Project request"}</p>
                <Pill>{clientStatusLabel(r.status)}</Pill>
              </div>
              <p className="text-caption mt-1 text-muted-foreground">Submitted {formatDay(r.created_at)}</p>
              <p className="text-body mt-3 break-words text-foreground">{r.project_summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
