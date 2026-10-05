import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, Panel, LoadingRow, ErrorNote, AdminButton, TextArea, TextInput, ConfirmButton, formatDate, friendlyError } from "@/components/admin/cms";
import { BOOKING_STATUSES, statusLabel } from "@/lib/inquiry";
import { formatWhen } from "@/lib/client-data";

export const Route = createFileRoute("/control-centre/_admin/bookings/$id")({
  head: () => adminHead("Booking"),
  component: BookingView,
});

function BookingView() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cms", "booking", id], queryFn: () => must(supabase.from("bookings").select("*").eq("id", id).single()) });
  const [notes, setNotes] = useState("");
  const [meeting, setMeeting] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  useEffect(() => { if (q.data) { setNotes(q.data.internal_notes ?? ""); setMeeting(q.data.meeting_url ?? ""); setPublicNotes(q.data.public_notes ?? ""); } }, [q.data]);

  async function update(patch: { status?: string; internal_notes?: string | null; meeting_url?: string | null; public_notes?: string | null }, msg: string) {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["cms"] });
  }
  async function remove() {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["cms", "bookings"] });
    navigate({ to: "/control-centre/bookings" });
  }

  if (q.isLoading) return <LoadingRow />;
  if (q.error || !q.data) return <ErrorNote>{friendlyError(q.error)}</ErrorNote>;
  const b = q.data;
  const actions: Array<[string, string]> = [["confirmed", "Confirm"], ["reschedule_requested", "Request reschedule"], ["completed", "Mark completed"], ["no_show", "No-show"], ["cancelled", "Cancel"]];
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={`Booking ${b.booking_reference}`} title={b.name} description={`Received ${formatDate(b.created_at)}`} actions={<Link to="/control-centre/bookings"><AdminButton>Back</AdminButton></Link>} />
      <div className="grid gap-6">
        <Panel title={`Status: ${statusLabel(b.status)}`} description="No email is sent automatically — contact the requester yourself.">
          <div className="flex flex-wrap gap-2">
            {actions.filter(([s]) => s !== b.status).map(([s, label]) => <AdminButton key={s} variant={s === "confirmed" ? "primary" : "secondary"} onClick={() => update({ status: s }, `${statusLabel(s)}`)}>{label}</AdminButton>)}
            {b.status !== "requested" && <AdminButton variant="ghost" onClick={() => update({ status: "requested" }, "Reset to requested")}>Back to requested</AdminButton>}
          </div>
          <p className="text-caption mt-3 text-muted-foreground">Statuses: {BOOKING_STATUSES.map(statusLabel).join(", ")}</p>
        </Panel>
        <Panel title="Request">
          <dl className="grid gap-3 text-small">
            <div><dt className="text-muted-foreground">Requested time</dt><dd>{formatWhen(b.requested_start_at, b.timezone)} ({b.timezone}) · your time {formatWhen(b.requested_start_at)}</dd></div>
             <div><dt className="text-muted-foreground">Duration</dt><dd>{b.duration_minutes} minutes</dd></div>
             <div><dt className="text-muted-foreground">Services</dt><dd>{b.service_interest.length ? b.service_interest.join(", ") : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Topic</dt><dd className="break-words">{b.topic}</dd></div>
            <div><dt className="text-muted-foreground">Email</dt><dd><a href={`mailto:${b.email}`} className="underline underline-offset-4">{b.email}</a></dd></div>
            <div><dt className="text-muted-foreground">Phone</dt><dd>{b.phone ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Company</dt><dd>{b.company ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Notes from requester</dt><dd className="whitespace-pre-line break-words">{b.notes ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Client account</dt><dd>{b.client_user_id ? "Linked" : "Not signed in"}</dd></div>
          </dl>
        </Panel>
        <Panel title="Client update" description="The meeting link is shown to a signed-in client only after this booking is confirmed.">
          <div className="grid gap-4">
            <TextInput label="Meeting link" type="url" placeholder="https://" value={meeting} onChange={(e) => setMeeting(e.target.value)} />
            <TextArea label="Public instructions" value={publicNotes} onChange={(e) => setPublicNotes(e.target.value)} rows={4} />
            <AdminButton className="justify-self-start" variant="primary" disabled={meeting === (b.meeting_url ?? "") && publicNotes === (b.public_notes ?? "")} onClick={() => update({ meeting_url: meeting.trim() || null, public_notes: publicNotes.trim() || null }, "Client update saved")}>Save client update</AdminButton>
          </div>
        </Panel>
        <Panel title="Internal notes" description="Never shown to the client.">
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
          <div className="mt-3"><AdminButton variant="primary" disabled={notes === (b.internal_notes ?? "")} onClick={() => update({ internal_notes: notes.trim() || null }, "Notes saved")}>Save notes</AdminButton></div>
        </Panel>
        <div><ConfirmButton title="Delete this booking?" description="The call request is removed permanently." onConfirm={remove}>Delete booking</ConfirmButton></div>
      </div>
    </div>
  );
}
