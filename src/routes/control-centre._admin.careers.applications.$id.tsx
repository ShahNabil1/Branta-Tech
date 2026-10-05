import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, Panel, LoadingRow, ErrorNote, AdminButton, SelectInput, TextArea, ConfirmButton, EmptyState, formatDate, friendlyError } from "@/components/admin/cms";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/ats";
import { InterviewsPanel } from "@/components/admin/InterviewsPanel";

export const Route = createFileRoute("/control-centre/_admin/careers/applications/$id")({
  head: () => adminHead("Application"),
  component: ApplicationView,
});

const safeLink = (u: string | null) => (u && /^https?:\/\/\S+$/.test(u) ? u : null);

function ApplicationView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["cms", "application", id], queryFn: () => must(supabase.from("job_applications").select("*,jobs(title,slug)").eq("id", id).single()) });
  const notes = useQuery({ queryKey: ["cms", "application-notes", id], queryFn: () => must(supabase.from("application_notes").select("id,note,created_at,author_user_id").eq("application_id", id).order("created_at", { ascending: false })) });

  async function setStatus(status: string) {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["cms"] });
  }
  async function openResume() { if (q.data?.resume_url) await openFile(q.data.resume_url); }
  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("career-private").createSignedUrl(path, 60, { download: true });
    if (error || !data) return void toast.error("Couldn't open the CV. You may not have access.");
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
  const portfolio = safeLink(a.portfolio_url), linkedin = safeLink(a.linkedin_url);
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={a.jobs?.title ?? "Application"} title={a.full_name} description={`Submitted ${formatDate(a.submitted_at)}`} actions={<Link to="/control-centre/careers/applications"><AdminButton>Back</AdminButton></Link>} />
      <div className="grid gap-6">
        <Panel title="Status">
          <div className="max-w-xs"><SelectInput label="Pipeline stage" value={a.status} options={APPLICATION_STATUS_OPTIONS} onChange={(e) => setStatus(e.target.value)} /></div>
        </Panel>
        <InterviewsPanel applicationId={id} />
        <Panel title="Details">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-caption text-muted-foreground">Email</dt><dd className="text-small"><a href={`mailto:${a.email}`} className="underline underline-offset-4">{a.email}</a></dd></div>
            <div><dt className="text-caption text-muted-foreground">Phone</dt><dd className="text-small"><a href={`tel:${a.phone}`} className="underline underline-offset-4">{a.phone}</a></dd></div>
            <div><dt className="text-caption text-muted-foreground">Location</dt><dd className="text-small">{a.location ?? "—"}</dd></div>
            <div><dt className="text-caption text-muted-foreground">Links</dt><dd className="text-small flex gap-3">
              {portfolio ? <a href={portfolio} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">Portfolio</a> : null}
              {linkedin ? <a href={linkedin} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">LinkedIn</a> : null}
              {!portfolio && !linkedin && "—"}
            </dd></div>
          </dl>
          <div className="mt-6">
            <p className="text-caption text-muted-foreground">Cover note</p>
            <p className="text-small mt-1 whitespace-pre-line">{a.cover_note}</p>
          </div>
          {a.resume_url && <AdminButton className="mt-6" onClick={openResume}><Download className="size-4" aria-hidden /> Download CV</AdminButton>}
        </Panel>
        <ApplicationExtras extra={a.extra} answers={a.answers} eligible={a.eligibility_passed} openFile={openFile} />
        <Panel title="Internal notes" description="Only admins and HR can see these.">
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
        </Panel>
      </div>
    </div>
  );
}

const EXTRA_LABEL: Record<string, string> = { website_url: "Website", current_company: "Current company", current_position: "Current position", education: "Education", experience: "Experience", expected_salary: "Expected salary", current_salary: "Current salary", joining_date: "Available joining date" };
function ApplicationExtras({ extra, answers, eligible, openFile }: { extra: unknown; answers: unknown; eligible: boolean | null; openFile: (p: string) => void }) {
  const ex = (extra && typeof extra === "object" ? extra : {}) as Record<string, string>;
  const ans = Object.values((answers && typeof answers === "object" ? answers : {}) as Record<string, { label: string; value: string | string[] }>);
  const rows = Object.entries(EXTRA_LABEL).filter(([k]) => ex[k]);
  if (!rows.length && !ans.length && !ex["portfolio_file"] && !ex["photo"] && eligible === null) return null;
  return (
    <Panel title="Application answers" description={eligible === null ? undefined : eligible ? "Eligibility: meets the screening answers." : "Eligibility: does not meet one or more screening answers (not rejected unless auto-reject is on)."}>
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map(([k, l]) => <div key={k}><dt className="text-caption text-muted-foreground">{l}</dt><dd className="text-small whitespace-pre-line">{ex[k]}</dd></div>)}
        {ans.map((x, i) => {
          const v = Array.isArray(x.value) ? x.value.join(", ") : String(x.value);
          return <div key={i} className="sm:col-span-2"><dt className="text-caption text-muted-foreground">{x.label}</dt><dd className="text-small whitespace-pre-line">{v.startsWith("file:") ? <AdminButton size="sm" onClick={() => openFile(v.slice(5))}>Download file</AdminButton> : v}</dd></div>;
        })}
      </dl>
      <div className="mt-4 flex gap-2">
        {ex["portfolio_file"] && <AdminButton size="sm" onClick={() => openFile(ex["portfolio_file"]!)}>Portfolio file</AdminButton>}
        {ex["photo"] && <AdminButton size="sm" onClick={() => openFile(ex["photo"]!)}>Profile photo</AdminButton>}
      </div>
    </Panel>
  );
}
