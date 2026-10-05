import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { AdminButton, EmptyState, ErrorNote, LoadingRow, PageHeader, SelectInput, friendlyError } from "@/components/admin/cms";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/control-centre/_admin/chat/")({
  head: () => adminHead("Chat inbox"),
  component: Inbox,
});

type Conv = Tables<"chat_conversations"> & { chat_visitors: Pick<Tables<"chat_visitors">, "name" | "email" | "whatsapp"> & { source_page?: string | null; referrer?: string | null } | null };
type Msg = Tables<"chat_messages">;
const FILTERS = ["all", "waiting", "active", "mine", "closed"] as const;
const STATUS: Record<string, string> = { active: "Assistant", waiting_for_agent: "Waiting", human_active: "With team", closed: "Closed" };

async function ping(channel: string) {
  const ch = supabase.channel(`chat-${channel}`);
  await ch.send({ type: "broadcast", event: "ping", payload: {} }).catch(() => undefined);
  void supabase.removeChannel(ch);
}

function Inbox() {
  const qc = useQueryClient();
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("waiting");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
      setMe({ id: data.user.id, name: p?.full_name?.split(" ")[0] || data.user.email?.split("@")[0] || "Team" });
    });
  }, []);

  const agents = useQuery({ queryKey: ["chat", "agents"], queryFn: () => must(supabase.from("chat_agents").select("*").order("display_name")) });
  const convs = useQuery({
    queryKey: ["chat", "convs"],
    queryFn: () => must(supabase.from("chat_conversations").select("*, chat_visitors(name,email,whatsapp,source_page,referrer)").order("last_message_at", { ascending: false }).limit(200)) as Promise<Conv[]>,
  });

  useEffect(() => {
    const ch = supabase.channel("chat-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => qc.invalidateQueries({ queryKey: ["chat", "convs"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        qc.invalidateQueries({ queryKey: ["chat", "convs"] });
        qc.invalidateQueries({ queryKey: ["chat", "msgs", (p.new as Msg).conversation_id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const myAgent = agents.data?.find((a) => a.user_id === me?.id);
  async function setStatus(status: string) {
    if (!me) return;
    const { error } = await supabase.from("chat_agents").upsert({ user_id: me.id, status, display_name: myAgent?.display_name ?? me.name, updated_at: new Date().toISOString() });
    if (error) return void toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["chat", "agents"] });
  }

  const rows = useMemo(() => (convs.data ?? []).filter((c) =>
    filter === "all" ? true : filter === "waiting" ? c.status === "waiting_for_agent" : filter === "active" ? c.status === "human_active" || c.status === "active"
      : filter === "mine" ? c.assigned_agent_id === me?.id : c.status === "closed"), [convs.data, filter, me]);
  const current = convs.data?.find((c) => c.id === sel) ?? null;
  const agentName = (id: string | null) => agents.data?.find((a) => a.user_id === id)?.display_name ?? (id ? "Team member" : "—");

  return (
    <div className="max-w-[1400px]">
      <PageHeader eyebrow="Chat" title="Inbox" description="Live conversations from Branta Assistant. Set yourself Online to receive handoffs."
        actions={<SelectInput label="My status" value={myAgent?.status ?? "offline"} onChange={(e) => setStatus(e.target.value)}
          options={[{ value: "online", label: "Online" }, { value: "busy", label: "Busy" }, { value: "offline", label: "Offline" }]} />} />
      <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[300px_1fr_280px]">
        <section className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cn("text-caption rounded-sm px-2 py-1 capitalize", filter === f ? "bg-foreground text-background" : "hover:bg-muted")}>
                {f === "mine" ? "Assigned to me" : f}{f === "waiting" && convs.data ? ` (${convs.data.filter((c) => c.status === "waiting_for_agent").length})` : ""}
              </button>
            ))}
          </div>
          {convs.isLoading && <LoadingRow />}
          {convs.error && <ErrorNote>{friendlyError(convs.error)}</ErrorNote>}
          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {rows.length === 0 && !convs.isLoading && <li className="p-4"><EmptyState>No conversations.</EmptyState></li>}
            {rows.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setSel(c.id)} className={cn("block w-full px-3 py-2.5 text-left hover:bg-muted", sel === c.id && "bg-muted")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0"><span className="text-small block truncate font-medium">{c.chat_visitors?.name || "Guest"}</span>{(c.chat_visitors?.whatsapp || c.chat_visitors?.email) && <span className="text-caption block truncate text-muted-foreground">{[c.chat_visitors?.whatsapp, c.chat_visitors?.email].filter(Boolean).join(" · ")}</span>}</span>
                    <span className="text-caption shrink-0 text-muted-foreground">{new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-caption flex items-center gap-2 text-muted-foreground">
                    <span className={cn("rounded-sm px-1.5", c.status === "waiting_for_agent" ? "bg-accent text-accent-foreground" : "bg-muted")}>{STATUS[c.status]}</span>
                    <span className="truncate">{c.handoff_topic ?? c.source_page ?? ""}</span>
                    {c.assigned_agent_id && <span className="ml-auto truncate">{agentName(c.assigned_agent_id)}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {current && me ? <Thread key={current.id} conv={current} me={me} agents={agents.data ?? []} /> : <div className="grid place-items-center rounded-md border border-dashed border-border text-small text-muted-foreground lg:col-span-2">Select a conversation</div>}
      </div>
    </div>
  );
}

function Thread({ conv, me, agents }: { conv: Conv; me: { id: string; name: string }; agents: Tables<"chat_agents">[] }) {
  const qc = useQueryClient();
  const msgs = useQuery({ queryKey: ["chat", "msgs", conv.id], queryFn: () => must(supabase.from("chat_messages").select("*").eq("conversation_id", conv.id).order("created_at").limit(500)) });
  const booking = useQuery({ queryKey: ["chat", "booking", conv.booking_id], enabled: !!conv.booking_id, queryFn: () => must(supabase.from("bookings").select("booking_reference,requested_start_at,status").eq("id", conv.booking_id!).maybeSingle()) });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.data]);
  const myName = agents.find((a) => a.user_id === me.id)?.display_name ?? me.name;

  async function update(patch: Partial<Tables<"chat_conversations">>, systemText?: string) {
    setBusy(true);
    const { error } = await supabase.from("chat_conversations").update(patch).eq("id", conv.id);
    if (!error && systemText) await supabase.from("chat_messages").insert({ conversation_id: conv.id, sender_type: "system", sender_id: me.id, message: systemText, message_type: "system" });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    void ping(conv.channel_key);
    qc.invalidateQueries({ queryKey: ["chat"] });
  }
  async function reply() {
    const t = text.trim().slice(0, 1200);
    if (!t) return;
    setBusy(true);
    if (conv.mode !== "human" || conv.status !== "human_active") await supabase.from("chat_conversations").update({ mode: "human", status: "human_active", assigned_agent_id: conv.assigned_agent_id ?? me.id }).eq("id", conv.id);
    const { error } = await supabase.from("chat_messages").insert({ conversation_id: conv.id, sender_type: "agent", sender_id: me.id, message: t, payload: { agentName: myName } });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error));
    setText(""); void ping(conv.channel_key);
    qc.invalidateQueries({ queryKey: ["chat", "msgs", conv.id] });
  }
  const assignTo = (id: string) => {
    const a = agents.find((x) => x.user_id === id);
    return update({ assigned_agent_id: id || null }, id ? `${a?.display_name ?? "A team member"} from Branta has joined the conversation.` : undefined);
  };

  return (
    <>
      <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          {conv.status !== "human_active" && conv.status !== "closed" && <AdminButton size="sm" variant="primary" disabled={busy} onClick={() => update({ status: "human_active", mode: "human", assigned_agent_id: me.id }, `${myName} from Branta has joined the conversation.`)}>Accept conversation</AdminButton>}
          {conv.status !== "closed" && <AdminButton size="sm" variant="danger" disabled={busy} onClick={() => update({ status: "closed" }, "The conversation was closed by the Branta team.")}>Close</AdminButton>}
          {conv.status === "closed" && <AdminButton size="sm" disabled={busy} onClick={() => update({ status: conv.assigned_agent_id ? "human_active" : "waiting_for_agent", mode: "human" })}>Reopen</AdminButton>}
          {conv.mode === "human" && conv.status !== "closed" && <AdminButton size="sm" variant="ghost" disabled={busy} onClick={() => update({ mode: "assistant", status: "active", assigned_agent_id: null }, "You're back with Branta Assistant.")}>Return to assistant</AdminButton>}
          <label className="text-caption ml-auto flex items-center gap-1 text-muted-foreground">Assign / transfer
            <select className="h-8 rounded-sm border border-input bg-background px-2 text-foreground" value={conv.assigned_agent_id ?? ""} onChange={(e) => assignTo(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name ?? "Team member"} ({a.status})</option>)}
            </select>
          </label>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: "60vh" }}>
          {msgs.isLoading && <LoadingRow />}
          {msgs.data?.map((m) => (
            m.sender_type === "system"
              ? <p key={m.id} className="text-caption text-center text-muted-foreground">{m.message}</p>
              : <div key={m.id} className={cn("flex", m.sender_type === "visitor" ? "justify-start" : "justify-end")}>
                  <div className={cn("text-small max-w-[75%] whitespace-pre-line rounded-md px-3 py-2", m.sender_type === "visitor" ? "bg-background border border-border" : m.sender_type === "agent" ? "bg-foreground text-background" : "bg-muted")}>
                    <p className="text-caption mb-0.5 opacity-70">{m.sender_type === "visitor" ? "Visitor" : m.sender_type === "agent" ? ((m.payload as { agentName?: string } | null)?.agentName ?? "Agent") : `Assistant${m.intent_key ? ` · ${m.intent_key}` : ""}`}</p>
                    {m.message}
                  </div>
                </div>
          ))}
          <div ref={end} />
        </div>
        <form className="flex gap-2 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); void reply(); }}>
          <textarea rows={2} maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} disabled={conv.status === "closed"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void reply(); } }}
            placeholder={conv.status === "closed" ? "Reopen to reply" : "Reply to the visitor…"} className="text-small flex-1 resize-none rounded-sm border border-input bg-background px-3 py-2" />
          <AdminButton type="submit" variant="primary" disabled={busy || !text.trim() || conv.status === "closed"}>Send</AdminButton>
        </form>
      </section>
      <aside className="rounded-md border border-border bg-surface p-4 text-small">
        <h2 className="text-h4 mb-3">Visitor</h2>
        <dl className="grid gap-2">
          {[
            ["Name", conv.chat_visitors?.name || "Guest"], ["Email", conv.chat_visitors?.email], ["WhatsApp", conv.chat_visitors?.whatsapp], ["Lead source", conv.chat_visitors?.source_page], ["Referrer", conv.chat_visitors?.referrer],
            ["Signed-in account", conv.user_id ? "Yes" : "No"], ["Source page", conv.source_page], ["Topic", conv.handoff_topic],
            ["Interested service", conv.interested_service],
            ["Booking", booking.data ? `${booking.data.booking_reference} · ${new Date(booking.data.requested_start_at).toLocaleString()} · ${booking.data.status}` : conv.booking_id ? "Linked" : null],
            ["Status", STATUS[conv.status]], ["Assigned", agents.find((a) => a.user_id === conv.assigned_agent_id)?.display_name ?? (conv.assigned_agent_id ? "Team member" : "—")],
            ["Started", new Date(conv.created_at).toLocaleString()],
          ].map(([k, v]) => <div key={k}><dt className="text-caption text-muted-foreground">{k}</dt><dd className="break-words">{v || "—"}</dd></div>)}
        </dl>
      </aside>
    </>
  );
}
