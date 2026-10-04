import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteContainer } from "./primitives";
import { SiteHeader, BrandLogo, SmartLink } from "./SiteHeader";
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
const linkCls = "text-small text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent";
const pendingCls = "text-small cursor-default text-muted-foreground/45";

function SiteFooter() {
  const { data } = useQuery(siteChromeQuery);
  const cols = footerFromCms(data?.navigation) ?? FALLBACK_FOOTER;
  const logo = https(data?.brand?.logo_url);
  const name = text(data?.company?.company_name) ?? "Branta Tech";
  const desc = text(data?.company?.short_description) ?? "Creative. AI. Technology.";
  const email = text(data?.contact?.email);
  const phone = text(data?.contact?.phone);
  const address = text(data?.contact?.address);
  const socials = SOCIAL.map((s) => ({ ...s, url: https(data?.social?.[s.key]) })).filter((s) => s.url);

  return (
    <footer className="footer-glow border-t border-border bg-background text-foreground">
      <SiteContainer wide className="py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <BrandLogo src={logo} />
            <p className="text-body mt-5 max-w-xs text-muted-foreground">{desc}</p>
            {(email || phone || address) && (
              <address className="text-small mt-8 grid gap-2 not-italic text-muted-foreground">
                {email && <a href={`mailto:${email}`} className={linkCls}>{email}</a>}
                {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={linkCls}>{phone}</a>}
                {address && <span className="whitespace-pre-line">{address}</span>}
              </address>
            )}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="text-eyebrow text-foreground">{c.title}</p>
                <ul className="mt-5 grid gap-3">
                  {c.links.map((l) => (
                    <li key={l.label}><SmartLink url={l.url} className={linkCls} pendingClassName={pendingCls}>{l.label}</SmartLink></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-caption text-muted-foreground">© {new Date().getFullYear()} {name}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {socials.length > 0 && (
              <ul aria-label="Social media" className="flex flex-wrap gap-x-5 gap-y-2">
                {socials.map((s) => (
                  <li key={s.key}><a href={s.url!} target="_blank" rel="noreferrer" className="text-caption text-muted-foreground hover:text-foreground">{s.label}</a></li>
                ))}
              </ul>
            )}
            <SmartLink url="/privacy" className="text-caption text-muted-foreground hover:text-foreground" pendingClassName="text-caption cursor-default text-muted-foreground/45">Privacy</SmartLink>
            <SmartLink url="/terms" className="text-caption text-muted-foreground hover:text-foreground" pendingClassName="text-caption cursor-default text-muted-foreground/45">Terms</SmartLink>
          </div>
        </div>
      </SiteContainer>
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
