import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { aria, Field, FormAlert, Honeypot, fieldCls, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { submitBooking } from "@/lib/inquiry.functions";
import { useClientSession } from "@/lib/client-session";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book-a-call")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ meta: pageMeta({ title: "Book a Call | Branta Tech", description: "Request a call with the Branta team. Pick a time that suits you and we'll confirm it." }) }),
  component: BookCall,
});

/** Converts a wall-clock date+time in an IANA zone to a UTC ISO string. */
function zonedToIso(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh == null || mm == null) return null;
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asZone = Date.UTC(+parts["year"]!, +parts["month"]! - 1, +parts["day"]!, +parts["hour"]!, +parts["minute"]!);
  return new Date(guess - (asZone - guess)).toISOString();
}

function BookCall() {
  const submit = useServerFn(submitBooking);
  const { user } = useClientSession();
  const started = useRef(Date.now());
  const [tz, setTz] = useState("UTC");
  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { return []; }
  }, []);
  useEffect(() => { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }, []);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const iso = fd["date"] && fd["time"] ? zonedToIso(fd["date"], fd["time"], tz) : null;
    if (!iso) { setErrs({ date: "Choose a date and time" }); return setError("Please check the highlighted fields."); }
    setBusy(true); setError(null); setErrs({});
    try {
      const r = await submit({ data: { ...fd, requested_start_at: iso, timezone: tz, started_at: String(started.current) } });
      if (r.ok) { setDone(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else { setError(r.error); setErrs(r.fields ?? {}); }
    } catch {
      setError("We couldn't send your request. Please try again.");
    } finally { setBusy(false); }
  }

  const a = (k: string) => aria(errs, k);
  return (
    <SiteShell>
      <section className="dark bg-background py-16 text-foreground md:py-24">
        <SiteContainer>
          <Eyebrow>BOOK A CALL</Eyebrow>
          <h1 className="text-display-lg mt-4 max-w-3xl">Let's talk it through.</h1>
          <p className="text-body-lg mt-5 max-w-2xl text-muted-foreground">Suggest a time that works for you. This is a request — we'll confirm the time with you before the call.</p>
        </SiteContainer>
      </section>
      <section className="bg-background py-12 md:py-20">
        <SiteContainer>
          <div className="mx-auto max-w-3xl">
            {done ? (
              <div role="status" className="rounded-md border border-border bg-surface p-8">
                <h2 className="text-h2 text-foreground">Call request sent</h2>
                <p className="text-body mt-4 text-muted-foreground">Thank you. We'll get back to you to confirm the time or suggest another.</p>
                {user && <Link to="/client/bookings" className={cn(buttonVariants({ variant: "secondary", size: "md" }), "mt-6")}>View your bookings</Link>}
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6 rounded-md border border-border bg-surface p-6 md:p-10" aria-label="Book a call">
                <p className="text-small text-muted-foreground">Fields marked * are required.</p>
                {error && <FormAlert>{error}</FormAlert>}
                <div className="grid gap-5 md:grid-cols-2">
                  <Field id="name" label="Name" required error={errs["name"]}><input id="name" name="name" autoComplete="name" defaultValue={(user?.user_metadata?.["full_name"] as string) ?? ""} className={inputCls} {...a("name")} /></Field>
                  <Field id="email" label="Email" required error={errs["email"]}><input id="email" name="email" type="email" autoComplete="email" defaultValue={user?.email ?? ""} className={inputCls} {...a("email")} /></Field>
                  <Field id="phone" label="Phone" error={errs["phone"]}><input id="phone" name="phone" type="tel" autoComplete="tel" className={inputCls} {...a("phone")} /></Field>
                  <Field id="company" label="Company" error={errs["company"]}><input id="company" name="company" autoComplete="organization" className={inputCls} {...a("company")} /></Field>
                </div>
                <Field id="topic" label="What would you like to discuss?" required error={errs["topic"]}><input id="topic" name="topic" maxLength={300} className={inputCls} {...a("topic")} /></Field>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field id="date" label="Preferred date" required error={errs["date"]}><input id="date" name="date" type="date" className={inputCls} {...a("date")} /></Field>
                  <Field id="time" label="Preferred time" required><input id="time" name="time" type="time" step={900} className={inputCls} /></Field>
                  <Field id="tz" label="Timezone" required error={errs["timezone"]}>
                    <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className={inputCls}>
                      {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                    </select>
                  </Field>
                </div>
                <Field id="notes" label="Notes" error={errs["notes"]}><textarea id="notes" name="notes" rows={4} className={cn(fieldCls, "py-2")} /></Field>
                <Honeypot />
                <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full md:w-auto md:self-start")}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Sending…" : "Request call"}
                </button>
              </form>
            )}
          </div>
        </SiteContainer>
      </section>
    </SiteShell>
  );
}
