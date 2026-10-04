import { PostTile } from "@/components/content/PostCards";
import { useEffect, useRef, useState } from "react";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import type { HomeClosing } from "@/lib/home-closing.functions";
import { cn } from "@/lib/utils";
import { SectionMedia } from "@/components/media/SectionMedia";

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
    <Section tone="white" aria-labelledby="process-title">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>{content.eyebrow || "HOW WE WORK"}</Eyebrow>
            <h2 id="process-title" className="text-display mt-4 text-foreground">{content.title}</h2>
            {content.body && <p className="text-body-lg mt-6 max-w-md text-muted-foreground">{content.body}</p>}
            {content.media && <SectionMedia item={content.media} className="mt-10 hidden max-w-md rounded-[6px] lg:block" />}
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
    <Section tone="muted" aria-labelledby="clients-title">
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
    <Section tone="white" aria-labelledby="insights-title">
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
      {content.posts.length ? (
        <div className="mt-12 grid gap-10 md:grid-cols-3">{content.posts.map((p) => <PostTile key={p.slug} p={p} />)}</div>
      ) : (
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-small text-muted-foreground">The first articles from the Branta team are on the way.</p>
        </div>
      )}
    </Section>
  );
}

/* ---------- Careers teaser: real image if set, else typography ---------- */
export function CareersTeaser({ content }: P<"careers">) {
  return (
    <Section tone="dark" aria-labelledby="careers-title" className="glow-soft">
      <div className={cn("grid gap-10", content.media && "lg:grid-cols-12 lg:items-center")}>
        <div className={cn(content.media ? "lg:col-span-6" : "max-w-4xl")}>
          <Eyebrow>{content.eyebrow || "CAREERS"}</Eyebrow>
          <h2 id="careers-title" className="text-display mt-4 text-foreground">{content.title}</h2>
          {content.body && <p className="text-body-lg mt-6 max-w-xl text-muted-foreground">{content.body}</p>}
          <div className="mt-8"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="primary" /></div>
        </div>
        {content.media && (
          <div className="lg:col-span-6">
            <SectionMedia item={content.media} className="rounded-[6px]" />
            {content.media.caption && <p className="text-caption mt-3 text-muted-foreground">{content.media.caption}</p>}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- Final CTA ---------- */
export function FinalCta({ content }: P<"finalCta">) {
  return (
    <DarkSection aria-labelledby="final-cta-title" className="hero-glow relative isolate overflow-hidden border-t border-border">
      {content.background && (
        <div aria-hidden className="absolute inset-0 -z-10">
          <SectionMedia item={content.background} fill decorative />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/60" />
        </div>
      )}
      <div className="relative">
        <span aria-hidden className="mb-8 block h-1 w-12 bg-accent" />
        <h2 id="final-cta-title" className="text-display-xl whitespace-pre-line text-foreground">{content.title}</h2>
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          {content.body && <p className="text-body-lg max-w-md text-muted-foreground">{content.body}</p>}
          <div className="flex flex-wrap gap-3">
            <HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="primary" />
            <HeroAction label={content.secondary.label} url={content.secondary.url} variant="secondary" />
          </div>
        </div>
      </div>
    </DarkSection>
  );
}
