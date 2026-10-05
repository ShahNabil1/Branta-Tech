import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, Panel, LoadingRow, ErrorNote, AdminButton, SelectInput, TextArea, ConfirmButton, EmptyState, formatDate, friendlyError } from "@/components/admin/cms";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/ats";
import { InterviewsPanel } from "@/components/admin/InterviewsPanel";
import { DOC_LABEL, extraText, formatMonths, highestEducation, readRecords, topSkills, totalExperienceMonths, yearSpan } from "@/lib/application-records";
import { exportApplications, type ExportApp } from "@/lib/application-export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-centre/_admin/careers/applications/$id")({
  head: () => adminHead("Application"),
  component: ApplicationView,
});

const safeLink = (u: string | null | undefined) => (u && /^https?:\/\/\S+$/.test(u) ? u : null);
const TABS = ["Overview", "Personal", "Education", "Experience", "Skills", "Documents", "Answers", "Notes", "Status / Interview"] as const;
type Tab = (typeof TABS)[number];

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== "" && v !== null && v !== undefined);
  if (!shown.length) return <EmptyState>Nothing provided.</EmptyState>;
  return <dl className="grid gap-4 sm:grid-cols-2">{shown.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-caption text-muted-foreground">{k}</dt><dd className="text-small whitespace-pre-line break-words">{v}</dd></div>)}</dl>;
}
const ext = (u: string | null) => { const l = safeLink(u); return l ? <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{l.replace(/^https?:\/\//, "")}</a> : ""; };

function ApplicationView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<Tab>("Overview");
  const q = useQuery({ queryKey: ["cms", "application", id], queryFn: () => must(supabase.from("job_applications").select("*,jobs(title,slug,department)").eq("id", id).single()) });
  const notes = useQuery({ queryKey: ["cms", "application-notes", id], queryFn: () => must(supabase.from("application_notes").select("id,note,created_at,author_user_id").eq("application_id", id).order("created_at", { ascending: false })) });

  async function setStatus(status: string) {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["cms"] });
  }
  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("career-private").createSignedUrl(path, 60, { download: true });
    if (error || !data) return void toast.error("Couldn't open the file. You may not have access.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function addNote() {
    const { data: u } = await supabase.auth.getUser();
    if (!note.trim() || !u.user) return;
    const { error } = await supabase.from("application_notes").insert({ application_id: id, note: note.trim(), author_user_id: u.user.id });
    if (error) return void toast.error(friendlyError(error));
    setNote("");
    qc.invalidateQueries({ queryKey: ["cms", "application-notes", id] });
  }
  async function deleteNote(nid: string) {
    const { error } = await supabase.from("application_notes").delete().eq("id", nid);
    if (error) return void toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["cms", "application-notes", id] });
  }

  if (q.isLoading) return <LoadingRow />;
  if (q.error || !q.data) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  const a = q.data;
  const r = readRecords(a.extra);
  const x = (k: string) => extraText(a.extra, k);
  const ans = Object.values((a.answers && typeof a.answers === "object" ? a.answers : {}) as Record<string, { label: string; value: string | string[] }>);
  const docs: [string, string][] = [...(a.resume_url ? [["CV / Resume", a.resume_url] as [string, string]] : []), ...Object.keys(DOC_LABEL).filter((k) => k !== "resume" && x(k)).map((k) => [DOC_LABEL[k]!, x(k)] as [string, string])];
  const exportOne = async () => {
    try { await exportApplications([a as unknown as ExportApp], `applicant-${a.full_name}-${id.slice(0, 8)}.xlsx`); toast.success("Excel file downloaded"); }
    catch { toast.error("Export failed. Please try again."); }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow={a.jobs?.title ?? "Application"} title={a.full_name} description={`Submitted ${formatDate(a.submitted_at)} · Ref. ${id.slice(0, 8).toUpperCase()}`}
        actions={<div className="flex gap-2"><AdminButton onClick={exportOne}><FileSpreadsheet className="size-4" aria-hidden />Export to Excel</AdminButton><Link to="/control-centre/careers/applications"><AdminButton>Back</AdminButton></Link></div>} />
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
        {TABS.map((t) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
          className={cn("text-caption rounded-sm px-3 py-1.5 font-medium transition-colors", tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{t}{t === "Notes" && notes.data?.length ? ` (${notes.data.length})` : ""}</button>)}
      </div>

      {tab === "Overview" && <div className="grid gap-6">
        <Panel title="Summary" description="Derived only from what the applicant submitted.">
          <Dl rows={[["Job applied for", a.jobs?.title ?? ""], ["Status", <span className="capitalize">{a.status}</span>], ["Email", <a href={`mailto:${a.email}`} className="underline underline-offset-4">{a.email}</a>], ["Phone", a.phone ? <a href={`tel:${a.phone}`} className="underline underline-offset-4">{a.phone}</a> : ""],
            ["Location", [a.location, x("city"), x("country")].filter(Boolean).join(", ")], ["Application date", formatDate(a.submitted_at)],
            ["Highest education", highestEducation(r) || r.legacy_education], ["Total experience", formatMonths(totalExperienceMonths(r)) || r.legacy_experience], ["Top skills", topSkills(r, 5).join(", ")],
            ["Expected salary", x("expected_salary")], ["Availability", x("joining_date")], ["Notice period", x("notice_period")],
            ["Portfolio", ext(a.portfolio_url)], ["LinkedIn", ext(a.linkedin_url)],
            ["Eligibility", a.eligibility_passed === null ? "" : a.eligibility_passed ? "Meets the screening answers" : "Does not meet one or more screening answers"]]} />
          {a.resume_url && <AdminButton className="mt-6" onClick={() => openFile(a.resume_url!)}><Download className="size-4" aria-hidden /> Download CV</AdminButton>}
        </Panel>
      </div>}

      {tab === "Personal" && <Panel title="Personal details">
        <Dl rows={[["Full name", a.full_name], ["Email", a.email], ["Phone", a.phone], ["Current address", a.location ?? ""], ["City / District", x("city")], ["Country", x("country")], ["Date of birth", x("dob")], ["Gender", x("gender")], ["Current status", x("current_status")],
          ["LinkedIn", ext(a.linkedin_url)], ["Portfolio", ext(a.portfolio_url)], ["Website", ext(x("website_url"))], ["GitHub", ext(x("github_url"))], ["Behance", ext(x("behance_url"))]]} />
        {a.cover_note && <div className="mt-6"><p className="text-caption text-muted-foreground">Cover letter</p><p className="text-small mt-1 whitespace-pre-line">{a.cover_note}</p></div>}
      </Panel>}

      {tab === "Education" && <Panel title="Education">
        {r.education.length ? <ol className="grid gap-4">{r.education.map((e, n) => (
          <li key={n} className="rounded-sm border border-border p-4">
            <p className="text-small font-medium">{[e.level, e.field].filter(Boolean).join(" in ")}{e.major && ` (${e.major})`}</p>
            <p className="text-small text-muted-foreground">{e.institution}{yearSpan(e.start_year, e.end_year, e.is_current) && ` · ${yearSpan(e.start_year, e.end_year, e.is_current)}`}{e.is_current && " · Current student"}</p>
            {e.result && <p className="text-small mt-1">Result: {e.result}</p>}
            {e.description && <p className="text-small mt-2 whitespace-pre-line text-muted-foreground">{e.description}</p>}
          </li>))}</ol>
          : r.legacy_education ? <p className="text-small whitespace-pre-line">{r.legacy_education}</p> : <EmptyState>No education submitted.</EmptyState>}
      </Panel>}

      {tab === "Experience" && <div className="grid gap-6">
        <Panel title="Work experience" description={r.has_experience === "no" ? "The applicant said they have no work experience." : undefined}>
          {r.experience.length ? <ol className="grid gap-4">{r.experience.map((e, n) => (
            <li key={n} className="rounded-sm border border-border p-4">
              <p className="text-small font-medium">{e.title} — {e.company}</p>
              <p className="text-small text-muted-foreground">{[e.employment_type, yearSpan(e.start_date, e.end_date, e.is_current)].filter(Boolean).join(" · ")}</p>
              {e.responsibilities && <><p className="text-caption mt-3 text-muted-foreground">Responsibilities</p><p className="text-small whitespace-pre-line">{e.responsibilities}</p></>}
              {e.achievements && <><p className="text-caption mt-3 text-muted-foreground">Key achievements</p><p className="text-small whitespace-pre-line">{e.achievements}</p></>}
            </li>))}</ol>
            : r.legacy_experience ? <p className="text-small whitespace-pre-line">{r.legacy_experience}</p> : r.has_experience !== "no" && <EmptyState>No experience submitted.</EmptyState>}
        </Panel>
        <Panel title="Current employment & availability"><Dl rows={[["Current company", x("current_company")], ["Current position", x("current_position")], ["Current salary", x("current_salary")], ["Expected salary", x("expected_salary")], ["Notice period", x("notice_period")], ["Available joining date", x("joining_date")]]} /></Panel>
      </div>}

      {tab === "Skills" && <div className="grid gap-6">
        <Panel title="Skills">{r.skills.length ? <ul className="grid gap-2 sm:grid-cols-2">{r.skills.map((s, n) => <li key={n} className="text-small flex justify-between gap-3 rounded-sm border border-border px-3 py-2"><span>{s.name}</span><span className="text-muted-foreground">{s.level || "—"}</span></li>)}</ul> : <EmptyState>No skills submitted.</EmptyState>}</Panel>
        <Panel title="Languages">{r.languages.length ? <ul className="grid gap-2 sm:grid-cols-2">{r.languages.map((s, n) => <li key={n} className="text-small flex justify-between gap-3 rounded-sm border border-border px-3 py-2"><span>{s.language}</span><span className="text-muted-foreground">{s.proficiency || "—"}</span></li>)}</ul> : <EmptyState>No languages submitted.</EmptyState>}</Panel>
      </div>}

      {tab === "Documents" && <Panel title="Documents" description="Private files. Links are created on demand and expire after one minute.">
        {docs.length ? <ul className="divide-y divide-border">{docs.map(([label, path]) => (
          <li key={label} className="flex items-center justify-between gap-3 py-3"><span className="text-small">{label}</span><AdminButton size="sm" onClick={() => openFile(path)}><Download className="size-4" aria-hidden />Download</AdminButton></li>))}</ul>
          : <EmptyState>No documents submitted.</EmptyState>}
      </Panel>}

      {tab === "Answers" && <Panel title="Job questions" {...(a.eligibility_passed === null ? {} : { description: a.eligibility_passed ? "Eligibility: meets the screening answers." : "Eligibility: does not meet one or more screening answers (not rejected unless auto-reject is on)." })}>
        {ans.length ? <dl className="grid gap-4">{ans.map((q, n) => {
          const v = Array.isArray(q.value) ? q.value.join(", ") : String(q.value);
          return <div key={n}><dt className="text-caption text-muted-foreground">{q.label}</dt><dd className="text-small whitespace-pre-line">{v.startsWith("file:") ? <AdminButton size="sm" onClick={() => openFile(v.slice(5))}>Download file</AdminButton> : v}</dd></div>;
        })}</dl> : <EmptyState>No answers submitted.</EmptyState>}
      </Panel>}

      {tab === "Notes" && <Panel title="Internal notes" description="Only admins and HR can see these. Never shown to the applicant or included in exports.">
        <div className="grid gap-3">
          <TextArea label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} />
          <div><AdminButton variant="primary" disabled={!note.trim()} onClick={addNote}>Add note</AdminButton></div>
        </div>
        <ul className="mt-6 divide-y divide-border">
          {(notes.data ?? []).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-3">
              <div><p className="text-small whitespace-pre-line">{n.note}</p><p className="text-caption mt-1 text-muted-foreground">{formatDate(n.created_at)}</p></div>
              <ConfirmButton title="Delete note?" description="This removes the note permanently." onConfirm={() => deleteNote(n.id)}>Delete</ConfirmButton>
            </li>
          ))}
        </ul>
        {notes.data?.length === 0 && <EmptyState>No notes yet.</EmptyState>}
      </Panel>}

      {tab === "Status / Interview" && <div className="grid gap-6">
        <Panel title="Status"><div className="max-w-xs"><SelectInput label="Pipeline stage" value={a.status} options={APPLICATION_STATUS_OPTIONS} onChange={(e) => setStatus(e.target.value)} /></div></Panel>
        <InterviewsPanel applicationId={id} />
      </div>}
    </div>
  );
}
