import type { HomeClosing } from "@/lib/home-closing.functions";
import type { ClientLogo } from "@/lib/home-closing";
import { Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

type Content = NonNullable<HomeClosing["trust"]>;

function Logo({ l, decorative }: { l: ClientLogo; decorative?: boolean }) {
  const img = (
    <img src={l.logo_url} alt={decorative ? "" : l.alt || l.client_name} loading="lazy" decoding="async"
      className="h-7 w-auto max-w-[150px] object-contain opacity-60 grayscale transition-[opacity,filter] duration-300 hover:opacity-100 hover:grayscale-0 md:h-9 md:max-w-[180px]" />
  );
  return /^https:\/\//.test(l.client_url) && !decorative
    ? <a href={l.client_url} target="_blank" rel="noreferrer" className="shrink-0 focus-visible:outline-2 focus-visible:outline-accent">{img}</a>
    : <span className="shrink-0">{img}</span>;
}

function Row({ logos, reverse }: { logos: ClientLogo[]; reverse?: boolean }) {
  const set = (dup: boolean) => (
    <ul aria-hidden={dup || undefined} className="flex shrink-0 items-center gap-14 pr-14 md:gap-20 md:pr-20">
      {logos.map((l, i) => <li key={i}><Logo l={l} decorative={dup} /></li>)}
    </ul>
  );
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="animate-marquee flex w-max hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${Math.max(30, logos.length * 9)}s`, animationDirection: reverse ? "reverse" : "normal" } as React.CSSProperties}>
        {set(false)}{set(true)}
      </div>
    </div>
  );
}

/** Trust & credibility band right after the Hero: client logos, admin-entered stats, funded-by note. */
export function TrustProof({ content }: { content: Content }) {
  const { logos, stats, fundedBy } = content;
  const twoRows = logos.length >= 8;
  const half = Math.ceil(logos.length / 2);
  return (
    <section aria-labelledby="trust-title" className="border-b border-border bg-background py-16 text-foreground md:py-24">
      {logos.length > 0 && (
        <>
          <SiteContainer>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <Eyebrow id="trust-title">{content.eyebrow || "TRUSTED BY BRANDS"}</Eyebrow>
              {content.body && <p className="text-small text-muted-foreground">{content.body}</p>}
            </div>
          </SiteContainer>
          {/* Moving rows (hidden with reduced motion) */}
          <div className="mt-10 grid gap-10 motion-reduce:hidden md:mt-14 md:gap-12">
            {twoRows ? <><Row logos={logos.slice(0, half)} /><Row logos={logos.slice(half)} reverse /></> : <Row logos={logos} />}
          </div>
          {/* Static grid for reduced motion */}
          <SiteContainer className="hidden motion-reduce:block">
            <ul className="mt-10 flex flex-wrap items-center gap-x-14 gap-y-8">
              {logos.map((l, i) => <li key={i}><Logo l={l} /></li>)}
            </ul>
          </SiteContainer>
        </>
      )}
      {(stats.length > 0 || fundedBy) && (
        <SiteContainer>
          <Reveal className={cn("grid border-t border-border", logos.length > 0 && "mt-14 md:mt-20", stats.length > 0 && fundedBy ? "md:grid-cols-12" : "")}>
            {stats.length > 0 && (
              <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-8 pt-10", fundedBy && "md:col-span-8", stats.length > 2 && "sm:grid-cols-3")}>
                {stats.map((s, i) => (
                  <div key={i} className="flex min-w-0 flex-col-reverse">
                    <dt className="text-eyebrow mt-3 text-muted-foreground">{s.label}</dt>
                    <dd className="text-display font-semibold leading-none tracking-tight">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {fundedBy && (
              <div className={cn("pt-10", stats.length > 0 && "mt-10 border-t border-border md:col-span-4 md:mt-0 md:border-l md:border-t-0 md:pl-10")}>
                <p className="text-eyebrow text-muted-foreground">{fundedBy.label}</p>
                <div className="mt-4 flex items-center gap-4">
                  {fundedBy.logo_url && <img src={fundedBy.logo_url} alt={`${fundedBy.name} logo`} loading="lazy" className="h-12 w-auto max-w-[120px] object-contain" />}
                  {fundedBy.url
                    ? <a href={fundedBy.url} target="_blank" rel="noreferrer" className="text-h3 font-medium underline-offset-4 hover:underline">{fundedBy.name}</a>
                    : <p className="text-h3 font-medium">{fundedBy.name}</p>}
                </div>
                {fundedBy.body && <p className="text-small mt-3 max-w-sm text-muted-foreground">{fundedBy.body}</p>}
              </div>
            )}
          </Reveal>
        </SiteContainer>
      )}
    </section>
  );
}
