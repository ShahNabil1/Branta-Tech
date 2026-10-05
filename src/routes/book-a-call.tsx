import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Loader2, MessageSquareText, Search, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { SectionMedia } from "@/components/media/SectionMedia";
import { aria, Field, FormAlert, Honeypot, fieldCls, inputCls } from "@/components/forms/FormKit";
import { Button, buttonVariants } from "@/components/ui/brand-button";
import { Calendar } from "@/components/ui/calendar";
import { siteChromeQuery } from "@/lib/navigation";
import { bookingExperienceQuery } from "@/lib/booking.functions";
import { submitBooking } from "@/lib/inquiry.functions";
import { useClientSession } from "@/lib/client-session";
import { pageMeta, canonical } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book-a-call")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(bookingExperienceQuery)]),
  head: () => ({ links: canonical("/book-a-call"), meta: pageMeta({ title: "Book a 30-Minute Discovery Call | Branta Tech", description: "Choose an available time for a focused discovery call with Branta Tech about your project, challenge or opportunity." }) }),
  component: BookCall,
});

const STEPS = ["Details", "Need", "Date", "Time", "Confirm"];
const CALL_STEPS = [
  { icon: Search, n: "01", title: "Understand", body: "We unpack the idea, challenge and context." },
  { icon: MessageSquareText, n: "02", title: "Explore", body: "We discuss possibilities, priorities and constraints." },
  { icon: Sparkles, n: "03", title: "Shape", body: "We identify the clearest direction and approach." },
  { icon: ArrowRight, n: "04", title: "Next step", body: "We agree what should happen after the call." },
];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function BookCall() {
  const { data } = useSuspenseQuery(bookingExperienceQuery);
  const queryClient = useQueryClient();
  const submit = useServerFn(submitBooking);
  const { user } = useClientSession();
  const startRef = useRef(Date.now());
  const bookingRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [date, setDate] = useState<Date>();
  const [slot, setSlot] = useState("");
  const [tz, setTz] = useState("UTC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ reference: string; status: string } | null>(null);
  const [values, setValues] = useState({ name: (user?.user_metadata?.["full_name"] as string) ?? "", email: user?.email ?? "", phone: "", company: "", topic: "", notes: "" });
  useEffect(() => { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }, []);

  const available = useMemo(() => new Set(data.days.filter((d) => d.slots.some((x) => !x.booked)).map((d) => d.date)), [data.days]);
  const fullyBooked = useMemo(() => new Set(data.days.filter((d) => d.slots.every((x) => x.booked)).map((d) => d.date)), [data.days]);
  const dateString = date ? dayKey(date) : "";
  const officeSlots = data.days.find((d) => d.date === dateString)?.slots ?? [];
  const currentSlot = officeSlots.find((s) => s.iso === slot && !s.booked);
  const userTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: data.settings.timezone }).format(new Date(iso));
  const setValue = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  function validate(next: number) {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (values.name.trim().length < 2) e["name"] = "Enter your name";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e["email"] = "Enter a valid email";
      if (!/^[+\d\s().-]{6,}$/.test(values.phone)) e["phone"] = "Enter your WhatsApp number";
    }
    if (step === 1 && !selectedServices.length) e["services"] = "Choose at least one service";
    if (step === 1 && values.topic.trim().length < 3) e["topic"] = "Tell us briefly what you want to discuss";
    if (step === 2 && !date) e["date"] = "Choose an available date";
    if (step === 3 && !slot) e["time"] = "Choose an available time";
    setErrs(e); setError(Object.keys(e).length ? "Please check the highlighted fields." : null);
    if (!Object.keys(e).length) { setStep(next); bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !slot) return;
    setBusy(true); setError(null); setErrs({});
    try {
      const result = await submit({ data: { ...values, services: selectedServices, requested_start_at: slot, timezone: tz, started_at: String(startRef.current), hp_field: "" } });
      if (result.ok) {
        setConfirmation({ reference: result.bookingReference ?? "Received", status: result.status ?? "requested" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(result.error); setErrs(result.fields ?? {});
        if (result.fields?.["time"]) { setSlot(""); setStep(3); void queryClient.invalidateQueries({ queryKey: bookingExperienceQuery.queryKey }); }
      }
    } catch { setError("We couldn't send your request. Please try again."); }
    finally { setBusy(false); }
  }

  const media = data.settings.introMedia[0];
  return (
    <SiteShell>
      <main className="booking-atmosphere px-3 py-8 sm:px-6 md:py-14">
        <div className="booking-frame mx-auto max-w-[1360px] rounded-[28px] border border-border p-5 sm:p-8 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:gap-12">
            <div className="flex flex-col">
              <Eyebrow>BOOK A CALL</Eyebrow>
              <h1 className="text-h1 mt-5 max-w-[16ch]">Let’s talk about what you’re building.</h1>
              <p className="text-body-lg mt-5 max-w-xl text-muted-foreground">A focused conversation to understand your idea, challenge or opportunity and see how Branta can help.</p>
              <p className="text-eyebrow mt-7 flex items-center gap-2 text-accent"><Clock3 className="size-4" aria-hidden />{data.settings.durationMinutes} MINUTE DISCOVERY CALL</p>
              {media && <div className="mt-8"><SectionMedia item={{ ...media, aspect: "16:9" }} className="rounded-2xl" eager /></div>}
              <div className="mt-8 border-t border-border pt-6">
                <p className="text-small font-medium">What we’ll cover</p>
                <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {COVER.map((c) => <li key={c} className="text-small flex items-center gap-2.5 text-muted-foreground"><Check className="size-4 shrink-0 text-accent" aria-hidden />{c}</li>)}
                </ul>
              </div>
              <p className="text-caption mt-6 text-muted-foreground">No obligation. We confirm every time personally before sending a meeting link.</p>
            </div>

            <div ref={bookingRef} className="scroll-mt-24">
              <div className="overflow-hidden rounded-2xl border border-border bg-surface lg:sticky lg:top-24">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
                  <div><p className="text-body font-medium">Discovery Call</p><p className="text-caption text-muted-foreground">Branta Tech</p></div>
                  <div className="text-caption flex items-center gap-4 text-muted-foreground"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden />{data.settings.durationMinutes} min</span><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden />{tz.replace(/_/g, " ")}</span></div>
                </div>
                {confirmation ? <div className="step-in p-5 sm:p-8"><Confirmation reference={confirmation.reference} confirmed={confirmation.status === "confirmed"} user={!!user} slot={slot} timezone={tz} duration={data.settings.durationMinutes} /></div> : (
                  <form onSubmit={onSubmit} className="p-5 sm:p-7" noValidate>
                    <ol className="flex items-center gap-1.5" aria-label="Booking steps">
                      {STEPS.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className="flex flex-1 flex-col gap-2">
                        <span className={cn("h-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-border")} />
                        <span className={cn("text-caption hidden sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                      </li>)}
                    </ol>
                    <p className="text-caption mt-3 text-muted-foreground sm:hidden">Step {step + 1} of 5 · {STEPS[step]}</p>
                    {error && <div className="mt-6"><FormAlert>{error}</FormAlert></div>}
                    <div key={step} className="step-in mt-7 min-h-[420px]">
                      {step === 0 && <StepDetails values={values} setValue={setValue} errs={errs} />}
                      {step === 1 && <StepNeeds services={data.services} selected={selectedServices} setSelected={setSelectedServices} values={values} setValue={setValue} errs={errs} />}
                      {step === 2 && <StepDate value={date} onChange={(d) => { setDate(d); setSlot(""); if (d) { setErrs({}); setError(null); } }} available={available} full={fullyBooked} min={data.days[0]?.date} max={data.days.at(-1)?.date} error={errs["date"]} />}
                      {step === 3 && <StepTime date={dateString} slots={officeSlots} value={slot} onChange={setSlot} userTime={userTime} officeZone={data.settings.timezone} error={errs["time"]} />}
                      {step === 4 && currentSlot && <StepReview values={values} services={selectedServices} iso={currentSlot.iso} longDate={longDate} userTime={userTime} timezone={tz} duration={data.settings.durationMinutes} />}
                    </div>
                    <Honeypot />
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                      {step > 0 ? <Button type="button" variant="ghost" onClick={() => { setStep((s) => s - 1); setError(null); }}><ArrowLeft className="size-4" /> Back</Button> : <span />}
                      {step < 4 ? <Button type="button" onClick={() => validate(step + 1)}>Continue <ArrowRight className="size-4" /></Button> : <Button type="submit" size="lg" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Checking time…" : "Confirm Booking"}</Button>}
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="mx-auto mt-6 max-w-[1360px] rounded-[28px] border border-border bg-surface/80 p-5 sm:p-8 lg:p-12">
          <Eyebrow>THE CONVERSATION</Eyebrow>
          <h2 className="text-h2 mt-4">What happens in 30 minutes?</h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {CALL_STEPS.map(({ icon: Icon, n, title, body }) => <article key={title} className="bg-surface p-6">
              <div className="flex items-center justify-between"><span className="text-caption text-muted-foreground">{n}</span><Icon className="size-5 text-accent" aria-hidden /></div>
              <h3 className="text-h4 mt-8">{title}</h3><p className="text-small mt-2 text-muted-foreground">{body}</p>
            </article>)}
          </div>
          {data.settings.processMedia[0] && <div className="mt-8"><SectionMedia item={data.settings.processMedia[0]} className="rounded-2xl" /></div>}
        </section>
      </main>
    </SiteShell>
  );
}

const COVER = ["Your goal", "What you want to build", "What’s currently blocking you", "Possible direction", "Next steps"];

type Values = { name: string; email: string; phone: string; company: string; topic: string; notes: string };
function StepDetails({ values, setValue, errs }: { values: Values; setValue: (k: keyof Values, v: string) => void; errs: Record<string, string> }) {
  const a = (k: string) => aria(errs, k);
  return <div><h3 className="text-h3">Who are we speaking with?</h3><p className="text-small mt-2 text-muted-foreground">Just the essentials for your booking update.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">
    <Field id="name" label="Name" required error={errs["name"]}><input id="name" autoComplete="name" value={values.name} onChange={(e) => setValue("name", e.target.value)} className={inputCls} {...a("name")} /></Field>
    <Field id="phone" label="WhatsApp number" required error={errs["phone"]}><input id="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(e) => setValue("phone", e.target.value)} className={inputCls} {...a("phone")} /></Field>
    <Field id="email" label="Email" required error={errs["email"]}><input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => setValue("email", e.target.value)} className={inputCls} {...a("email")} /></Field>
    <Field id="company" label="Company (optional)"><input id="company" autoComplete="organization" value={values.company} onChange={(e) => setValue("company", e.target.value)} className={inputCls} /></Field>
  </div></div>;
}

function StepNeeds({ services, selected, setSelected, values, setValue, errs }: { services: string[]; selected: string[]; setSelected: (s: string[]) => void; values: Values; setValue: (k: keyof Values, v: string) => void; errs: Record<string, string> }) {
  return <div><h3 className="text-h3">What would you like to discuss?</h3><p className="text-small mt-2 text-muted-foreground">Choose everything that feels relevant.</p>
    <fieldset className="mt-6"><legend className="sr-only">Services</legend><div className="flex flex-wrap gap-2">{services.map((s) => { const on = selected.includes(s); return <label key={s} className={cn("text-small inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", on ? "border-accent bg-accent/10 text-foreground" : "border-border hover:border-foreground")}><input type="checkbox" className="sr-only" checked={on} onChange={() => setSelected(on ? selected.filter((x) => x !== s) : [...selected, s])} />{on && <Check className="size-3.5 text-accent" aria-hidden />}{s}</label>; })}</div>{errs["services"] && <p className="text-caption mt-2 text-destructive">{errs["services"]}</p>}</fieldset>
    <div className="mt-6"><Field id="topic" label="A short note about your project" required error={errs["topic"]}><textarea id="topic" rows={4} maxLength={300} value={values.topic} onChange={(e) => setValue("topic", e.target.value)} className={cn(fieldCls, "py-3")} /></Field></div>
  </div>;
}

function StepDate({ value, onChange, available, full, min, max, error }: { value: Date | undefined; onChange: (d: Date | undefined) => void; available: Set<string>; full: Set<string>; min: string | undefined; max: string | undefined; error: string | undefined }) {
  const first = min ? new Date(`${min}T12:00:00`) : new Date(); const last = max ? new Date(`${max}T12:00:00`) : new Date();
  return <div><h3 className="text-h3">Choose a date.</h3><p className="text-small mt-2 text-muted-foreground">Only days with real Branta availability can be selected.</p>
    {available.size ? <>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-[var(--warm)] p-3 sm:p-5">
        <Calendar mode="single" selected={value} onSelect={onChange} defaultMonth={first} fromMonth={first} toMonth={last} disabled={(d) => !available.has(dayKey(d))}
          modifiers={{ full: (d) => full.has(dayKey(d)) }} modifiersClassNames={{ full: "[&_button]:line-through", today: "[&_button]:underline [&_button]:decoration-accent [&_button]:decoration-2 [&_button]:underline-offset-4" }}
          className="pointer-events-auto mx-auto bg-transparent [--cell-size:2.6rem] sm:[--cell-size:3rem]" />
      </div>
      <div className="text-caption mt-3 flex flex-wrap gap-4 text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" />Selected</span><span className="underline decoration-accent decoration-2 underline-offset-4">Today</span><span className="line-through">Fully booked</span><span className="opacity-50">Unavailable</span></div>
    </> : <div className="mt-6"><FormAlert tone="info">There are no bookable dates right now. Please check back soon.</FormAlert></div>}{error && <p className="text-caption mt-2 text-destructive">{error}</p>}</div>;
}

function StepTime({ date, slots, value, onChange, userTime, officeZone, error }: { date: string; slots: { iso: string; label: string; booked?: boolean }[]; value: string; onChange: (v: string) => void; userTime: (v: string) => string; officeZone: string; error: string | undefined }) {
  return <div><h3 className="text-h3">Choose a time.</h3><p className="text-small mt-2 text-muted-foreground">{date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(`${date}T12:00:00`)) : "Your selected date"} · shown in your time</p>
    <div role="radiogroup" aria-label="Available times" className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{slots.map((s, i) => {
      const on = value === s.iso;
      return <button key={s.iso} type="button" role="radio" aria-checked={on} disabled={s.booked} onClick={() => onChange(s.iso)} style={{ ["--cap-delay" as string]: `${i * 25}ms` }}
        className={cn("cap-in rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent", s.booked ? "cursor-not-allowed border-dashed border-border text-muted-foreground/60" : on ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-foreground")}>
        <span className={cn("text-body block font-medium", s.booked && "line-through")}>{userTime(s.iso)}</span>
        <span className={cn("text-caption block", on ? "text-accent-foreground/80" : "text-muted-foreground")}>{s.booked ? "Booked" : `${s.label} ${officeZone.split("/").pop()?.replace(/_/g, " ")}`}</span>
      </button>;
    })}</div>{slots.every((s) => s.booked) && <div className="mt-4"><FormAlert tone="info">No times remain on this date. Go back and choose another day.</FormAlert></div>}{error && <p className="text-caption mt-2 text-destructive">{error}</p>}</div>;
}

function StepReview({ values, services, iso, longDate, userTime, timezone, duration }: { values: Values; services: string[]; iso: string; longDate: (v: string) => string; userTime: (v: string) => string; timezone: string; duration: number }) {
  const rows = [["Name", values.name], ["Email", values.email], ["WhatsApp", values.phone], ["Topic", [services.join(", "), values.topic].filter(Boolean).join(" — ")], ["Date", longDate(iso)], ["Time", userTime(iso)], ["Timezone", timezone.replace(/_/g, " ")], ["Duration", `${duration} minutes`]];
  return <div><h3 className="text-h3">Confirm your call.</h3><p className="text-small mt-2 text-muted-foreground">We’ll check this time once more when you confirm.</p><dl className="mt-6 divide-y divide-border rounded-xl border border-border">{rows.map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[110px_1fr]"><dt className="text-small text-muted-foreground">{k}</dt><dd className="text-small break-words font-medium">{v}</dd></div>)}</dl></div>;
}

function Confirmation({ reference, confirmed, user, slot, timezone, duration }: { reference: string; confirmed: boolean; user: boolean; slot: string; timezone: string; duration: number }) {
  const d = new Date(slot);
  const rows = [["Date", new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: timezone }).format(d)], ["Time", new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: timezone }).format(d)], ["Timezone", timezone.replace(/_/g, " ")], ["Duration", `${duration} minutes`], ["Reference", reference]];
  return <div className="py-4 text-center"><CheckCircle2 className="mx-auto size-11 text-accent" aria-hidden /><h2 className="text-h2 mt-5">Your Call Request Is In.</h2><p className="text-body mx-auto mt-3 max-w-md text-muted-foreground">{confirmed ? "Your time is confirmed. We’ll share the meeting link with you before the call." : "We’ve received your booking request. Once the meeting is confirmed, we’ll send the meeting link to your email and WhatsApp."}</p>
    <dl className="mt-7 divide-y divide-border rounded-xl border border-border text-left">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-small text-muted-foreground">{k}</dt><dd className="text-small text-right font-medium">{v}</dd></div>)}</dl>
    <div className="mt-7 flex flex-wrap justify-center gap-3">{user && <Link to="/client/bookings" className={buttonVariants({ variant: "primary" })}>View in Dashboard</Link>}<Link to="/" className={buttonVariants({ variant: user ? "ghost" : "primary" })}>Back to Home</Link></div>
    {!user && <p className="text-caption mt-5 text-muted-foreground">Sign in to a client account next time to track bookings in your dashboard.</p>}</div>;
}
