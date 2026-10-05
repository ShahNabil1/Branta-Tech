import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, getSettingsGroup, saveSettingsGroup } from "@/lib/supabase/cms";
import { AdminButton, CheckboxInput, LoadingRow, PageHeader, Panel, SelectInput, TextArea, TextInput, friendlyError } from "@/components/admin/cms";
import { parseChatSettings, type ChatSettings } from "@/lib/chat/types";

export const Route = createFileRoute("/control-centre/_admin/chat/settings")({
  head: () => adminHead("Chat settings"),
  component: ChatSettingsPage,
});

const FUNNEL: [string, string][] = [["widget_opened", "Chat widget opened"], ["lead_started", "Lead capture started"], ["name_completed", "Name completed"], ["whatsapp_completed", "WhatsApp completed"], ["email_completed", "Email completed"], ["lead_completed", "Lead capture completed"], ["chat_started", "Chat started"]];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ChatSettingsPage() {
  const q = useQuery({ queryKey: ["chat", "settings"], queryFn: () => getSettingsGroup("chat") });
  const [v, setV] = useState<ChatSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.isSuccess) setV(parseChatSettings(q.data)); }, [q.isSuccess, q.data]);
  if (!v) return <LoadingRow />;
  const set = <K extends keyof ChatSettings>(k: K, val: ChatSettings[K]) => setV({ ...v, [k]: val });
  async function save() {
    setBusy(true);
    try { await saveSettingsGroup("chat", v); toast.success("Chat settings saved"); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Chat" title="Settings & analytics" />
      <Analytics />
      <Panel title="Widget" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxInput label="Widget enabled" checked={v.enabled} onChange={(c) => set("enabled", c)} />
          <SelectInput label="Default language" value={v.language} options={[{ value: "auto", label: "Detect from message" }, { value: "en", label: "English" }, { value: "bn", label: "Bangla" }]} onChange={(e) => set("language", e.target.value as ChatSettings["language"])} />
          <TextInput label="Title" value={v.title} onChange={(e) => set("title", e.target.value)} />
          <TextInput label="Subtitle" value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          <TextArea className="md:col-span-2" label="Opening message" value={v.opening} onChange={(e) => set("opening", e.target.value)} />
          <TextInput className="md:col-span-2" label="Input placeholder" value={v.placeholder} onChange={(e) => set("placeholder", e.target.value)} />
          <TextArea className="md:col-span-2" label="Offline message" value={v.offline} onChange={(e) => set("offline", e.target.value)} />
          <CheckboxInput label="Human handoff enabled" checked={v.handoff} onChange={(c) => set("handoff", c)} />
          <CheckboxInput label="Booking enabled" checked={v.booking} onChange={(c) => set("booking", c)} />
          <CheckboxInput label="Portfolio recommendations" checked={v.portfolio} onChange={(c) => set("portfolio", c)} />
        </div>
      </Panel>
      <Panel title="Lead capture" description="New visitors introduce themselves before the chat starts. Turning a field off skips that step." className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxInput label="Lead capture enabled" checked={v.lead.enabled} onChange={(c) => set("lead", { ...v.lead, enabled: c })} />
          <div />
          <CheckboxInput label="Require Name" checked={v.lead.requireName} onChange={(c) => set("lead", { ...v.lead, requireName: c })} />
          <CheckboxInput label="Require WhatsApp" checked={v.lead.requireWhatsapp} onChange={(c) => set("lead", { ...v.lead, requireWhatsapp: c })} />
          <CheckboxInput label="Require Email" checked={v.lead.requireEmail} onChange={(c) => set("lead", { ...v.lead, requireEmail: c })} />
          <div />
          <TextInput label="Welcome title" value={v.lead.welcomeTitle} onChange={(e) => set("lead", { ...v.lead, welcomeTitle: e.target.value })} />
          <TextInput label="Completion message" value={v.lead.completion} onChange={(e) => set("lead", { ...v.lead, completion: e.target.value })} />
          <TextArea className="md:col-span-2" label="Welcome message" value={v.lead.welcomeMessage} onChange={(e) => set("lead", { ...v.lead, welcomeMessage: e.target.value })} />
          <TextArea className="md:col-span-2" label="Privacy message" value={v.lead.privacy} onChange={(e) => set("lead", { ...v.lead, privacy: e.target.value })} />
          <TextInput className="md:col-span-2" label="Privacy Policy link (e.g. /privacy or https://…; empty hides the link)" value={v.lead.privacyUrl} onChange={(e) => set("lead", { ...v.lead, privacyUrl: e.target.value })} />
        </div>
      </Panel>
      <Panel title="Human chat hours (optional)" description="Outside these hours visitors get the offline form even if someone is marked Online." className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxInput label="Use business hours" checked={v.hours.enabled} onChange={(c) => set("hours", { ...v.hours, enabled: c })} />
          <TextInput label="Timezone" value={v.hours.timezone} onChange={(e) => set("hours", { ...v.hours, timezone: e.target.value })} />
          <TextInput label="Start (HH:MM)" value={v.hours.start} onChange={(e) => set("hours", { ...v.hours, start: e.target.value })} />
          <TextInput label="End (HH:MM)" value={v.hours.end} onChange={(e) => set("hours", { ...v.hours, end: e.target.value })} />
          <div className="flex flex-wrap gap-3 md:col-span-2">
            {DAYS.map((d, i) => <CheckboxInput key={d} label={d} checked={v.hours.days.includes(i)} onChange={(c) => set("hours", { ...v.hours, days: c ? [...v.hours.days, i].sort() : v.hours.days.filter((x) => x !== i) })} />)}
          </div>
        </div>
      </Panel>
      <div className="mt-6"><AdminButton variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</AdminButton></div>
    </div>
  );
}

function Analytics() {
  const q = useQuery({
    queryKey: ["chat", "analytics"],
    queryFn: async () => {
      const c = (b: PromiseLike<{ count: number | null }>) => Promise.resolve(b).then((r) => r.count ?? 0);
      const [total, assistant, handoffs, started, completed, unanswered, intents] = await Promise.all([
        c(supabase.from("chat_conversations").select("id", { count: "exact", head: true })),
        c(supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("mode", "assistant").is("handoff_topic", null)),
        c(supabase.from("chat_conversations").select("id", { count: "exact", head: true }).not("handoff_topic", "is", null)),
        c(supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("intent_key", "booking_started")),
        c(supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("intent_key", "booking_completed")),
        c(supabase.from("chat_unanswered_questions").select("id", { count: "exact", head: true }).eq("resolved", false)),
        supabase.from("chat_messages").select("intent_key").eq("sender_type", "assistant").not("intent_key", "is", null).order("created_at", { ascending: false }).limit(1000),
      ]);
      const funnelRows = await Promise.all(FUNNEL.map(([k]) => c(supabase.from("chat_funnel_events" as never).select("id", { count: "exact", head: true }).eq("event", k))));
      const tally = new Map<string, number>();
      for (const r of intents.data ?? []) if (r.intent_key) tally.set(r.intent_key, (tally.get(r.intent_key) ?? 0) + 1);
      return { funnel: FUNNEL.map(([, l], i) => [l, funnelRows[i] ?? 0] as [string, number]), total, assistant, handoffs, started, completed, unanswered, top: [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6) };
    },
  });
  if (!q.data) return <LoadingRow />;
  const d = q.data;
  const stats: [string, number][] = [["Total conversations", d.total], ["Assistant only", d.assistant], ["Human handoffs", d.handoffs], ["Bookings started", d.started], ["Bookings completed", d.completed], ["Open unanswered", d.unanswered]];
  return (
    <Panel title="Analytics" description="Live counts from the database.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map(([k, n]) => <div key={k} className="rounded-sm border border-border p-3"><p className="text-h3">{n}</p><p className="text-caption text-muted-foreground">{k}</p></div>)}
      </div>
      <p className="text-small mt-4 font-medium">Lead capture funnel</p>
      <div className="mt-1 grid grid-cols-2 gap-3 md:grid-cols-4">
        {d.funnel.map(([k, n]) => <div key={k} className="rounded-sm border border-border p-3"><p className="text-h4">{n}</p><p className="text-caption text-muted-foreground">{k}</p></div>)}
      </div>
      <p className="text-small mt-4 font-medium">Top topics (last 1,000 replies)</p>
      {d.top.length ? <ul className="text-small mt-1 grid gap-0.5">{d.top.map(([k, n]) => <li key={k}><span className="font-mono">{k}</span> — {n}</li>)}</ul> : <p className="text-caption text-muted-foreground">No data yet.</p>}
    </Panel>
  );
}
