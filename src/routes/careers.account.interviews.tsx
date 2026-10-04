import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchMyInterviews, fmtInterview, INTERVIEW_STATUS_LABEL, INTERVIEW_TYPE_LABEL, isUpcoming, type MyInterview } from "@/lib/applicant-data";

export const Route = createFileRoute("/careers/account/interviews")({
  head: () => ({ meta: [{ title: "Interviews — Branta Careers" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Interviews,
});

const safeUrl = (u: string | null) => (u && /^https:\/\/\S+$/.test(u) ? u : null);

function Item({ i }: { i: MyInterview }) {
  const link = safeUrl(i.meeting_url);
  const done = i.status === "cancelled" || i.status === "completed";
  return (
    <li className="rounded-md border border-border bg-surface p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-body text-foreground">{i.job_title}</p>
          <p className={cn("text-small mt-1", i.status === "cancelled" ? "text-muted-foreground line-through" : "text-foreground")}>{fmtInterview(i.scheduled_at, i.timezone)}</p>
          <p className="text-caption mt-1 text-muted-foreground">{INTERVIEW_TYPE_LABEL[i.interview_type] ?? "Interview"} · {i.timezone}</p>
        </div>
        <span className={cn("text-caption w-fit shrink-0 rounded-full border px-2.5 py-1", done ? "border-border text-muted-foreground" : "border-accent/40 text-accent")}>{INTERVIEW_STATUS_LABEL[i.status] ?? i.status}</span>
      </div>
      {!done && (link || i.location) && (
        <div className="text-small mt-4 flex flex-col gap-1">
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-foreground underline underline-offset-4">Join meeting</a>}
          {i.location && <p className="text-foreground">{i.location}</p>}
        </div>
      )}
      {i.public_notes && <p className="text-small mt-4 whitespace-pre-line text-muted-foreground">{i.public_notes}</p>}
      <Link to="/careers/account/applications/$id" params={{ id: i.application_id }} className="text-caption mt-4 inline-block text-muted-foreground hover:text-foreground">View application →</Link>
    </li>
  );
}

function Interviews() {
  const q = useQuery({ queryKey: ["applicant", "interviews"], queryFn: fetchMyInterviews });
  const all = q.data ?? [];
  const upcoming = all.filter(isUpcoming).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = all.filter((i) => !isUpcoming(i));
  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 text-foreground">Interviews</h1>
      <p className="text-body mt-3 text-muted-foreground">When our team schedules an interview with you, the details appear here.</p>
      {q.isLoading ? <p className="text-body mt-8 text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>
        : q.error ? <p className="text-body mt-8 text-muted-foreground">We couldn't load your interviews. Please refresh the page.</p>
        : all.length === 0 ? <div className="mt-8 rounded-md border border-border bg-surface p-6"><p className="text-body text-muted-foreground">No interviews scheduled yet.</p></div>
        : (
          <>
            {upcoming.length > 0 && <section className="mt-8"><h2 className="text-h3 text-foreground">Upcoming</h2><ul className="mt-4 grid gap-4">{upcoming.map((i) => <Item key={i.id} i={i} />)}</ul></section>}
            {past.length > 0 && <section className="mt-10"><h2 className="text-h3 text-foreground">Past and cancelled</h2><ul className="mt-4 grid gap-4">{past.map((i) => <Item key={i.id} i={i} />)}</ul></section>}
          </>
        )}
    </div>
  );
}
