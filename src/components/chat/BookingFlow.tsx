import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingExperience } from "@/lib/booking.functions";
import { submitBooking } from "@/lib/inquiry.functions";
import type { BookingDay } from "@/lib/booking";
import { cn } from "@/lib/utils";

type Done = { reference: string; date: string; time: string; service: string; status: string };
const STEPS = ["service", "name", "whatsapp", "email", "date", "time", "review"] as const;

/** In-chat booking that reuses the real Book a Call availability and submission (server re-checks the slot). */
export function BookingFlow({ onDone, onCancel, onStarted }: { onDone: (b: Done) => void; onCancel: () => void; onStarted: () => void }) {
  const load = useServerFn(getBookingExperience);
  const submit = useServerFn(submitBooking);
  const [exp, setExp] = useState<{ services: string[]; days: BookingDay[]; timezone: string; instant: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [v, setV] = useState({ service: "", name: "", phone: "", email: "", date: "", slot: "" });
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const refresh = () => load().then((r) => setExp({ services: r.services, days: r.days, timezone: r.settings.timezone, instant: r.settings.instantConfirmation })).catch(() => setErr("We couldn't load available times. Please try again or talk to our team."));
  useEffect(() => { void refresh(); onStarted(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const day = exp?.days.find((d) => d.date === v.date);
  const longDate = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const localTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: userTz }).format(new Date(iso));
  const key = STEPS[step]!;
  const next = () => { setErr(null); setStep((s) => Math.min(STEPS.length - 1, s + 1)); };

  function validate() {
    if (key === "service" && !v.service) return "Choose a topic.";
    if (key === "name" && v.name.trim().length < 2) return "Enter your name.";
    if (key === "whatsapp" && !/^[+\d\s().-]{6,}$/.test(v.phone.trim())) return "Enter a WhatsApp number.";
    if (key === "email" && !/^\S+@\S+\.\S+$/.test(v.email.trim())) return "Enter a valid email.";
    if (key === "date" && !v.date) return "Choose a date.";
    if (key === "time" && !v.slot) return "Choose a time.";
    return null;
  }

  async function confirm() {
    if (busy) return;
    const wait = 3200 - (Date.now() - started.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    setBusy(true); setErr(null);
    try {
      const r = await submit({ data: {
        name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), company: "", topic: `${v.service} (via chat)`, notes: "Booked through Branta Assistant.",
        services: [v.service] as never, requested_start_at: v.slot, timezone: userTz, started_at: String(started.current), hp_field: "",
      } });
      if (!r.ok) {
        setErr(r.error);
        if (r.fields?.["time"]) { setV((x) => ({ ...x, slot: "" })); setStep(STEPS.indexOf("time")); void refresh(); }
        return;
      }
      onDone({ reference: r.bookingReference ?? "", date: longDate(v.date), time: `${localTime(v.slot)} (${userTz})`, service: v.service, status: r.status === "confirmed" ? "Confirmed" : "Requested — the team will confirm" });
    } catch { setErr("Something went wrong. Please try again or talk to our team."); } finally { setBusy(false); }
  }

  const input = (k: "name" | "phone" | "email", type: string, label: string) => (
    <label className="block"><span className="text-caption text-muted-foreground">{label}</span>
      <input autoFocus type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const bad = validate(); bad ? setErr(bad) : next(); } }}
        className="text-small mt-1 h-11 w-full rounded-[10px] border border-border bg-background px-3 outline-none focus:border-accent" /></label>
  );
  const pill = (active: boolean, disabled?: boolean) => cn("text-caption min-h-10 rounded-[10px] border px-3 py-2 text-left transition-colors", active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background hover:border-accent", disabled && "cursor-not-allowed line-through opacity-40 hover:border-border");

  return (
    <div className="rounded-[16px] border border-border bg-surface p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Book a call · {step + 1}/{STEPS.length}</p>
        <button type="button" className="text-caption text-muted-foreground underline" onClick={onCancel}>Cancel</button>
      </div>
      {!exp && !err && <p className="text-caption text-muted-foreground">Loading available times…</p>}
      {exp && (
        <div className="space-y-2">
          {key === "service" && <div className="grid gap-2">{exp.services.map((s) => <button key={s} type="button" className={pill(v.service === s)} onClick={() => setV({ ...v, service: s })}>{s}</button>)}</div>}
          {key === "name" && input("name", "text", "Your name")}
          {key === "whatsapp" && <>{input("phone", "tel", "WhatsApp number")}<p className="text-caption text-muted-foreground">Used only to arrange this call.</p></>}
          {key === "email" && input("email", "email", "Email")}
          {key === "date" && (exp.days.filter((d) => d.slots.some((s) => !s.booked)).length
            ? <div className="grid grid-cols-3 gap-2">{exp.days.filter((d) => d.slots.some((s) => !s.booked)).slice(0, 15).map((d) => <button key={d.date} type="button" className={pill(v.date === d.date)} onClick={() => setV({ ...v, date: d.date, slot: "" })}>{longDate(d.date)}</button>)}</div>
            : <p className="text-caption text-muted-foreground">There are no open times right now. Please talk to our team instead.</p>)}
          {key === "time" && day && <>
            <div className="grid grid-cols-3 gap-2">{day.slots.map((s) => <button key={s.iso} type="button" disabled={s.booked} aria-label={s.booked ? `${localTime(s.iso)} unavailable` : localTime(s.iso)} className={pill(v.slot === s.iso, s.booked)} onClick={() => setV({ ...v, slot: s.iso })}>{localTime(s.iso)}</button>)}</div>
            <p className="text-caption text-muted-foreground">Times shown in {userTz}.</p>
          </>}
          {key === "review" && (
            <dl className="text-caption grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Topic</dt><dd>{v.service}</dd>
              <dt className="text-muted-foreground">Name</dt><dd>{v.name}</dd>
              <dt className="text-muted-foreground">WhatsApp</dt><dd>{v.phone}</dd>
              <dt className="text-muted-foreground">Email</dt><dd>{v.email}</dd>
              <dt className="text-muted-foreground">When</dt><dd>{longDate(v.date)}, {v.slot && localTime(v.slot)}</dd>
            </dl>
          )}
        </div>
      )}
      {err && <p role="alert" className="text-caption mt-2 text-destructive">{err}</p>}
      {exp && (
        <div className="mt-3 flex gap-2">
          {step > 0 && <button type="button" className="text-caption rounded-full border border-border px-4 py-2" onClick={() => { setErr(null); setStep(step - 1); }}>Back</button>}
          {key !== "review"
            ? <button type="button" className="text-caption flex-1 rounded-full bg-foreground px-4 py-2 font-medium text-background" onClick={() => { const bad = validate(); bad ? setErr(bad) : next(); }}>Continue</button>
            : <button type="button" disabled={busy} className="text-caption flex-1 rounded-full bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-50" onClick={confirm}>{busy ? "Submitting…" : "Confirm booking"}</button>}
        </div>
      )}
    </div>
  );
}
