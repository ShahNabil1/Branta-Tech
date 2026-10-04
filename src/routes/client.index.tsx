import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/brand-button";
import { Card, ClientHeader, Empty, Failed, Loading, Pill } from "@/components/client/ClientKit";
import { myBookingsQuery, myFilesQuery, myRequestsQuery, formatDay, formatWhen, useMyProfile } from "@/lib/client-data";
import { clientStatusLabel, statusLabel } from "@/lib/inquiry";
import { displayName } from "@/lib/client-session";

export const Route = createFileRoute("/client/")({ component: Overview });

function Overview() {
  const { user } = Route.useRouteContext();
  const profile = useMyProfile(user.id);
  const req = useQuery(myRequestsQuery);
  const book = useQuery(myBookingsQuery);
  const files = useQuery(myFilesQuery(user.id));
  const p = profile.data;
  const name = p?.full_name || displayName(user);
  const checks = [p?.full_name, p?.phone, p?.company];
  const done = checks.filter(Boolean).length;

  return (
    <div>
      <ClientHeader title={`Welcome, ${name.split(" ")[0]}`} intro="Your requests, call bookings and shared files." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Recent requests" action={<Link to="/client/requests" className="text-small underline underline-offset-4">All</Link>}>
          {req.isLoading ? <Loading /> : req.error ? <Failed /> : req.data!.length === 0 ? (
            <div><Empty>No project requests yet.</Empty><Link to="/start-a-project" className={`${buttonVariants({ variant: "primary", size: "md" })} mt-4`}>Start a project</Link></div>
          ) : (
            <ul className="divide-y divide-border">
              {req.data!.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="text-small font-medium text-foreground">{r.service_interest.join(", ") || "Project request"}</p><p className="text-caption text-muted-foreground">{formatDay(r.created_at)}</p></div>
                  <Pill>{clientStatusLabel(r.status)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Call bookings" action={<Link to="/client/bookings" className="text-small underline underline-offset-4">All</Link>}>
          {book.isLoading ? <Loading /> : book.error ? <Failed /> : book.data!.length === 0 ? (
            <div><Empty>No call requests yet.</Empty><Link to="/book-a-call" className={`${buttonVariants({ variant: "secondary", size: "md" })} mt-4`}>Book a call</Link></div>
          ) : (
            <ul className="divide-y divide-border">
              {book.data!.slice(0, 3).map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="text-small truncate font-medium text-foreground">{b.topic}</p><p className="text-caption text-muted-foreground">{formatWhen(b.requested_start_at, b.timezone)} ({b.timezone})</p></div>
                  <Pill>{statusLabel(b.status)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Shared files">
          {files.isLoading ? <Loading /> : files.error ? <Failed /> : (
            <p className="text-body text-foreground">{files.data!.length === 0 ? "No files shared with you yet." : `${files.data!.length} file${files.data!.length === 1 ? "" : "s"} shared with you.`} <Link to="/client/files" className="underline underline-offset-4">Open</Link></p>
          )}
        </Card>
        <Card title="Profile">
          {profile.isLoading ? <Loading /> : (
            <p className="text-body text-foreground">{done === checks.length ? "Your profile is complete." : `${done} of ${checks.length} details added (name, phone, company).`} <Link to="/client/profile" className="underline underline-offset-4">Edit profile</Link></p>
          )}
        </Card>
      </div>
    </div>
  );
}
