import { useEffect, useRef, useState } from "react";
import { DarkSection, Eyebrow, Section, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import { SmartLink } from "@/components/layout/SiteHeader";
import type { HomeClosing } from "@/lib/home-closing.functions";
import { cn } from "@/lib/utils";

type P<K extends keyof HomeClosing> = { content: NonNullable<HomeClosing[K]> };

/* ---------- Process: sticky title left, steps progress vertically ---------- */
export function ProcessSection({ content }: P<"process">) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const [seen, setSeen] = useState(-1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(content.steps.length); return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setSeen((s) => Math.max(s, Number((e.target as HTMLElement).dataset["i"])));
    }, { rootMargin: "0px 0px -35% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, [content.steps.length]);

  return (
    <Section aria-labelledby="process-title">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>{content.eyebrow || "HOW WE WORK"}</Eyebrow>
            <h2 id="process-title" className="text-display mt-4 text-foreground">{content.title}</h2>
            {content.body && <p className="text-body-lg mt-6 max-w-md text-muted-foreground">{content.body}</p>}
          </div>
        </div>
        <ol className="relative lg:col-span-7">
          {content.steps.map((s, i) => (
            <li
              key={i}
              data-i={i}
              ref={(el) => { refs.current[i] = el; }}
              className="relative grid grid-cols-[3.5rem_1fr] gap-4 border-t border-border py-8 md:grid-cols-[6rem_1fr] md:py-12"
            >
              <span aria-hidden className={cn("absolute left-0 top-[-1px] h-px bg-accent transition-[width] duration-1000 ease-out motion-reduce:transition-none", i <= seen ? "w-full" : "w-0")} />
              <span className={cn("text-h3 font-mono transition-colors duration-700", i <= seen ? "text-accent" : "text-muted-foreground")}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-h2 uppercase text-foreground">{s.title}</h3>
                {s.body && <p className="text-body mt-3 max-w-lg text-muted-foreground">{s.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

/* ---------- Clients: monochrome logo wall ---------- */
export function ClientLogos({ content }: P<"clients">) {
  return (
    <Section tone="white" aria-labelledby="clients-title">
      <Eyebrow>{content.eyebrow || "SELECTED CLIENTS"}</Eyebrow>
      <h2 id="clients-title" className="text-h1 mt-4 max-w-2xl text-foreground">{content.title}</h2>
      <ul className="mt-12 grid grid-cols-2 border-l border-t border-border sm:grid-cols-3 lg:grid-cols-5">
        {content.logos.map((l, i) => {
          const img = (
            <img src={l.logo_url} alt={l.alt || l.client_name} loading="lazy" decoding="async"
              className="max-h-10 w-auto max-w-[70%] object-contain opacity-70 grayscale transition-opacity duration-300 group-hover:opacity-100 md:max-h-12" />
          );
          return (
            <li key={i} className="border-b border-r border-border">
              {/^https:\/\//.test(l.client_url)
                ? <a href={l.client_url} target="_blank" rel="noreferrer" className="group flex aspect-[3/2] items-center justify-center focus-visible:outline-2 focus-visible:outline-accent">{img}</a>
                : <div className="group flex aspect-[3/2] items-center justify-center">{img}</div>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ---------- Insights teaser (no posts system yet → honest empty state) ---------- */
export function InsightsTeaser({ content }: P<"insights">) {
  return (
    <DarkSection aria-labelledby="insights-title">
      <div className="grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <Eyebrow>{content.eyebrow || "INSIGHTS"}</Eyebrow>
          <h2 id="insights-title" className="text-h1 mt-4 text-foreground">{content.title}</h2>
        </div>
        <div className="md:col-span-5">
          {content.body && <p className="text-body-lg text-muted-foreground">{content.body}</p>}
          <div className="mt-6"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="secondary" /></div>
        </div>
      </div>
      <div className="mt-12 border-t border-border pt-8">
        <p className="text-small text-muted-foreground">The first articles from the Branta team are on the way.</p>
      </div>
    </DarkSection>
  );
}

/* ---------- Careers teaser: real image if set, else typography ---------- */
export function CareersTeaser({ content }: P<"careers">) {
  return (
    <Section tone="muted" aria-labelledby="careers-title">
      <div className={cn("grid gap-10", content.image && "lg:grid-cols-12 lg:items-center")}>
        <div className={cn(content.image ? "lg:col-span-6" : "max-w-4xl")}>
          <Eyebrow>{content.eyebrow || "CAREERS"}</Eyebrow>
          <h2 id="careers-title" className="text-display mt-4 text-foreground">{content.title}</h2>
          {content.body && <p className="text-body-lg mt-6 max-w-xl text-muted-foreground">{content.body}</p>}
          <div className="mt-8"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="primary" /></div>
        </div>
        {content.image && (
          <div className="overflow-hidden rounded-[6px] lg:col-span-6">
            <img src={content.image} alt={content.imageAlt} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- Final CTA ---------- */
export function FinalCta({ content }: P<"finalCta">) {
  return (
    <DarkSection aria-labelledby="final-cta-title" className="border-t border-border">
      <SiteContainer className="px-0">
        <h2 id="final-cta-title" className="text-display-xl whitespace-pre-line text-foreground">
          {content.title}<span aria-hidden className="text-accent">.</span>
        </h2>
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          {content.body && <p className="text-body-lg max-w-md text-muted-foreground">{content.body}</p>}
          <div className="flex flex-wrap gap-3">
            <HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="primary" />
            <HeroAction label={content.secondary.label} url={content.secondary.url} variant="secondary" />
          </div>
        </div>
      </SiteContainer>
    </DarkSection>
  );
}

export { SmartLink };
