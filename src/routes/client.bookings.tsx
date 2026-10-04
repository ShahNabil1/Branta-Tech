import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/brand-button";
import { ClientHeader, Empty, Failed, Loading, Pill } from "@/components/client/ClientKit";
import { myBookingsQuery, formatDay, formatWhen } from "@/lib/client-data";
import { statusLabel } from "@/lib/inquiry";

export const Route = createFileRoute("/client/bookings")({ component: Bookings });

function Bookings() {
  const q = useQuery(myBookingsQuery);
  return (
    <div>
      <ClientHeader title="Bookings" intro="Call requests from this account. We confirm each time with you personally."
        actions={<Link to="/book-a-call" className={buttonVariants({ variant: "primary", size: "md" })}>Request a call</Link>} />
      {q.isLoading ? <Loading /> : q.error ? <Failed /> : q.data!.length === 0 ? <Empty>No call requests yet.</Empty> : (
        <ul className="flex flex-col gap-3">
          {q.data!.map((b) => (
            <li key={b.id} className="rounded-md border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-small min-w-0 break-words font-medium text-foreground">{b.topic}</p>
                <Pill>{statusLabel(b.status)}</Pill>
              </div>
              <p className="text-body mt-2 text-foreground">{formatWhen(b.requested_start_at, b.timezone)} <span className="text-muted-foreground">({b.timezone})</span></p>
              <p className="text-caption mt-1 text-muted-foreground">Requested {formatDay(b.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
