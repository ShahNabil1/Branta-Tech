import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, Panel, LoadingRow, ErrorNote, AdminButton, SelectInput, TextArea, ConfirmButton, formatDate, friendlyError } from "@/components/admin/cms";
import { ClientFilesPanel } from "@/components/admin/ClientFilesPanel";
import { LEAD_STATUSES, statusLabel } from "@/lib/inquiry";

export const Route = createFileRoute("/control-centre/_admin/leads/$id")({
  head: () => adminHead("Lead"),
  component: LeadView,
});

const safeLink = (u: string | null | undefined) => (u && /^https?:\/\/\S+$/.test(u) ? u : null);

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]"><dt className="text-small text-muted-foreground">{k}</dt><dd className="text-small min-w-0 break-words">{v || "—"}</dd></div>;
}

function LeadView() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cms", "lead", id], queryFn: () => must(supabase.from("leads").select("*").eq("id", id).single()) });
  const staff = useQuery({ queryKey: ["cms", "sales-staff"], queryFn: () => must(supabase.rpc("list_sales_staff")) });
  const client = useQuery({
    queryKey: ["cms", "lead-client", q.data?.client_user_id],
    enabled: !!q.data?.client_user_id,
    queryFn: () => must(supabase.from("profiles").select("full_name,email,phone,company").eq("id", q.data!.client_user_id!).maybeSingle()),
  });
  const [notes, setNotes] = useState("");
  useEffect(() => { if (q.data) setNotes(q.data.internal_notes ?? ""); }, [q.data]);

  async function update(patch: { status?: string; assigned_to?: string | null; internal_notes?: string | null }, msg: string) {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["cms"] });
  }
  async function openAttachment() {
    if (!q.data?.attachment_path) return;
    const { data, error } = await supabase.storage.from("client-private").createSignedUrl(q.data.attachment_path, 60, { download: q.data.attachment_name ?? true });
    if (error || !data) return void toast.error("Couldn't open the attachment.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function remove() {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    if (q.data?.attachment_path) await supabase.storage.from("client-private").remove([q.data.attachment_path]);
    qc.invalidateQueries({ queryKey: ["cms", "leads"] });
    navigate({ to: "/control-centre/leads" });
  }

  if (q.isLoading) return <LoadingRow />;
  if (q.error || !q.data) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  const l = q.data;
  const site = safeLink(l.website);
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Lead" title={l.name} description={`Received ${formatDate(l.created_at)} · ${statusLabel(l.source)}`} actions={<Link to="/control-centre/leads"><AdminButton>Back</AdminButton></Link>} />
      <div className="grid gap-6">
        <Panel title="Pipeline">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="Status" value={l.status} onChange={(e) => update({ status: e.target.value }, "Status updated")} options={LEAD_STATUSES.map((v) => ({ value: v, label: statusLabel(v) }))} />
            <SelectInput label="Owner" value={l.assigned_to ?? ""} onChange={(e) => update({ assigned_to: e.target.value || null }, "Owner updated")}
              options={[{ value: "", label: "Unassigned" }, ...(staff.data ?? []).map((s) => ({ value: s.id, label: s.full_name || s.email || "Staff" }))]} />
          </div>
        </Panel>
        <Panel title="Contact">
          <dl className="divide-y divide-border">
            <Row k="Email" v={<a href={`mailto:${l.email}`} className="underline underline-offset-4">{l.email}</a>} />
            <Row k="Phone" v={l.phone} />
            <Row k="Company" v={l.company} />
            <Row k="Website" v={site && <a href={site} target="_blank" rel="noreferrer" className="underline underline-offset-4">{site}</a>} />
            <Row k="Client account" v={l.client_user_id ? (client.data ? `${client.data.full_name ?? "—"} · ${client.data.email ?? ""}` : "Linked") : "Not signed in"} />
          </dl>
        </Panel>
        <Panel title="Project request">
          <dl className="divide-y divide-border">
            <Row k="Services" v={l.service_interest.join(", ")} />
            <Row k="Budget" v={l.budget_range} />
            <Row k="Timeline" v={l.timeline} />
            <Row k="Summary" v={<span className="whitespace-pre-line">{l.project_summary}</span>} />
            <Row k="References" v={l.reference_links.length > 0 && <ul>{l.reference_links.map((r) => safeLink(r)).filter(Boolean).map((r) => <li key={r}><a href={r!} target="_blank" rel="noreferrer" className="underline underline-offset-4">{r}</a></li>)}</ul>} />
            <Row k="Attachment" v={l.attachment_path && <AdminButton size="sm" onClick={openAttachment}>Download {l.attachment_name ?? "file"}</AdminButton>} />
          </dl>
        </Panel>
        <Panel title="Internal notes" description="Never shown to the client.">
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
          <div className="mt-3"><AdminButton variant="primary" disabled={notes === (l.internal_notes ?? "")} onClick={() => update({ internal_notes: notes.trim() || null }, "Notes saved")}>Save notes</AdminButton></div>
        </Panel>
        {l.client_user_id && <ClientFilesPanel clientId={l.client_user_id} />}
        <div><ConfirmButton title="Delete this lead?" description="The request and its attachment are removed permanently." onConfirm={remove}>Delete lead</ConfirmButton></div>
      </div>
    </div>
  );
}
