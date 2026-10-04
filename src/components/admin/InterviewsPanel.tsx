import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, ConfirmButton, EmptyState, friendlyError, LoadingRow, Panel, SelectInput, TextArea, TextInput } from "@/components/admin/cms";
import { fmtInterview, INTERVIEW_STATUS_LABEL, INTERVIEW_TYPE_LABEL } from "@/lib/applicant-data";

// job_interviews is newer than the generated types.
const db = supabase as unknown as { from: (t: string) => any };

type Interview = {
  id: string; scheduled_at: string; timezone: string; interview_type: string; meeting_url: string | null;
  location: string | null; public_notes: string | null; internal_notes: string | null; status: string;
};
type Draft = { date: string; time: string; timezone: string; interview_type: string; meeting_url: string; location: string; public_notes: string; internal_notes: string };

const TYPE_OPTIONS = Object.entries(INTERVIEW_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const TZ_OPTIONS = ["Asia/Dhaka", "UTC", "Europe/London", "America/New_York", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore"].map((v) => ({ value: v, label: v }));
const EMPTY: Draft = { date: "", time: "", timezone: "Asia/Dhaka", interview_type: "video", meeting_url: "", location: "", public_notes: "", internal_notes: "" };

/** Converts a wall-clock date+time in `tz` to a UTC ISO string. */
function toUtc(date: string, time: string, tz: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asTz = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return new Date(guess.getTime() - (asTz - guess.getTime())).toISOString();
}
function fromUtc(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

export function InterviewsPanel({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient();
  const key = ["cms", "interviews", applicationId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db.from("job_interviews").select("*").eq("application_id", applicationId).order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Interview[];
    },
  });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [d, setD] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));

  function startNew() { setD(EMPTY); setEditing("new"); }
  function startEdit(i: Interview) {
    const { date, time } = fromUtc(i.scheduled_at, i.timezone);
    setD({ date, time, timezone: i.timezone, interview_type: i.interview_type, meeting_url: i.meeting_url ?? "", location: i.location ?? "", public_notes: i.public_notes ?? "", internal_notes: i.internal_notes ?? "" });
    setEditing(i.id);
  }

  async function save() {
    if (busy) return;
    if (!d.date || !d.time) return void toast.error("Pick a date and time.");
    if (d.meeting_url && !/^https:\/\/\S+$/.test(d.meeting_url.trim())) return void toast.error("Meeting link must start with https://");
    const n = (v: string) => (v.trim() ? v.trim() : null);
    const row = {
      scheduled_at: toUtc(d.date, d.time, d.timezone), timezone: d.timezone, interview_type: d.interview_type,
      meeting_url: n(d.meeting_url), location: n(d.location), public_notes: n(d.public_notes), internal_notes: n(d.internal_notes),
    };
    setBusy(true);
    let error;
    if (editing === "new") {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await db.from("job_interviews").insert({ ...row, application_id: applicationId, status: "scheduled", created_by: u.user?.id ?? null }));
      if (!error) await supabase.from("job_applications").update({ status: "interview" }).eq("id", applicationId).in("status", ["new", "reviewing", "shortlisted"]);
    } else {
      const prev = q.data?.find((x) => x.id === editing);
      const moved = prev && prev.scheduled_at !== row.scheduled_at;
      ({ error } = await db.from("job_interviews").update({ ...row, ...(moved && prev.status !== "completed" ? { status: "rescheduled" } : {}) }).eq("id", editing));
    }
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    toast.success(editing === "new" ? "Interview scheduled" : "Interview updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["cms"] });
  }
  async function setStatus(id: string, status: string) {
    const { error } = await db.from("job_interviews").update({ status }).eq("id", id);
    if (error) return void toast.error(friendlyError(error));
    toast.success(status === "cancelled" ? "Interview cancelled" : "Marked completed");
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Panel title="Interviews" description="The applicant sees the time, type, link/location, instructions and status. Internal notes stay private."
      actions={editing ? null : <AdminButton variant="primary" onClick={startNew}>Schedule interview</AdminButton>}>
      {editing && (
        <div className="mb-6 grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
          <TextInput label="Date" type="date" value={d.date} onChange={set("date")} />
          <TextInput label="Time" type="time" value={d.time} onChange={set("time")} />
          <SelectInput label="Timezone" value={d.timezone} options={TZ_OPTIONS} onChange={set("timezone")} />
          <SelectInput label="Interview type" value={d.interview_type} options={TYPE_OPTIONS} onChange={set("interview_type")} />
          <TextInput label="Meeting link" placeholder="https://" value={d.meeting_url} onChange={set("meeting_url")} />
          <TextInput label="Location" value={d.location} onChange={set("location")} />
          <div className="sm:col-span-2"><TextArea label="Instructions for the applicant" hint="Visible to the applicant." value={d.public_notes} onChange={set("public_notes")} /></div>
          <div className="sm:col-span-2"><TextArea label="Internal notes" hint="Only HR and admins can see this." value={d.internal_notes} onChange={set("internal_notes")} /></div>
          <div className="flex gap-3 sm:col-span-2">
            <AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : editing === "new" ? "Schedule" : "Save changes"}</AdminButton>
            <AdminButton onClick={() => setEditing(null)}>Cancel</AdminButton>
          </div>
        </div>
      )}
      {q.isLoading ? <LoadingRow /> : (q.data ?? []).length === 0 ? <EmptyState>No interviews yet.</EmptyState> : (
        <ul className="divide-y divide-border">
          {q.data!.map((i) => {
            const open = i.status === "scheduled" || i.status === "rescheduled";
            return (
              <li key={i.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-small">{fmtInterview(i.scheduled_at, i.timezone)}</p>
                  <p className="text-caption mt-1 text-muted-foreground">{INTERVIEW_TYPE_LABEL[i.interview_type]} · {INTERVIEW_STATUS_LABEL[i.status]}</p>
                  {i.internal_notes && <p className="text-caption mt-2 whitespace-pre-line text-muted-foreground">Internal: {i.internal_notes}</p>}
                </div>
                {open && (
                  <div className="flex flex-wrap gap-2">
                    <AdminButton onClick={() => startEdit(i)}>Reschedule / edit</AdminButton>
                    <AdminButton onClick={() => setStatus(i.id, "completed")}>Mark completed</AdminButton>
                    <ConfirmButton title="Cancel interview?" description="The applicant will see it as cancelled." onConfirm={() => setStatus(i.id, "cancelled")}>Cancel</ConfirmButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
