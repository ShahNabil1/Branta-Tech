import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteContainer } from "./primitives";
import { SiteHeader, SmartLink } from "./SiteHeader";
import { FALLBACK_FOOTER, footerFromCms, siteChromeQuery } from "@/lib/navigation";

const SOCIAL: { key: "facebook" | "instagram" | "linkedin" | "youtube" | "x"; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "X" },
];
const https = (v: unknown) => (typeof v === "string" && /^https:\/\/\S+$/.test(v.trim()) ? v.trim() : null);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const link = (v: unknown, d: string) => {
  const t = text(v);
  return t && (t.startsWith("/") || /^https:\/\//.test(t)) ? t : d;
};
const flinkCls = "text-small text-foreground/70 transition-colors duration-300 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";
const fpendingCls = "text-small cursor-default text-foreground/35";

function SiteFooter() {
  const { data } = useQuery(siteChromeQuery);
  const ft = (data?.footer ?? {}) as Record<string, unknown>;
  const cols = footerFromCms(data?.navigation) ?? FALLBACK_FOOTER;
  const name = text(data?.company?.company_name) ?? "Branta Tech";
  const tagline = text(data?.company?.short_description) ?? "Creative. AI. Technology.";
  const desc = text(ft.footer_tagline) ?? "AI-powered creative, software and automation for ambitious brands.";
  const email = text(data?.contact?.email) ?? "hello@brantatech.com";
  const phone = text(data?.contact?.phone);
  const address = text(data?.contact?.address);
  const socials = SOCIAL.map((s) => ({ ...s, url: https(data?.social?.[s.key]) })).filter((s) => s.url);
  const eyebrow = text(ft.cta_eyebrow) ?? "Let’s build together";
  const heading = text(ft.cta_heading) ?? "Let’s create something that moves your brand forward.";
  const ctas = [
    { label: text(ft.primary_label) ?? "Book a Call", url: link(ft.primary_url, "/book-a-call") },
    { label: text(ft.secondary_label) ?? "Explore Careers", url: link(ft.secondary_url, "/careers") },
  ];
  const legal = [
    { label: text(ft.privacy_label) ?? "Privacy Policy", url: link(ft.privacy_url, "/privacy") },
    { label: text(ft.terms_label) ?? "Terms", url: link(ft.terms_url, "/terms") },
  ];
  const copyright = text(ft.copyright_text) ?? `© ${new Date().getFullYear()} ${name}. All rights reserved.`;
  const showMark = text(ft.show_wordmark) !== "off";
  const mark = text(ft.wordmark_text) ?? "Branta";
  const tint = text(ft.tone) === "tint";

  return (
    <footer className={tint ? "footer-tint text-foreground" : "bg-[var(--warm-white,#F7F7F5)] text-foreground"}>
      <SiteContainer wide className="pt-20 md:pt-28">
        {/* CTA band */}
        <div className="grid gap-10 border-b border-border pb-16 md:pb-24 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="text-eyebrow flex items-center gap-2 text-foreground/60"><span aria-hidden className="size-1.5 rounded-full bg-accent" />{eyebrow}</p>
            <h2 className="text-display mt-6 max-w-[18ch] font-medium tracking-tight">{heading}</h2>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4 lg:col-span-4 lg:justify-end">
            {ctas.map((c) => (
              <SmartLink key={c.label} url={c.url} className="footer-cta group text-h4 inline-flex items-center gap-2 pb-1 font-medium" pendingClassName="text-h4 cursor-default text-foreground/35">
                {c.label}<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </SmartLink>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="grid gap-12 py-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-h4 font-medium">{tagline}</p>
            <p className="text-body mt-4 max-w-xs text-foreground/65">{desc}</p>
            <address className="text-small mt-8 grid gap-2 not-italic">
              <a href={`mailto:${email}`} className={flinkCls}>{email}</a>
              {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={flinkCls}>{phone}</a>}
              {address && <span className="whitespace-pre-line text-foreground/60">{address}</span>}
            </address>
            {socials.length > 0 && (
              <ul aria-label="Social media" className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {socials.map((s) => <li key={s.key}><a href={s.url!} target="_blank" rel="noreferrer" className={flinkCls}>{s.label}</a></li>)}
              </ul>
            )}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="text-eyebrow text-foreground">{c.title}</p>
                <ul className="mt-5 grid gap-3">
                  {c.links.map((l) => <li key={l.label}><SmartLink url={l.url} className={flinkCls} pendingClassName={fpendingCls}>{l.label}</SmartLink></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-border py-8 md:flex-row md:items-center md:justify-between">
          <p className="text-caption text-foreground/55">{copyright}</p>
          <div className="flex gap-6">
            {legal.map((l) => <SmartLink key={l.label} url={l.url} className="text-caption text-foreground/70 hover:text-accent" pendingClassName="text-caption cursor-default text-foreground/35">{l.label}</SmartLink>)}
          </div>
        </div>
      </SiteContainer>
      {showMark && (
        <div aria-hidden className="overflow-hidden">
          <p className="footer-wordmark select-none text-center font-semibold leading-[0.78] tracking-[-0.06em] text-foreground">{mark}</p>
        </div>
      )}
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
