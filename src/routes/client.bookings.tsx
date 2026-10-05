import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/brand-button";
import { ClientHeader, Empty, Failed, Loading, Pill } from "@/components/client/ClientKit";
import { myBookingsQuery, formatDay, formatWhen } from "@/lib/client-data";
import { bookingStatusLabel } from "@/lib/booking";

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
                 <Pill>{bookingStatusLabel(b.status)}</Pill>
              </div>
              <p className="text-body mt-2 text-foreground">{formatWhen(b.requested_start_at, b.timezone)} <span className="text-muted-foreground">({b.timezone})</span></p>
               <p className="text-caption mt-1 text-muted-foreground">{b.booking_reference} · {b.duration_minutes} minutes · Requested {formatDay(b.created_at)}</p>
               {b.service_interest.length > 0 && <p className="text-small mt-3 text-muted-foreground">{b.service_interest.join(", ")}</p>}
               {b.public_notes && <p className="text-small mt-3 whitespace-pre-line text-foreground">{b.public_notes}</p>}
               {b.meeting_url && <a href={b.meeting_url} target="_blank" rel="noreferrer" className="text-small mt-4 inline-flex underline underline-offset-4">Open meeting link</a>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
