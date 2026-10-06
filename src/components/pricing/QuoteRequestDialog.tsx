import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/brand-button";
import { SmartLink } from "@/components/layout/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { getQuotePrefill, submitQuoteRequest, trackPricingEvent, type QuoteSubmitResult } from "@/lib/quotes.functions";
import { cn } from "@/lib/utils";

export type QuoteSelection = { videoTypeId: string; modelId: string; tierId: string; durationSeconds: number; addons: { id: string; scenes?: number }[] };
type Summary = { videoType: string; model: string; duration: number; tier: string; addons: string[] } | null;

const field = "text-small h-11 w-full rounded-[6px] border border-border bg-[var(--white)] px-3 text-foreground outline-none transition-colors focus:border-foreground";
const money = (minor: number, cur: string) => `${cur === "BDT" ? "৳" : `${cur} `}${(minor / 100).toLocaleString("en-IN")}`;

export type PhotoSelection = {
  mode: "individual" | "package"; categoryId?: string; packageId?: string; workflow: string; products: number;
  imagesPerProduct?: number; viewIds?: string[]; background?: string; modelRequired?: boolean; specs?: string; addons?: { id: string }[];
};

export function QuoteRequestDialog({ open, onOpenChange, selection, summary, category = "video", photoSelection = null, summaryText }: {
  open: boolean; onOpenChange: (v: boolean) => void; selection: QuoteSelection | null; summary: Summary;
  category?: "video" | "photography"; photoSelection?: PhotoSelection | null; summaryText?: string;
}) {
  const submit = useServerFn(submitQuoteRequest);
  const prefill = useServerFn(getQuotePrefill);
  const track = useServerFn(trackPricingEvent);
  const chatToken = useRef<string | null>(null);
  const started = useRef(Date.now());
  const [v, setV] = useState({ name: "", whatsapp: "", email: "", company: "", description: "", deadline: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Extract<QuoteSubmitResult, { ok: true }> | null>(null);

  useEffect(() => {
    if (!open) return;
    started.current = Date.now();
    void track({ data: { event: "quote_modal_open" } }).catch(() => null);
    // Branta Assistant visitors: the server returns details only for this browser's own verified chat session.
    chatToken.current = localStorage.getItem("branta_chat_token");
    if (chatToken.current && chatToken.current.length >= 20) {
      void prefill({ data: { chatToken: chatToken.current } }).then((p) => {
        if (p) setV((o) => ({ ...o, name: o.name || p.name, whatsapp: o.whatsapp || p.whatsapp, email: o.email || p.email }));
      }).catch(() => null);
    }
    // Signed-in visitors: prefill from their own verified account + profile (editable).
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name,phone,company").eq("id", data.user.id).maybeSingle();
      setV((o) => ({ ...o, name: o.name || p?.full_name || "", email: o.email || data.user!.email || "", whatsapp: o.whatsapp || p?.phone || "", company: o.company || p?.company || "" }));
    })();
  }, [open]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((o) => ({ ...o, [k]: e.target.value }));
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const hp = (new FormData(e.currentTarget).get("hp_field") as string) ?? "";
    setBusy(true); setError(null); setErrs({});
    try {
      const r = await submit({ data: { ...v, hp_field: hp, started_at: started.current, selection: category === "video" ? selection : null, category, photoSelection: category === "photography" ? photoSelection : null, chatToken: chatToken.current } });
      if (r.ok) setDone(r); else { setError(r.error); setErrs(r.fields ?? {}); }
    } catch { setError("We couldn't send your request. Please try again."); }
    setBusy(false);
  }
  const close = (o: boolean) => { onOpenChange(o); if (!o && done) { setDone(null); started.current = Date.now(); } };

  const F = ({ k, label, req, type = "text", auto }: { k: keyof typeof v; label: string; req?: boolean; type?: string; auto?: string }) => (
    <label className="block">
      <span className="text-small mb-1.5 block font-medium text-foreground">{label}{req ? <span className="text-accent"> *</span> : <span className="text-muted-foreground"> (optional)</span>}</span>
      <input type={type} value={v[k]} onChange={set(k)} required={req} autoComplete={auto} aria-invalid={!!errs[k]} className={cn(field, errs[k] && "border-destructive")} />
      {errs[k] && <span className="text-caption mt-1 block text-destructive">{errs[k]}</span>}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-[var(--warm)] sm:max-w-lg data-[state=open]:duration-200 motion-reduce:data-[state=open]:animate-none">
        {done ? (
          <div className="py-2 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="size-6" /></span>
            <DialogTitle className="text-h3 mt-5 text-foreground">Your Quote Request Is In.</DialogTitle>
            <DialogDescription className="text-body mt-3 text-muted-foreground">Our team will review your requirements and get back to you.</DialogDescription>
            <dl className="text-small mx-auto mt-6 grid max-w-sm gap-2 rounded-[6px] border border-border bg-[var(--white)] p-4 text-left">
              <Row k="Reference" val={done.reference} />
              {done.videoType && <Row k={category === "photography" ? "Photography" : "Video type"} val={done.videoType} />}
              {done.durationSeconds && <Row k="Duration" val={`${done.durationSeconds} sec`} />}
              {done.model && <Row k={category === "photography" ? "Image workflow" : "AI model"} val={done.model} />}
              {done.estimate && <Row k="Estimate" val={`${money(done.estimate.total, done.estimate.currency)} (to be confirmed)`} />}
              <Row k="Status" val={done.status === "new" ? "Received — awaiting review" : "Custom quote requested"} />
            </dl>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link to="/book-a-call" search={{ quote: done.booking.quote, group: done.booking.group ?? undefined, service: done.booking.service ?? undefined, type: done.booking.type ?? undefined }} className={buttonVariants({ variant: "primary", size: "lg" })}>Book a Call</Link>
              <button type="button" onClick={() => close(false)} className={buttonVariants({ variant: "secondary", size: "lg" })}>Back to Pricing</button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} noValidate>
            <DialogTitle className="text-h3 text-foreground">{selection || photoSelection ? "Request this quote" : "Request a custom quote"}</DialogTitle>
            <DialogDescription className="text-small mt-2 text-muted-foreground">
              {summaryText ? summaryText : summary ? `${summary.videoType} · ${summary.model} · ${summary.duration}s · ${summary.tier}${summary.addons.length ? ` · ${summary.addons.length} add-on${summary.addons.length > 1 ? "s" : ""}` : ""}` : "Tell us about your project and we'll prepare a quote."}
            </DialogDescription>
            <div className="mt-6 grid gap-4">
              {F({k: "name",  label: "Full name",  req: true, auto: "name"})}
              <div className="grid gap-4 sm:grid-cols-2">
                {F({k: "whatsapp",  label: "WhatsApp number",  req: true, type: "tel",  auto: "tel"})}
                {F({k: "email",  label: "Email",  req: true, type: "email",  auto: "email"})}
              </div>
              {F({ k: "company", label: "Company / brand", auto: "organization" })}
              <label className="block">
                <span className="text-small mb-1.5 block font-medium text-foreground">Project description <span className="text-muted-foreground">(optional)</span></span>
                <textarea rows={3} value={v.description} onChange={set("description")} className={cn(field, "h-auto py-2")} />
              </label>
              {F({k: "deadline",  label: "Preferred deadline",  type: "date"})}
              <input type="text" name="hp_field" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            </div>
            <p className="text-caption mt-5 text-muted-foreground">We'll use your details only to respond to this enquiry. See our <SmartLink url="/privacy" className="underline underline-offset-2">Privacy Policy</SmartLink>.</p>
            {error && <p role="alert" className="text-small mt-4 rounded-[6px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">{error}</p>}
            <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6 w-full justify-center")}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}{busy ? "Sending…" : "Send quote request"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, val }: { k: string; val: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium text-foreground">{val}</dd></div>;
}
