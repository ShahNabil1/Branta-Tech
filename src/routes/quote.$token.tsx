import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import logo from "@/assets/brand/branta-logo-light.png.asset.json";
import { buttonVariants } from "@/components/ui/brand-button";
import { getCustomerQuote, respondToQuote, type CustomerQuote } from "@/lib/quotes.functions";
import { cn } from "@/lib/utils";
import { downloadQuotePdf } from "@/lib/pricing/quote-pdf";

export const Route = createFileRoute("/quote/$token")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Your quotation | Branta Tech" }, { name: "description", content: "Review your Branta Tech quotation." },
    { property: "og:title", content: "Your quotation | Branta Tech" }, { property: "og:description", content: "Review your Branta Tech quotation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" },
  ] }),
  component: QuotePage,
});

const money = (m: number, c: string) => `${c === "BDT" ? "৳" : `${c} `}${(m / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function QuotePage() {
  const { token } = Route.useParams();
  const get = useServerFn(getCustomerQuote);
  const q = useQuery({ queryKey: ["customer-quote", token], queryFn: () => get({ data: { token } }), retry: false });
  return (
    <main className="min-h-screen bg-[var(--warm)] px-4 py-10 text-foreground sm:py-16">
      <div className="mx-auto max-w-3xl">
        <img src={logo.url} alt="Branta Tech" className="h-7 w-auto" />
        {q.isLoading ? <p className="text-small mt-10 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading your quote…</p>
          : !q.data || !q.data.ok ? <Unavailable superseded={q.data?.ok === false && q.data.reason === "superseded"} />
          : <QuoteView d={q.data} token={token} onDone={() => void q.refetch()} />}
      </div>
    </main>
  );
}

function Unavailable({ superseded }: { superseded: boolean }) {
  return (
    <div className="mt-10 rounded-[8px] border border-border bg-[var(--white)] p-8">
      <h1 className="text-h3">{superseded ? "This quote has been updated." : "This quote link isn't available."}</h1>
      <p className="text-body mt-3 text-muted-foreground">{superseded ? "A newer version was issued. Please use the latest link our team sent you." : "The link may be incorrect, expired or revoked. Please contact our team for a new link."}</p>
      <Link to="/book-a-call" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6")}>Book a Call</Link>
    </div>
  );
}

function QuoteView({ d, token, onDone }: { d: Extract<CustomerQuote, { ok: true }>; token: string; onDone: () => void }) {
  const respond = useServerFn(respondToQuote);
  const [mode, setMode] = useState<null | "accepted" | "declined" | "changes_requested">(null);
  const [note, setNote] = useState(""); const [name, setName] = useState(""); const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const c = d.currency;
  async function send() {
    if (!mode) return;
    setBusy(true); setErr(null);
    const r = await respond({ data: { token, action: mode, note, name, termsAccepted: terms } }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onDone();
  }
  const Block = ({ t, v }: { t: string; v: string | null }) => v ? <div><h3 className="text-eyebrow text-muted-foreground">{t}</h3><p className="text-small mt-2 whitespace-pre-line">{v}</p></div> : null;
  const field = "text-small w-full rounded-[6px] border border-border bg-[var(--white)] px-3 py-2 outline-none focus:border-foreground";
  return (
    <article className="mt-8 rounded-[8px] border border-border bg-[var(--white)] p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-eyebrow text-accent">QUOTATION</p>
          <h1 className="text-h2 mt-2 font-mono">{d.reference}</h1>
          <p className="text-small mt-1 text-muted-foreground">Version {d.version} · Issued {new Date(d.issuedAt).toLocaleDateString()}{d.validUntil ? ` · Valid until ${d.validUntil}` : ""}</p>
        </div>
        <div className="text-small text-right">
          <p className="font-medium">{d.company.name}</p>
          {d.company.email && <p className="text-muted-foreground">{d.company.email}</p>}
          {d.company.phone && <p className="text-muted-foreground">{d.company.phone}</p>}
        </div>
      </header>
      <section className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
        <div><h2 className="text-eyebrow text-muted-foreground">PREPARED FOR</h2><p className="text-small mt-2 font-medium">{d.customer.name}</p>{d.customer.company && <p className="text-small text-muted-foreground">{d.customer.company}</p>}<p className="text-small text-muted-foreground">{d.customer.email}</p></div>
        {d.photo && <div><h2 className="text-eyebrow text-muted-foreground">PHOTOGRAPHY</h2><p className="text-small mt-2">{d.photo.item}{d.photo.products ? ` · ${d.photo.products} product${d.photo.products > 1 ? "s" : ""} · ${d.photo.totalImages} images` : ""}{d.photo.workflow ? ` · ${d.photo.workflow}` : ""}</p>{d.photo.views.length > 0 && <p className="text-caption mt-1 text-muted-foreground">Views: {d.photo.views.join(", ")}</p>}{d.photo.addons.length > 0 && <p className="text-caption mt-1 text-muted-foreground">Includes: {d.photo.addons.join(", ")}</p>}</div>}
        {d.production.videoType && <div><h2 className="text-eyebrow text-muted-foreground">PRODUCTION</h2><p className="text-small mt-2">{d.production.videoType} · {d.production.model} · {d.production.durationSeconds}s · {d.production.tier}</p>{d.production.addons.length > 0 && <p className="text-caption mt-1 text-muted-foreground">Includes: {d.production.addons.join(", ")}</p>}</div>}
      </section>
      <section className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
        <Block t="SCOPE" v={d.scope} /><Block t="DELIVERABLES" v={d.deliverables} />
        <Block t="TIMELINE" v={d.timeline} /><Block t="REVISIONS" v={d.revisions != null ? `${d.revisions} revision round${d.revisions === 1 ? "" : "s"}` : null} />
      </section>
      <section className="border-b border-border py-6">
        <h2 className="text-eyebrow text-muted-foreground">PRICE</h2>
        <table className="mt-3 w-full text-left">
          <tbody className="divide-y divide-border">
            {d.lines.map((l, i) => <tr key={i}><td className="text-small py-2 pr-4">{l.label}{l.quantity !== 1 && <span className="text-muted-foreground"> × {l.quantity}</span>}</td><td className="text-small py-2 text-right tabular-nums">{money(l.amount_minor, c)}</td></tr>)}
          </tbody>
        </table>
        <dl className="text-small mt-4 grid gap-1 tabular-nums">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(d.subtotal, c)}</dd></div>
          {d.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {money(d.discount, c)}</dd></div>}
          {d.tax && <div className="flex justify-between"><dt className="text-muted-foreground">{d.tax.label} {d.tax.percentage}%{d.tax.inclusive ? " (included)" : ""}</dt><dd>{money(d.tax.amount, c)}</dd></div>}
          <div className="text-h3 mt-2 flex justify-between border-t border-border pt-3 font-medium"><dt>Total</dt><dd>{money(d.total, c)}</dd></div>
        </dl>
      </section>
      <section className="grid gap-6 py-6 sm:grid-cols-2"><Block t="PAYMENT TERMS" v={d.paymentTerms} /><Block t="NOTES" v={d.notes} /></section>

      <footer className="border-t border-border pt-6">
        {d.response ? (
          <p className="text-body rounded-[6px] border border-accent/40 bg-accent/5 p-4">
            {d.response.kind === "accepted" ? "You accepted this quote" : d.response.kind === "declined" ? "You declined this quote" : "You requested changes"} on {new Date(d.response.at).toLocaleString()}. Our team will follow up.
          </p>
        ) : d.expired ? (
          <p className="text-body text-muted-foreground">This quote has expired. Please contact us for an updated quote.</p>
        ) : (
          <div className="grid gap-4">
            <p className="text-caption text-muted-foreground">Accepting confirms you agree to this scope and price. It does not create an invoice or start production; our team will confirm next steps with you.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode("accepted")} className={buttonVariants({ variant: mode === "accepted" ? "primary" : "secondary", size: "lg" })}>Accept Quote</button>
              <button type="button" onClick={() => setMode("changes_requested")} className={buttonVariants({ variant: "secondary", size: "lg" })}>Request Changes</button>
              <button type="button" onClick={() => setMode("declined")} className={buttonVariants({ variant: "secondary", size: "lg" })}>Decline</button>
            </div>
            {mode && (
              <div className="grid gap-3 rounded-[6px] border border-border p-4">
                {mode === "accepted" && <>
                  <label className="text-small">Type your full name to confirm<input value={name} onChange={(e) => setName(e.target.value)} className={cn(field, "mt-1 h-11")} /></label>
                  <label className="text-small flex items-start gap-2"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />I accept version {d.version} of this quotation, including its scope, price and payment terms.</label>
                </>}
                <label className="text-small">{mode === "changes_requested" ? "What would you like changed?" : "Message (optional)"}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={cn(field, "mt-1")} /></label>
                {err && <p role="alert" className="text-small text-destructive">{err}</p>}
                <button type="button" disabled={busy} onClick={() => void send()} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "justify-center")}>
                  {busy ? "Sending…" : mode === "accepted" ? "Confirm acceptance" : mode === "declined" ? "Confirm decline" : "Send change request"}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/book-a-call" search={{ quote: d.booking.quote, group: d.booking.group ?? undefined, service: d.booking.service ?? undefined, type: d.booking.type ?? undefined }} className={buttonVariants({ variant: "secondary", size: "md" })}>Book a Call</Link>
          <button type="button" onClick={() => void downloadQuotePdf(d).catch(() => setErr("We couldn't create the PDF. Please try again."))} className={buttonVariants({ variant: "secondary", size: "md" })}>Download PDF</button>
        </div>
      </footer>
    </article>
  );
}
