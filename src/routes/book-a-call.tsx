import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
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

const STEPS = ["Your details", "What you need", "Choose a date", "Choose a time", "Review"];
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

  const available = useMemo(() => new Set(data.days.map((d) => d.date)), [data.days]);
  const dateString = date ? dayKey(date) : "";
  const officeSlots = data.days.find((d) => d.date === dateString)?.slots ?? [];
  const currentSlot = officeSlots.find((s) => s.iso === slot);
  const userTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: data.settings.timezone }).format(new Date(iso));
  const setValue = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  function validate(next: number) {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (values.name.trim().length < 2) e["name"] = "Enter your name";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e["email"] = "Enter a valid email";
      if (values.phone && !/^[+\d\s().-]{6,}$/.test(values.phone)) e["phone"] = "Check the phone number";
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
        if (result.fields?.["time"]) setStep(3);
      }
    } catch { setError("We couldn't send your request. Please try again."); }
    finally { setBusy(false); }
  }

  const media = data.settings.introMedia[0];
  return (
    <SiteShell>
      <main>
        <section className="dark overflow-hidden bg-background pb-14 pt-16 text-foreground md:pb-24 md:pt-24">
          <SiteContainer wide>
            <Eyebrow>BOOK A CALL</Eyebrow>
            <div className="mt-5 grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <h1 className="text-display-xl max-w-[12ch]">Let's talk about what you're building.</h1>
                <p className="text-body-lg mt-6 max-w-2xl text-muted-foreground">A focused conversation to understand your idea, challenge or opportunity — and see how Branta can help.</p>
                <Button className="mt-8" size="lg" onClick={() => bookingRef.current?.scrollIntoView({ behavior: "smooth" })}>Choose a time <ArrowRight className="size-4" aria-hidden /></Button>
              </div>
              <div className="text-small flex items-center gap-3 text-muted-foreground lg:col-span-3 lg:col-start-10"><Clock3 className="size-5 text-accent" aria-hidden />{data.settings.durationMinutes}-minute discovery call</div>
            </div>
            {media && <div className="mt-12 md:mt-16"><SectionMedia item={media} className="rounded-md" eager /></div>}
          </SiteContainer>
        </section>

        <section className="bg-[var(--warm)] py-16 md:py-24">
          <SiteContainer>
            <Eyebrow>THE CONVERSATION</Eyebrow>
            <h2 className="text-h1 mt-4 max-w-2xl">What happens in 30 minutes?</h2>
            <div className="mt-12 grid border-y border-border md:grid-cols-4">
              {CALL_STEPS.map(({ icon: Icon, n, title, body }, i) => <article key={title} className={cn("py-7 md:px-6", i > 0 && "border-t border-border md:border-l md:border-t-0")}>
                <div className="flex items-center justify-between"><span className="text-caption text-muted-foreground">{n}</span><Icon className="size-5 text-accent" aria-hidden /></div>
                <h3 className="text-h3 mt-10">{title}</h3><p className="text-small mt-3 text-muted-foreground">{body}</p>
              </article>)}
            </div>
          </SiteContainer>
        </section>

        <section ref={bookingRef} className="scroll-mt-20 bg-background py-16 md:py-24">
          <SiteContainer wide>
            {confirmation ? <Confirmation reference={confirmation.reference} confirmed={confirmation.status === "confirmed"} user={!!user} slot={slot} timezone={tz} services={selectedServices} duration={data.settings.durationMinutes} /> : (
              <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]" noValidate>
                <aside className="lg:sticky lg:top-28 lg:self-start">
                  <Eyebrow>YOUR CALL</Eyebrow><h2 className="text-h2 mt-4">Book your discovery session.</h2>
                  <ol className="mt-8 grid grid-cols-5 gap-1 lg:grid-cols-1 lg:gap-0">
                    {STEPS.map((label, i) => <li key={label} className={cn("relative flex items-center gap-3 border-border py-3 lg:border-l lg:pl-5", i <= step ? "text-foreground" : "text-muted-foreground")}>
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-caption", i < step ? "border-accent bg-accent text-accent-foreground" : i === step ? "border-foreground" : "border-border")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
                      <span className="text-small hidden lg:block">{label}</span>
                    </li>)}
                  </ol>
                  <div className="text-caption mt-7 border-t border-border pt-5 text-muted-foreground"><p>{data.settings.durationMinutes} minutes</p><p className="mt-1">Times shown in {tz.replace(/_/g, " ")}</p></div>
                </aside>
                <div className="min-h-[560px] rounded-md border border-border bg-surface p-5 sm:p-8 md:p-10">
                  <div className="mb-8 flex items-center justify-between"><span className="text-eyebrow text-muted-foreground">STEP {step + 1} OF 5</span><span className="text-caption text-muted-foreground">{STEPS[step]}</span></div>
                  {error && <div className="mb-6"><FormAlert>{error}</FormAlert></div>}
                  {step === 0 && <StepDetails values={values} setValue={setValue} errs={errs} />}
                  {step === 1 && <StepNeeds services={data.services} selected={selectedServices} setSelected={setSelectedServices} values={values} setValue={setValue} errs={errs} />}
                  {step === 2 && <StepDate value={date} onChange={(d) => { setDate(d); setSlot(""); }} available={available} min={data.days[0]?.date} max={data.days.at(-1)?.date} error={errs["date"]} />}
                  {step === 3 && <StepTime date={dateString} slots={officeSlots} value={slot} onChange={setSlot} userTime={userTime} officeZone={data.settings.timezone} userZone={tz} error={errs["time"]} />}
                  {step === 4 && currentSlot && <StepReview values={values} services={selectedServices} iso={currentSlot.iso} longDate={longDate} userTime={userTime} timezone={tz} duration={data.settings.durationMinutes} />}
                  <Honeypot />
                  <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
                    {step > 0 ? <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft className="size-4" /> Back</Button> : <span />}
                    {step < 4 ? <Button type="button" onClick={() => validate(step + 1)}>Continue <ArrowRight className="size-4" /></Button> : <Button type="submit" size="lg" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Checking time…" : "Request this call"}</Button>}
                  </div>
                </div>
              </form>
            )}
          </SiteContainer>
        </section>
      </main>
    </SiteShell>
  );
}

type Values = { name: string; email: string; phone: string; company: string; topic: string; notes: string };
function StepDetails({ values, setValue, errs }: { values: Values; setValue: (k: keyof Values, v: string) => void; errs: Record<string, string> }) {
  const a = (k: string) => aria(errs, k);
  return <div><h3 className="text-h2">First, who are we speaking with?</h3><p className="text-body mt-3 text-muted-foreground">Just the essentials. We’ll use these details for your booking update.</p><div className="mt-8 grid gap-5 md:grid-cols-2">
    <Field id="name" label="Full name" required error={errs["name"]}><input id="name" autoComplete="name" value={values.name} onChange={(e) => setValue("name", e.target.value)} className={inputCls} {...a("name")} /></Field>
    <Field id="email" label="Email" required error={errs["email"]}><input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => setValue("email", e.target.value)} className={inputCls} {...a("email")} /></Field>
    <Field id="phone" label="WhatsApp / phone" error={errs["phone"]}><input id="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(e) => setValue("phone", e.target.value)} className={inputCls} {...a("phone")} /></Field>
    <Field id="company" label="Company"><input id="company" autoComplete="organization" value={values.company} onChange={(e) => setValue("company", e.target.value)} className={inputCls} /></Field>
  </div></div>;
}

function StepNeeds({ services, selected, setSelected, values, setValue, errs }: { services: string[]; selected: string[]; setSelected: (s: string[]) => void; values: Values; setValue: (k: keyof Values, v: string) => void; errs: Record<string, string> }) {
  return <div><h3 className="text-h2">What do you want to explore?</h3><p className="text-body mt-3 text-muted-foreground">Choose everything that feels relevant. We’ll help shape the brief together.</p>
    <fieldset className="mt-8"><legend className="sr-only">Services</legend><div className="grid gap-3 sm:grid-cols-2">{services.map((s) => { const on = selected.includes(s); return <label key={s} className={cn("text-small flex min-h-14 cursor-pointer items-center justify-between rounded-sm border px-4 py-3 transition-colors", on ? "border-accent bg-accent/5" : "border-border hover:border-foreground")}><span>{s}</span><input type="checkbox" className="sr-only" checked={on} onChange={() => setSelected(on ? selected.filter((x) => x !== s) : [...selected, s])} /><span className={cn("flex size-5 items-center justify-center rounded-full border", on ? "border-accent bg-accent text-accent-foreground" : "border-border")}>{on && <Check className="size-3" />}</span></label>; })}</div>{errs["services"] && <p className="text-caption mt-2 text-destructive">{errs["services"]}</p>}</fieldset>
    <div className="mt-7"><Field id="topic" label="What would you like to discuss?" required error={errs["topic"]}><textarea id="topic" rows={4} maxLength={300} value={values.topic} onChange={(e) => setValue("topic", e.target.value)} className={cn(fieldCls, "py-3")} /></Field></div>
    <div className="mt-5"><Field id="notes" label="Anything useful before we meet?"><textarea id="notes" rows={3} maxLength={2000} value={values.notes} onChange={(e) => setValue("notes", e.target.value)} className={cn(fieldCls, "py-3")} /></Field></div>
  </div>;
}

function StepDate({ value, onChange, available, min, max, error }: { value: Date | undefined; onChange: (d: Date | undefined) => void; available: Set<string>; min: string | undefined; max: string | undefined; error: string | undefined }) {
  const first = min ? new Date(`${min}T12:00:00`) : new Date(); const last = max ? new Date(`${max}T12:00:00`) : new Date();
  return <div><h3 className="text-h2">Choose a date.</h3><p className="text-body mt-3 text-muted-foreground">Only days with real Branta availability can be selected.</p><div className="mt-8 overflow-x-auto rounded-md border border-border p-3 sm:p-6"><Calendar mode="single" selected={value} onSelect={onChange} defaultMonth={first} fromMonth={first} toMonth={last} disabled={(d) => !available.has(dayKey(d))} className="pointer-events-auto mx-auto [--cell-size:2.75rem]" /></div>{error && <p className="text-caption mt-2 text-destructive">{error}</p>}</div>;
}

function StepTime({ date, slots, value, onChange, userTime, officeZone, userZone, error }: { date: string; slots: { iso: string; label: string }[]; value: string; onChange: (v: string) => void; userTime: (v: string) => string; officeZone: string; userZone: string; error: string | undefined }) {
  return <div><h3 className="text-h2">Choose a time.</h3><p className="text-body mt-3 text-muted-foreground">Available on {date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(`${date}T12:00:00`)) : "your selected date"}.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{slots.map((s) => <label key={s.iso} className={cn("cursor-pointer rounded-sm border px-4 py-4", value === s.iso ? "border-accent bg-accent/5" : "border-border hover:border-foreground")}><input type="radio" className="sr-only" checked={value === s.iso} onChange={() => onChange(s.iso)} /><span className="text-body font-medium">{userTime(s.iso)}</span><span className="text-caption mt-1 block text-muted-foreground">Your time · {s.label} {officeZone.replace(/_/g, " ")}</span></label>)}</div>{slots.length === 0 && <FormAlert tone="info">No times remain on this date. Go back and choose another day.</FormAlert>}{error && <p className="text-caption mt-2 text-destructive">{error}</p>}<p className="text-caption mt-6 text-muted-foreground">Detected timezone: {userZone.replace(/_/g, " ")}</p></div>;
}

function StepReview({ values, services, iso, longDate, userTime, timezone, duration }: { values: Values; services: string[]; iso: string; longDate: (v: string) => string; userTime: (v: string) => string; timezone: string; duration: number }) {
  const rows = [["Date", longDate(iso)], ["Time", `${userTime(iso)} (${timezone.replace(/_/g, " ")})`], ["Duration", `${duration} minutes`], ["For", values.name], ["Email", values.email], ["Services", services.join(", ")], ["Discussion", values.topic]];
  return <div><h3 className="text-h2">Review your call.</h3><p className="text-body mt-3 text-muted-foreground">We’ll check this time once more when you submit.</p><dl className="mt-8 divide-y divide-border rounded-md border border-border">{rows.map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-small text-muted-foreground">{k}</dt><dd className="text-small break-words font-medium">{v}</dd></div>)}</dl><p className="text-caption mt-5 text-muted-foreground">This is a booking request. We’ll send the meeting link after the time is confirmed.</p></div>;
}

function Confirmation({ reference, confirmed, user, slot, timezone, services, duration }: { reference: string; confirmed: boolean; user: boolean; slot: string; timezone: string; services: string[]; duration: number }) {
  return <div className="mx-auto max-w-3xl py-8 text-center"><CheckCircle2 className="mx-auto size-12 text-accent" aria-hidden /><Eyebrow className="mt-8 justify-center">REQUEST RECEIVED</Eyebrow><h2 className="text-display mt-4">Your call is in motion.</h2><p className="text-body-lg mx-auto mt-5 max-w-xl text-muted-foreground">{confirmed ? "Your time is confirmed. We'll send the meeting link separately." : "We’ll confirm the time and send the meeting link to your email and WhatsApp."}</p><div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border text-left sm:grid-cols-2"><div className="bg-surface p-5"><p className="text-caption text-muted-foreground">Booking reference</p><p className="text-body mt-1 font-medium">{reference}</p></div><div className="bg-surface p-5"><p className="text-caption text-muted-foreground">Date and time</p><p className="text-body mt-1 font-medium">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(slot))}</p></div><div className="bg-surface p-5"><p className="text-caption text-muted-foreground">Duration</p><p className="text-body mt-1 font-medium">{duration} minutes</p></div><div className="bg-surface p-5"><p className="text-caption text-muted-foreground">Services</p><p className="text-body mt-1 font-medium">{services.join(", ")}</p></div></div>{user ? <Link to="/client/bookings" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8")}>View in your dashboard</Link> : <p className="text-small mt-8 text-muted-foreground">Create or sign in to a client account before booking next time to keep requests in your dashboard.</p>}</div>;
}