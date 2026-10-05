import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, getSettingsGroup, must, saveSettingsGroup } from "@/lib/supabase/cms";
import { parseMediaItems, type SectionMediaItem } from "@/lib/section-media";
import { SectionMediaEditor } from "@/components/admin/SectionMediaEditor";
import { AdminButton, CheckboxInput, ErrorNote, LoadingRow, PageHeader, Panel, SaveBar, SelectInput, TextInput, friendlyError, useFormState, useUnsavedWarning } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/bookings/availability")({
  head: () => adminHead("Booking availability"),
  component: AvailabilityPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Rule = { id: string; day_of_week: number; start_time: string; end_time: string; enabled: boolean; sort_order: number };
type Exception = { id: string; exception_date: string; kind: string; start_time: string | null; end_time: string | null; reason: string | null };
type Form = {
  timezone: string; duration: string; buffer: string; notice: string; advance: string; instant: boolean;
  services: string[]; intro: SectionMediaItem[]; process: SectionMediaItem[];
};

function AvailabilityPage() {
  const query = useQuery({
    queryKey: ["cms", "booking-settings"],
    queryFn: async () => {
      const [settings, rules, exceptions, services] = await Promise.all([
        getSettingsGroup<Record<string, unknown>>("booking"),
        must(supabase.from("booking_availability_rules").select("*").order("day_of_week").order("sort_order")),
        must(supabase.from("booking_availability_exceptions").select("*").order("exception_date")),
        must(supabase.from("services").select("name,status").eq("status", "published").order("sort_order")),
      ]);
      return { settings: settings ?? {}, rules, exceptions, services: services.map((s) => s.name) };
    },
  });
  if (query.isLoading) return <LoadingRow />;
  if (query.error || !query.data) return <ErrorNote>{friendlyError(query.error)}</ErrorNote>;
  return <AvailabilityForm initial={query.data} />;
}

function AvailabilityForm({ initial }: { initial: { settings: Record<string, unknown>; rules: Rule[]; exceptions: Exception[]; services: string[] } }) {
  const qc = useQueryClient();
  const s = initial.settings;
  const form = useFormState<Form>({
    timezone: typeof s["timezone"] === "string" ? s["timezone"] : "Asia/Dhaka",
    duration: String(s["duration_minutes"] ?? 30), buffer: String(s["buffer_minutes"] ?? 15),
    notice: String(s["minimum_notice_hours"] ?? 12), advance: String(s["maximum_advance_days"] ?? 30),
    instant: s["instant_confirmation"] === true,
    services: Array.isArray(s["services"]) ? s["services"].filter((v): v is string => typeof v === "string") : [],
    intro: parseMediaItems({ media_items: s["intro_media"] }), process: parseMediaItems({ media_items: s["process_media"] }),
  });
  const [rules, setRules] = useState(initial.rules);
  const [exceptions, setExceptions] = useState(initial.exceptions);
  const [rulesDirty, setRulesDirty] = useState(false);
  useUnsavedWarning(form.dirty || rulesDirty);
  const setRulesChanged = (next: Rule[]) => { setRules(next); setRulesDirty(true); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.state === "saving") return;
    const duration = Number(form.values.duration), buffer = Number(form.values.buffer), notice = Number(form.values.notice), advance = Number(form.values.advance);
    if (!form.values.timezone.trim() || !Number.isInteger(duration) || duration < 15 || duration > 180 || !Number.isInteger(buffer) || buffer < 0 || !Number.isInteger(notice) || notice < 0 || !Number.isInteger(advance) || advance < 1) return form.fail("Check the booking rules and try again.");
    form.begin();
    try {
      await saveSettingsGroup("booking", {
        ...s, timezone: form.values.timezone.trim(), duration_minutes: duration, buffer_minutes: buffer,
        minimum_notice_hours: notice, maximum_advance_days: advance, instant_confirmation: form.values.instant,
        services: form.values.services, intro_media: form.values.intro, process_media: form.values.process,
      });
      for (const r of rules) await must(supabase.from("booking_availability_rules").upsert({ ...r, start_time: r.start_time, end_time: r.end_time }).select("id"));
      form.markSaved(form.values); setRulesDirty(false); qc.invalidateQueries({ queryKey: ["cms", "booking-settings"] }); qc.invalidateQueries({ queryKey: ["public", "booking-experience"] }); toast.success("Booking settings saved");
    } catch (err) { form.fail(friendlyError(err)); }
  }

  async function addException() {
    const date = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const row = await must(supabase.from("booking_availability_exceptions").insert({ exception_date: date, kind: "blocked", reason: "Unavailable" }).select("*").single());
    if (!row) return;
    setExceptions((v) => [...v, row]); toast.success("Blocked date added");
  }
  async function updateException(id: string, patch: Partial<Exception>) {
    const row = await must(supabase.from("booking_availability_exceptions").update(patch).eq("id", id).select("*").single());
    if (row) setExceptions((v) => v.map((x) => x.id === id ? row : x));
  }
  async function deleteException(id: string) {
    await must(supabase.from("booking_availability_exceptions").delete().eq("id", id).select("id"));
    setExceptions((v) => v.filter((x) => x.id !== id)); toast.success("Exception removed");
  }

  const serviceChoices = [...initial.services, "Something Else"];
  return <div className="max-w-6xl"><PageHeader eyebrow="Sales" title="Booking availability" description="Control the public schedule, call format and Book a Call media." actions={<Link to="/control-centre/bookings"><AdminButton>Back to bookings</AdminButton></Link>} />
    <form onSubmit={save} className="grid gap-6">
      <Panel title="Booking rules" description="Availability uses these rules and existing active bookings. It is not connected to an external calendar."><div className="grid gap-4 md:grid-cols-3">
        <TextInput label="Booking timezone" value={form.values.timezone} onChange={(e) => form.set("timezone", e.target.value)} />
        <TextInput label="Call duration (minutes)" type="number" min={15} max={180} step={5} value={form.values.duration} onChange={(e) => form.set("duration", e.target.value)} />
        <TextInput label="Buffer between calls" type="number" min={0} max={120} step={5} value={form.values.buffer} onChange={(e) => form.set("buffer", e.target.value)} />
        <TextInput label="Minimum notice (hours)" type="number" min={0} max={336} value={form.values.notice} onChange={(e) => form.set("notice", e.target.value)} />
        <TextInput label="Maximum advance (days)" type="number" min={1} max={365} value={form.values.advance} onChange={(e) => form.set("advance", e.target.value)} />
        <CheckboxInput label="Instant confirmation" hint="Leave off when the team needs to approve each request." checked={form.values.instant} onChange={(v) => form.set("instant", v)} />
      </div></Panel>
      <Panel title="Weekly availability" description="Add multiple windows per day when needed."><div className="grid gap-3">{rules.map((r) => <div key={r.id} className="grid items-end gap-3 rounded-sm border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <SelectInput label="Day" value={String(r.day_of_week)} onChange={(e) => setRulesChanged(rules.map((x) => x.id === r.id ? { ...x, day_of_week: Number(e.target.value) } : x))} options={DAYS.map((d, i) => ({ value: String(i), label: d }))} />
        <TextInput label="From" type="time" value={r.start_time.slice(0, 5)} onChange={(e) => setRulesChanged(rules.map((x) => x.id === r.id ? { ...x, start_time: e.target.value } : x))} />
        <TextInput label="To" type="time" value={r.end_time.slice(0, 5)} onChange={(e) => setRulesChanged(rules.map((x) => x.id === r.id ? { ...x, end_time: e.target.value } : x))} />
        <CheckboxInput label="Enabled" checked={r.enabled} onChange={(enabled) => setRulesChanged(rules.map((x) => x.id === r.id ? { ...x, enabled } : x))} />
        <AdminButton aria-label="Remove window" variant="ghost" onClick={async () => { await must(supabase.from("booking_availability_rules").delete().eq("id", r.id).select("id")); setRules(rules.filter((x) => x.id !== r.id)); }}><Trash2 className="size-4" /></AdminButton>
      </div>)}<AdminButton className="justify-self-start" onClick={async () => { const row = await must(supabase.from("booking_availability_rules").insert({ day_of_week: 1, start_time: "10:00", end_time: "18:00", sort_order: rules.length }).select("*").single()); if (row) setRules([...rules, row]); }}><Plus className="size-4" /> Add window</AdminButton></div></Panel>
      <Panel title="Blocked and special dates" description="Block a whole date, a partial window, or open a special window."><div className="grid gap-3">{exceptions.map((x) => <div key={x.id} className="grid items-end gap-3 rounded-sm border border-border p-3 md:grid-cols-[1fr_1fr_1fr_1fr_1.5fr_auto]">
        <TextInput label="Date" type="date" value={x.exception_date} onChange={(e) => void updateException(x.id, { exception_date: e.target.value })} />
        <SelectInput label="Type" value={x.kind} onChange={(e) => void updateException(x.id, { kind: e.target.value })} options={[{ value: "blocked", label: "Blocked" }, { value: "available", label: "Special opening" }]} />
        <TextInput label="From (optional)" type="time" value={x.start_time?.slice(0, 5) ?? ""} onChange={(e) => void updateException(x.id, { start_time: e.target.value || null })} />
        <TextInput label="To (optional)" type="time" value={x.end_time?.slice(0, 5) ?? ""} onChange={(e) => void updateException(x.id, { end_time: e.target.value || null })} />
        <TextInput label="Reason" value={x.reason ?? ""} onChange={(e) => void updateException(x.id, { reason: e.target.value || null })} />
        <AdminButton aria-label="Remove exception" variant="ghost" onClick={() => void deleteException(x.id)}><Trash2 className="size-4" /></AdminButton>
      </div>)}<AdminButton className="justify-self-start" onClick={() => void addException()}><Plus className="size-4" /> Add date</AdminButton></div></Panel>
      <Panel title="Services shown in the wizard" description="Options come from published Services. Choose which appear."><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{serviceChoices.map((name) => <CheckboxInput key={name} label={name} checked={form.values.services.includes(name)} onChange={(on) => form.set("services", on ? [...form.values.services, name] : form.values.services.filter((x) => x !== name))} />)}</div></Panel>
      <Panel title="Page media" description="Poster-first image, direct video or Vimeo. Sound controls appear automatically on playing video."><div className="grid gap-6">
        <SectionMediaEditor title="Intro media" hint="The main cinematic visual at the top of Book a Call." max={1} items={form.values.intro} onChange={(v) => form.set("intro", v)} />
        <SectionMediaEditor title="Process media" hint="Optional second visual for the call process." max={1} items={form.values.process} onChange={(v) => form.set("process", v)} />
      </div></Panel>
      <SaveBar state={form.state} dirty={form.dirty || rulesDirty} error={form.error} label="Save booking settings" />
    </form>
  </div>;
}