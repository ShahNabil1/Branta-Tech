import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2 } from "lucide-react";
import { StatusPill } from "@/components/applicant/StatusPill";
import { FormAlert } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { canWithdraw, fetchMyApplication, fmtDate, withdrawMyApplication } from "@/lib/applicant-data";
import { getMyResumeLink } from "@/lib/careers.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/account/applications/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["applicant", "application", id], queryFn: () => fetchMyApplication(id) });
  const resumeLink = useServerFn(getMyResumeLink);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [dl, setDl] = useState(false);

  const back = <Link to="/careers/account/applications" className="text-small text-muted-foreground hover:text-foreground">← My Applications</Link>;
  if (q.isLoading) return <p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>;
  const a = q.data;
  if (!a) return <div className="max-w-2xl">{back}<p className="text-body mt-6 text-foreground">We couldn't find that application.</p></div>;

  async function withdraw() {
    if (busy) return;
    setBusy(true);
    const ok = await withdrawMyApplication(id);
    setBusy(false); setConfirming(false);
    setMsg(ok ? { tone: "info", text: "Your application has been withdrawn." } : { tone: "error", text: "We couldn't withdraw this application. Please try again." });
    if (ok) await qc.invalidateQueries({ queryKey: ["applicant"] });
  }
  async function download() {
    setDl(true);
    try {
      const r = await resumeLink({ data: { id } });
      if (r.url) window.location.assign(r.url);
      else setMsg({ tone: "error", text: "Your CV isn't available right now." });
    } catch { setMsg({ tone: "error", text: "Your CV isn't available right now." }); }
    setDl(false);
  }

  const row = (label: string, v: React.ReactNode) => (
    <div className="grid gap-1 border-b border-border py-4 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <dt className="text-small text-muted-foreground">{label}</dt><dd className="text-body min-w-0 break-words text-foreground">{v}</dd>
    </div>
  );
  const link = (u: string | null) => (u ? <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{u}</a> : <span className="text-muted-foreground">Not provided</span>);

  return (
    <div className="max-w-3xl">
      {back}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h2 break-words text-foreground">{a.job_title}</h1>
          <p className="text-small mt-2 text-muted-foreground">{[a.employment_type, `Applied ${fmtDate(a.submitted_at)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <StatusPill status={a.status} />
      </div>
      {msg && <div className="mt-6"><FormAlert tone={msg.tone}>{msg.text}</FormAlert></div>}

      <dl className="mt-8 rounded-sm border border-border bg-surface px-5 md:px-7">
        {row("Name", a.full_name)}
        {row("Email", a.email)}
        {row("Phone", a.phone)}
        {row("Location", a.location || <span className="text-muted-foreground">Not provided</span>)}
        {row("Portfolio", link(a.portfolio_url))}
        {row("LinkedIn", link(a.linkedin_url))}
        {row("CV / résumé", a.has_resume
          ? <button type="button" onClick={download} disabled={dl} className="inline-flex items-center gap-2 underline underline-offset-4">{dl ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download your CV</button>
          : <span className="text-muted-foreground">Not attached</span>)}
        {row("Cover note", <p className="whitespace-pre-line">{a.cover_note}</p>)}
      </dl>
      <p className="text-caption mt-3 text-muted-foreground">This role had no extra questions.</p>

      {canWithdraw(a.status) && (
        <div className="mt-10 rounded-sm border border-border p-5 md:p-7">
          <h2 className="text-h4 text-foreground">Withdraw application</h2>
          <p className="text-small mt-2 text-muted-foreground">Withdrawing tells our team you're no longer interested in this role. You can apply again later.</p>
          {confirming ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={withdraw} disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "md" }), "bg-destructive hover:bg-destructive/90")}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}Yes, withdraw
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={buttonVariants({ variant: "secondary", size: "md" })}>Keep application</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={cn(buttonVariants({ variant: "secondary", size: "md" }), "mt-5")}>Withdraw…</button>
          )}
        </div>
      )}
    </div>
  );
}
