import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chatOpen, chatSend, chatSync } from "@/lib/chat.functions";
import { DEFAULT_CHAT_SETTINGS, type ChatMsg, type ChatSettings, type ChatState, type QuickAction } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { BookingFlow } from "./BookingFlow";

const KEY = "branta_chat_token";
const FAIL = "Something went wrong. Please try again or talk to our team.";
type SendBody = { token: string | null; page?: string; text?: string; action?: unknown };

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const openFn = useServerFn(chatOpen), sendFn = useServerFn(chatSend), syncFn = useServerFn(chatSync);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [online, setOnline] = useState(false);
  const [state, setState] = useState<ChatState>({ status: "none", mode: "assistant", channel: null, agentName: null });
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [booking, setBooking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const token = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const merge = useCallback((incoming: ChatMsg[]) => setMsgs((m) => {
    const seen = new Set(m.map((x) => x.id));
    return [...m, ...incoming.filter((x) => !seen.has(x.id))];
  }), []);

  useEffect(() => {
    token.current = localStorage.getItem(KEY);
    openFn({ data: { token: token.current } }).then((r) => {
      if (!r.ok) return setError(FAIL);
      setSettings(r.settings); setActions(r.quickActions); setOnline(r.online); setState(r.state); setMsgs(r.messages);
    }).catch(() => setError(FAIL)).finally(() => setLoaded(true));
  }, [openFn]);

  const sync = useCallback(async () => {
    if (!token.current) return;
    const after = msgs[msgs.length - 1]?.at;
    const r = await syncFn({ data: { token: token.current, after } }).catch(() => null);
    if (r?.ok) { setState(r.state); merge(r.messages); }
  }, [msgs, syncFn, merge]);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  // Realtime ping from the team inbox (carries no content), with polling as a fallback during human chat.
  useEffect((): (() => void) | undefined => {
    if (!state.channel) return;
    const ch = supabase.channel(`chat-${state.channel}`).on("broadcast", { event: "ping" }, () => { void syncRef.current(); }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [state.channel]);
  useEffect(() => {
    if (!open || (state.status !== "waiting_for_agent" && state.status !== "human_active")) return;
    const t = setInterval(() => { void syncRef.current(); }, 5000);
    return () => clearInterval(t);
  }, [open, state.status]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, booking]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(body: Omit<SendBody, "token">): Promise<void> {
    if (busy) return;
    setBusy(true); setError(null); setMenu(false);
    try {
      const r = await sendFn({ data: { ...body, token: token.current, page: window.location.pathname } as never });
      if (!r.ok) { setError(r.error); return; }
      if (r.token && r.token !== token.current) { token.current = r.token; localStorage.setItem(KEY, r.token); }
      setState(r.state);
      if (r.reset) { setMsgs([]); setBooking(false); return; }
      merge(r.messages);
      if (r.messages.some((m) => m.type === "booking" && !m.payload?.booking) && settings.booking) setBooking(true);
    } catch { setError(FAIL); } finally { setBusy(false); }
  }

  function quick(label: string) {
    const l = label.toLowerCase();
    if (l === "ask something else") return input.current?.focus();
    if (l === "book a call") return startBooking(label);
    if (l === "talk to a human") return send({ action: { type: "human", label } });
    return send({ text: label });
  }
  function runAction(a: QuickAction) {
    if (a.type === "booking") return startBooking(a.label);
    if (a.type === "human") return send({ action: { type: "human", label: a.label } });
    if (a.type === "portfolio") return send({ action: { type: "portfolio", label: a.label } });
    if (a.type === "intent" && a.target) return send({ action: { type: "intent", key: a.target, label: a.label } });
    if (a.type === "link" && a.target) { window.location.href = a.target; return; }
    return send({ text: a.target || a.label });
  }
  function startBooking(label: string) {
    if (!settings.booking) return send({ text: label });
    setBooking(true);
    void send({ text: label });
  }

  const humanMode = state.mode === "human" || state.status === "waiting_for_agent";
  const statusLabel = state.status === "human_active" ? `${state.agentName ?? "Team"} · Online` : online ? "Team Online" : "Assistant Available";
  if (!settings.enabled && loaded) return null;

  return (
    <div role="dialog" aria-modal="false" aria-label={settings.title} hidden={!open}
      className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex flex-col overflow-hidden rounded-[20px] border border-border bg-background text-foreground shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)] animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:top-auto sm:h-[min(74vh,680px)] sm:w-[410px]">
      <header className="flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
        <div className="min-w-0">
          <p className="text-small font-semibold">{settings.title}</p>
          <p className="text-caption text-muted-foreground">{settings.subtitle}</p>
          <p className="text-caption mt-1 flex items-center gap-1.5 text-muted-foreground"><span aria-hidden className={cn("size-1.5 rounded-full", online || state.status === "human_active" ? "bg-accent" : "bg-muted-foreground/50")} />{statusLabel}</p>
        </div>
        <div className="relative flex items-center gap-1">
          <button type="button" aria-label="Chat menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="grid size-9 place-items-center rounded-full hover:bg-muted"><MoreHorizontal className="size-4" /></button>
          <button type="button" aria-label="Close chat" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-muted"><X className="size-4" /></button>
          {menu && (
            <div className="absolute right-0 top-10 z-10 w-52 overflow-hidden rounded-[14px] border border-border bg-background py-1 text-small shadow-lg">
              {settings.handoff && <button type="button" className="block w-full px-4 py-2 text-left hover:bg-muted" onClick={() => send({ action: { type: "human", label: "Talk to a Human" } })}>Talk to a Human</button>}
              <button type="button" className="block w-full px-4 py-2 text-left hover:bg-muted" onClick={() => send({ action: { type: "restart" } })}>Restart Conversation</button>
              <button type="button" className="block w-full px-4 py-2 text-left hover:bg-muted" onClick={() => { setPrivacy((p) => !p); setMenu(false); }}>Privacy</button>
            </div>
          )}
        </div>
      </header>

      <div ref={list} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {privacy && <p className="text-caption rounded-[12px] border border-border bg-surface p-3 text-muted-foreground">Branta Assistant answers from Branta's own published information — no outside AI service. Messages are stored so our team can help you. Contact details are only used to reply or arrange the call you request.</p>}
        <Bubble from="assistant">{settings.opening}</Bubble>
        {msgs.length === 0 && actions.length > 0 && (
          <div className="flex flex-wrap gap-2">{actions.map((a) => <Chip key={a.label} onClick={() => runAction(a)} disabled={busy}>{a.label}</Chip>)}</div>
        )}
        {msgs.map((m, i) => (
          <Message key={m.id} m={m} last={i === msgs.length - 1} busy={busy} onQuick={(l) => m.payload?.kind === "handoff_topic" ? send({ action: { type: "handoff_topic", topic: l } }) : quick(l)}
            onContact={(v) => send({ action: { type: "offline_contact", ...v } })} />
        ))}
        {booking && (
          <BookingFlow onCancel={() => setBooking(false)} onStarted={() => send({ action: { type: "booking_started" } })}
            onDone={(b) => { setBooking(false); void send({ action: { type: "booking_done", ...b } }); }} />
        )}
        {busy && <div aria-label="Assistant is replying" className="flex gap-1 px-2"><Dot /><Dot d="150ms" /><Dot d="300ms" /></div>}
        {state.status === "closed" && (
          <div className="rounded-[14px] border border-border bg-surface p-3 text-small">
            This conversation was closed.
            <div className="mt-2 flex flex-wrap gap-2"><Chip onClick={() => send({ action: { type: "assistant" } })}>Continue with Branta Assistant</Chip></div>
          </div>
        )}
        {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
      </div>

      <form className="flex items-end gap-2 border-t border-border bg-background p-3" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(""); void send({ text: t }); }}>
        <label htmlFor="branta-chat-input" className="sr-only">Message</label>
        <textarea id="branta-chat-input" ref={input} rows={1} maxLength={1200} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder={humanMode ? "Message the Branta team..." : settings.placeholder}
          className="text-small max-h-28 min-h-11 flex-1 resize-none rounded-[14px] border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent" />
        <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground disabled:opacity-40"><Send className="size-4" /></button>
      </form>
    </div>
  );
}

function Dot({ d = "0ms" }: { d?: string }) {
  return <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none" style={{ animationDelay: d, animationDuration: "900ms" }} />;
}

function Chip({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className="text-caption rounded-full border border-border bg-background px-3 py-1.5 font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50">{children}</button>;
}

function Bubble({ from, children }: { from: ChatMsg["from"]; children: React.ReactNode }) {
  if (from === "system") return <p className="text-caption text-center text-muted-foreground">{children}</p>;
  const mine = from === "visitor";
  return (
    <div className={cn("flex animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none", mine ? "justify-end" : "justify-start")}>
      <div className={cn("text-small max-w-[85%] whitespace-pre-line rounded-[16px] px-3.5 py-2.5", mine ? "bg-foreground text-background" : from === "agent" ? "border border-accent/40 bg-surface" : "bg-surface")}>{children}</div>
    </div>
  );
}

function Message({ m, last, busy, onQuick, onContact }: {
  m: ChatMsg; last: boolean; busy: boolean; onQuick: (l: string) => void;
  onContact: (v: { name: string; email: string; whatsapp: string; message: string }) => void;
}) {
  if (m.type === "system" && m.text === "Booking started") return null;
  const p = m.payload;
  return (
    <div className="space-y-2">
      {m.type !== "service_card" && <Bubble from={m.from}>{m.text}</Bubble>}
      {p?.replies && p.replies.length > 0 && last && (
        <div className="flex flex-wrap gap-2">{p.replies.map((r) => <Chip key={r} disabled={busy} onClick={() => onQuick(r)}>{r}</Chip>)}</div>
      )}
      {p?.services && (
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {p.services.map((s) => (
            <Link key={s.slug} to="/services/$slug" params={{ slug: s.slug }} className="w-56 shrink-0 snap-start rounded-[14px] border border-border bg-background p-3 hover:border-accent">
              <p className="text-small font-medium">{s.name}</p>
              {s.summary && <p className="text-caption mt-1 line-clamp-3 text-muted-foreground">{s.summary}</p>}
              <p className="text-caption mt-2 text-accent">View service →</p>
            </Link>
          ))}
        </div>
      )}
      {p?.projects && (
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {p.projects.map((pr) => (
            <Link key={pr.slug} to="/work/$slug" params={{ slug: pr.slug }} className="w-52 shrink-0 snap-start overflow-hidden rounded-[14px] border border-border bg-background hover:border-accent">
              <div className="aspect-video bg-muted">{pr.poster && <img src={pr.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
              <div className="p-3">
                {pr.category && <p className="text-caption uppercase tracking-wide text-muted-foreground">{pr.category}</p>}
                <p className="text-small font-medium">{pr.title}</p>
                <p className="text-caption mt-1 text-accent">View Project →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {p?.ctas && p.ctas.length > 0 && (
        <div className="flex flex-wrap gap-2">{p.ctas.map((c) => <a key={c.url} href={c.url} className="text-caption rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground">{c.label} →</a>)}</div>
      )}
      {p?.booking && (
        <dl className="text-caption grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[14px] border border-border bg-background p-3">
          <dt className="text-muted-foreground">Date</dt><dd>{p.booking.date}</dd>
          <dt className="text-muted-foreground">Time</dt><dd>{p.booking.time}</dd>
          <dt className="text-muted-foreground">Service</dt><dd>{p.booking.service}</dd>
          <dt className="text-muted-foreground">Status</dt><dd>{p.booking.status}</dd>
          {p.booking.reference && <><dt className="text-muted-foreground">Reference</dt><dd>{p.booking.reference}</dd></>}
        </dl>
      )}
      {m.type === "contact_form" && last && <ContactForm busy={busy} onSubmit={onContact} />}
    </div>
  );
}

function ContactForm({ busy, onSubmit }: { busy: boolean; onSubmit: (v: { name: string; email: string; whatsapp: string; message: string }) => void }) {
  const [v, setV] = useState({ name: "", whatsapp: "", email: "", message: "" });
  const [err, setErr] = useState<string | null>(null);
  const f = (k: keyof typeof v, label: string, type = "text", area = false) => (
    <label className="block">
      <span className="text-caption text-muted-foreground">{label}</span>
      {area
        ? <textarea rows={3} maxLength={1200} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="text-small mt-1 w-full rounded-[10px] border border-border bg-background px-3 py-2 outline-none focus:border-accent" />
        : <input type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="text-small mt-1 h-10 w-full rounded-[10px] border border-border bg-background px-3 outline-none focus:border-accent" />}
    </label>
  );
  return (
    <form className="space-y-2 rounded-[14px] border border-border bg-surface p-3" onSubmit={(e) => {
      e.preventDefault();
      if (v.name.trim().length < 2) return setErr("Enter your name.");
      if (!v.whatsapp.trim() && !v.email.trim()) return setErr("Add a WhatsApp number or email so we can reply.");
      if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return setErr("Enter a valid email.");
      if (v.message.trim().length < 2) return setErr("Add a short message.");
      setErr(null); onSubmit(v);
    }}>
      <p className="text-caption text-muted-foreground">We only use these details to reply to you.</p>
      {f("name", "Name")}{f("whatsapp", "WhatsApp", "tel")}{f("email", "Email", "email")}{f("message", "Message", "text", true)}
      {err && <p role="alert" className="text-caption text-destructive">{err}</p>}
      <button type="submit" disabled={busy} className="text-small w-full rounded-full bg-accent py-2.5 font-medium text-accent-foreground disabled:opacity-50">Send message</button>
    </form>
  );
}
