import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { LEAD_EMAIL_RE, LEAD_NAME_RE, LEAD_PHONE_RE, normalizePhone, type LeadProfile, type LeadSettings } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

/**
 * Conversational lead capture shown before Branta Assistant starts. One prompt per scene,
 * short assistant echo lines between scenes, values kept in local state if saving fails.
 */
type Field = "name" | "whatsapp" | "email";
type Scene = "welcome" | Field | "done";
export type LeadValues = { name?: string; whatsapp?: string; email?: string };

const CODES: [string, string][] = [
  ["+880", "BD"], ["+91", "IN"], ["+92", "PK"], ["+977", "NP"], ["+94", "LK"], ["+971", "AE"], ["+966", "SA"], ["+974", "QA"],
  ["+965", "KW"], ["+968", "OM"], ["+60", "MY"], ["+65", "SG"], ["+44", "UK"], ["+1", "US/CA"], ["+61", "AU"], ["+49", "DE"],
  ["+33", "FR"], ["+39", "IT"], ["+34", "ES"], ["+31", "NL"], ["+46", "SE"], ["+81", "JP"], ["+86", "CN"], ["+27", "ZA"],
];
const TZ_CODE: Record<string, string> = { "Asia/Dhaka": "+880", "Asia/Kolkata": "+91", "Asia/Calcutta": "+91", "Asia/Karachi": "+92", "Asia/Kathmandu": "+977", "Asia/Dubai": "+971", "Asia/Riyadh": "+966", "Asia/Qatar": "+974", "Asia/Kuala_Lumpur": "+60", "Asia/Singapore": "+65", "Europe/London": "+44", "Asia/Tokyo": "+81", "Africa/Johannesburg": "+27" };

const first = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";

export function LeadOnboarding({ settings, prefill, busy, error, onTrack, onSubmit }: {
  settings: LeadSettings; prefill: LeadProfile; busy: boolean; error: string | null;
  onTrack: (e: "lead_started" | "name_completed" | "whatsapp_completed" | "email_completed") => void;
  onSubmit: (v: LeadValues) => Promise<boolean>;
}) {
  // Only ask for required fields that have no valid value yet (signed-in prefill counts).
  const steps = useMemo(() => {
    const out: Field[] = [];
    if (settings.requireName && !prefill.name) out.push("name");
    if (settings.requireWhatsapp && !prefill.whatsapp) out.push("whatsapp");
    if (settings.requireEmail && !prefill.email) out.push("email");
    return out;
  }, [settings, prefill]);
  const [scene, setScene] = useState<Scene>("welcome");
  const [typing, setTyping] = useState(false);
  const [vals, setVals] = useState({ name: prefill.name ?? "", code: "", local: "", email: prefill.email ?? "" });
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [echo, setEcho] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(vals);
  latest.current = vals;

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const code = TZ_CODE[tz];
      if (code) setVals((v) => (v.code ? v : { ...v, code }));
    } catch { /* keep empty: visitor picks */ }
  }, []);
  useEffect(() => { if (scene !== "welcome" && scene !== "done" && !typing) inputRef.current?.focus({ preventScroll: true }); }, [scene, typing]);

  const values = (): LeadValues => {
    const v = latest.current;
    const name = v.name.trim() || prefill.name || "";
    return {
      ...(name ? { name } : {}),
      ...(steps.includes("whatsapp") ? { whatsapp: normalizePhone(`${v.code}${v.local.replace(/[\s().-]/g, "").replace(/^0+/, "")}`) } : prefill.whatsapp ? { whatsapp: prefill.whatsapp } : {}),
      ...((v.email || prefill.email) ? { email: (v.email || prefill.email || "").trim() } : {}),
    };
  };

  function go(next: Scene, line?: string) {
    setOk(false);
    if (line) setEcho((e) => [...e, line]);
    setTyping(true);
    window.setTimeout(() => { setTyping(false); setScene(next); }, 320);
  }
  const nextAfter = (f: Field): Field | null => steps[steps.indexOf(f) + 1] ?? null;

  async function finish() {
    setScene("done");
    const saved = await onSubmit(values());
    if (!saved) setScene(steps[steps.length - 1] ?? "welcome");
  }

  function check(f: Field): string | null {
    if (f === "name") return LEAD_NAME_RE.test(vals.name.trim()) ? null : vals.name.trim() ? "Please use letters only (at least 2)." : "Please tell us your name.";
    if (f === "whatsapp") {
      if (!vals.code) return "Choose your country code.";
      if (!vals.local.trim()) return "Please add your WhatsApp number.";
      return LEAD_PHONE_RE.test(normalizePhone(`${vals.code}${vals.local.replace(/^0+/, "")}`)) ? null : "That number doesn’t look right. Check the digits.";
    }
    const e = vals.email.trim();
    return LEAD_EMAIL_RE.test(e) ? null : e ? "Please enter a valid email address." : "Please add your email.";
  }

  function submit(f: Field) {
    const err = check(f);
    setFieldErr(err);
    if (err) return;
    setOk(true);
    onTrack(`${f}_completed`);
    const nxt = nextAfter(f);
    window.setTimeout(() => {
      if (f === "name") return nxt ? go(nxt, `Great to meet you, ${first(vals.name)}.`) : void finish();
      if (f === "whatsapp") return nxt ? go(nxt, "Perfect. One last thing.") : void finish();
      setEcho((e) => [...e, "Done. Let’s get started."]);
      void finish();
    }, 260);
  }

  const filled = scene === "done" ? steps.length : scene === "welcome" ? 0 : steps.indexOf(scene);
  const field = scene !== "welcome" && scene !== "done" ? scene : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl motion-safe:animate-[pulse_6s_ease-in-out_infinite]" />
      {steps.length > 0 && (
        <div className="relative flex justify-center gap-1.5 pt-4" aria-label={`Progress: ${filled} of ${steps.length}`}>
          {steps.map((s, i) => <span key={s} className={cn("h-1 rounded-full transition-all duration-300", i < filled ? "w-6 bg-accent" : i === filled && scene !== "welcome" ? "w-6 bg-accent/40" : "w-2 bg-border")} />)}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-5 pb-2 pt-6" aria-live="polite">
        {echo.length > 0 && (
          <div className="mb-4 space-y-2">
            {echo.map((e, i) => (
              <p key={i} className={cn("text-small w-fit max-w-[85%] rounded-[16px] bg-surface px-3.5 py-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none", i < echo.length - 1 && "opacity-60")}>{e}</p>
            ))}
          </div>
        )}
        {typing && <div aria-label="Assistant is typing" className="mb-4 flex gap-1 px-1"><TDot /><TDot d="120ms" /><TDot d="240ms" /></div>}

        {!typing && scene === "welcome" && (
          <div key="welcome" className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 motion-reduce:animate-none">
            <div aria-hidden className="mb-6 grid size-12 place-items-center rounded-[14px] bg-accent text-lg font-semibold text-accent-foreground shadow-[0_12px_40px_-12px_var(--color-accent)]">B</div>
            <h2 className="text-h3 font-semibold tracking-tight">{settings.welcomeTitle}</h2>
            <p className="text-body mt-2 text-muted-foreground">{settings.welcomeMessage}</p>
            <p className="text-caption mt-3 text-muted-foreground">This takes less than a minute.</p>
          </div>
        )}
        {!typing && field && (
          <form key={field} id="lead-step" noValidate onSubmit={(e) => { e.preventDefault(); submit(field); }}
            className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 motion-reduce:animate-none">
            <h2 className="text-h4 font-semibold tracking-tight">
              {field === "name" ? <>Nice to meet you.<br />What should I call you?</> : field === "whatsapp" ? "What’s the best WhatsApp number to reach you?" : "And what’s your email?"}
            </h2>
            {field !== "name" && <p className="text-caption mt-2 text-muted-foreground">{field === "whatsapp" ? "We’ll only use this if you request support, a call or project follow-up." : "Useful for project details, booking information or follow-up."}</p>}
            <div className="mt-5 flex gap-2 animate-in fade-in-0 zoom-in-[0.98] duration-300 motion-reduce:animate-none">
              {field === "whatsapp" && (
                <>
                  <label htmlFor="lead-code" className="sr-only">Country code</label>
                  <select id="lead-code" value={vals.code} onChange={(e) => { setVals({ ...vals, code: e.target.value }); setFieldErr(null); }}
                    className="text-body h-12 w-[6.5rem] shrink-0 rounded-[14px] border border-border bg-surface px-2 outline-none focus:border-accent">
                    <option value="">Code</option>
                    {CODES.map(([c, l]) => <option key={c} value={c}>{c} {l}</option>)}
                  </select>
                </>
              )}
              <label htmlFor="lead-input" className="sr-only">{field === "name" ? "Your name" : field === "whatsapp" ? "WhatsApp number" : "Email address"}</label>
              <input id="lead-input" ref={inputRef}
                type={field === "email" ? "email" : field === "whatsapp" ? "tel" : "text"}
                inputMode={field === "whatsapp" ? "tel" : field === "email" ? "email" : "text"}
                autoComplete={field === "name" ? "name" : field === "whatsapp" ? "tel-national" : "email"}
                maxLength={field === "email" ? 254 : field === "whatsapp" ? 20 : 80}
                placeholder={field === "name" ? "Your name" : field === "whatsapp" ? "WhatsApp number" : "Email address"}
                value={field === "name" ? vals.name : field === "whatsapp" ? vals.local : vals.email}
                onChange={(e) => { const v = e.target.value; setFieldErr(null); setOk(false); setVals((s) => field === "name" ? { ...s, name: v } : field === "whatsapp" ? { ...s, local: v.replace(/[^\d\s().-]/g, "") } : { ...s, email: v }); }}
                aria-invalid={!!fieldErr} aria-describedby="lead-msg"
                className={cn("text-body h-12 min-w-0 flex-1 rounded-[14px] border bg-surface px-4 outline-none transition-colors focus:border-accent", fieldErr ? "border-destructive" : ok ? "border-accent" : "border-border")} />
            </div>
            <p id="lead-msg" role={fieldErr || error ? "alert" : undefined} className={cn("text-caption mt-2 min-h-5", fieldErr || error ? "text-destructive" : "text-accent")}>
              {fieldErr ?? error ?? (ok ? <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> Looks good</span> : null)}
            </p>
          </form>
        )}
        {!typing && scene === "done" && (
          <div className="flex flex-col items-center py-6 text-center animate-in fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="size-5" /></span>
            <p className="text-h4 mt-3 font-semibold">{busy ? "Saving…" : settings.completion}</p>
          </div>
        )}
      </div>

      <div className="relative border-t border-border bg-background px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {scene === "welcome" && (
          <>
            <button type="button" onClick={() => { onTrack("lead_started"); if (steps[0]) go(steps[0]); else void finish(); }}
              className="text-small flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent font-medium text-accent-foreground transition-colors hover:bg-accent/90">
              Start <ArrowRight className="size-4" />
            </button>
            <p className="text-caption mt-2.5 text-center text-muted-foreground">
              {settings.privacy}{settings.privacyUrl && <> <a href={settings.privacyUrl} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a></>}
            </p>
          </>
        )}
        {field && !typing && (
          <button type="submit" form="lead-step" disabled={busy}
            className="text-small flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50">
            {field === steps[steps.length - 1] ? "Enter Branta Assistant" : "Continue"} <ArrowRight className="size-4" />
          </button>
        )}
        {(typing || scene === "done") && <div className="h-12" />}
      </div>
    </div>
  );
}

function TDot({ d = "0ms" }: { d?: string }) {
  return <span className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-pulse" style={{ animationDelay: d }} />;
}
