import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/brand-button";
import { useState } from "react";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import { PhotoCalculator } from "@/components/pricing/PhotoCalculator";
import { publicPhotoPricingQuery } from "@/lib/pricing-photo.functions";
import { PricingSection } from "@/components/home/HomeEngage";
import { PortfolioCard } from "@/components/work/PortfolioCard";
import { siteChromeQuery } from "@/lib/navigation";
import { homeClosingQuery } from "@/lib/home-closing.functions";
import { pricingContentQuery, publicPricingQuery } from "@/lib/pricing-page.functions";
import { canonical, pageMeta } from "@/lib/seo";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

const TITLE = "AI Video & Product Photography Pricing | Branta Tech";
const DESC = "Configure an AI video or an AI product photoshoot and get an instant estimate from Branta Tech, or ask us for a custom quote.";

export const Route = createFileRoute("/pricing")({
  head: () => ({ links: canonical("/pricing"), meta: pageMeta({ title: TITLE, description: DESC }) }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(siteChromeQuery),
    context.queryClient.ensureQueryData(publicPricingQuery),
    context.queryClient.ensureQueryData(publicPhotoPricingQuery),
    context.queryClient.ensureQueryData(pricingContentQuery),
    context.queryClient.ensureQueryData(homeClosingQuery),
  ]),
  errorComponent: () => <p className="p-8">Something went wrong loading pricing.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: PricingPage,
});

const CATEGORIES = [
  { id: "video" as const, title: "AI Video Production", body: "Commercials, motion graphics, AI UGC, product videos, OVC, TVC and cinematic production." },
  { id: "photography" as const, title: "AI Product Photography", body: "E-commerce product photos, fashion, AI models, lifestyle visuals and campaign photography." },
];

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={cn("reveal", className)}>{children}</div>;
}

function PricingPage() {
  const { data: pricing } = useSuspenseQuery(publicPricingQuery);
  const { data: content } = useSuspenseQuery(pricingContentQuery);
  const { data: home } = useSuspenseQuery(homeClosingQuery);
  const { data: photo } = useSuspenseQuery(publicPhotoPricingQuery);
  const [category, setCategory] = useState<"video" | "photography">("video");
  const scrollToCalc = () => document.getElementById("calculator")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="pricing-hero" className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_85%_0%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_70%)]" />
        <Eyebrow>AI VIDEO & PHOTOGRAPHY PRICING</Eyebrow>
        <h1 id="pricing-hero" className="text-display-xl mt-6 max-w-[14ch] text-foreground">Create More.<br />Know Your Cost.</h1>
        <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">From motion ads and cinematic commercials to e-commerce and fashion product photos — configure your project and receive an instant estimate.</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={scrollToCalc} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}>
            Calculate Your Price<span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-y-0.5">↓</span>
          </button>
          <Link to="/book-a-call" className={buttonVariants({ variant: "secondary", size: "lg" })}>Book a Call</Link>
        </div>
      </Section>

      <Section tone="warm" id="calculator" aria-labelledby="calc-title" className="scroll-mt-16">
        <div className="mb-10 max-w-2xl">
          <Eyebrow>PRICE CALCULATOR</Eyebrow>
          <h2 id="calc-title" className="text-h1 mt-4 text-foreground">Configure your production.</h2>
        </div>
        <div role="tablist" aria-label="Pricing category" className="mb-10 grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} aria-controls="calc-panel" onClick={() => setCategory(c.id)}
                className={cn("rounded-[8px] border p-5 text-left transition-[background-color,border-color,color] duration-300 md:p-6",
                  on ? "dark border-accent bg-background text-foreground" : "border-border bg-[var(--white)] text-foreground hover:border-foreground/40")}>
                <span className="flex items-center justify-between gap-3"><span className="text-h4 font-medium">{c.title}</span><span aria-hidden className={cn("size-2.5 rounded-full transition-colors", on ? "bg-accent" : "bg-border")} /></span>
                <span className="text-small mt-2 block text-muted-foreground">{c.body}</span>
              </button>
            );
          })}
        </div>
        <div id="calc-panel" role="tabpanel" key={category} className="animate-in fade-in duration-300 motion-reduce:animate-none">
          {category === "video" ? <PricingCalculator data={pricing} /> : <PhotoCalculator data={photo} disclaimer={pricing.disclaimer} />}
        </div>
        {content.notes && (
          <ul className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2">
            {content.notes.items.map((it, i) => <li key={i}><p className="text-small font-medium text-foreground">{it.title}</p><p className="text-caption mt-1 text-muted-foreground">{it.body}</p></li>)}
          </ul>
        )}
      </Section>

      {category === "video" && pricing.active && pricing.config.videoTypes.length > 0 && (
        <Section tone="white" aria-labelledby="cats-title">
          <Reveal>
            <Eyebrow>PRODUCTION CATEGORIES</Eyebrow>
            <h2 id="cats-title" className="text-h1 mt-4 text-foreground">What we produce.</h2>
            <ul className="mt-10 grid border-t border-border sm:grid-cols-2 lg:grid-cols-3">
              {pricing.config.videoTypes.map((v, i) => (
                <li key={v.id} className="border-b border-border py-6 sm:pr-6">
                  <p className="text-caption font-mono text-accent">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="text-h4 mt-2 text-foreground">{v.name}</h3>
                  {pricing.descriptions[v.id] && <p className="text-small mt-2 text-muted-foreground">{pricing.descriptions[v.id]}</p>}
                </li>
              ))}
            </ul>
          </Reveal>
        </Section>
      )}

      {home.pricing && <PricingSection content={home.pricing} />}

      {content.included && (
        <Section tone="warm" aria-labelledby="incl-title">
          <Reveal>
            <Eyebrow>{content.included.eyebrow || "WHAT'S INCLUDED"}</Eyebrow>
            <h2 id="incl-title" className="text-h1 mt-4 max-w-2xl text-foreground">{content.included.title}</h2>
            {content.included.body && <p className="text-body-lg mt-4 max-w-2xl text-muted-foreground">{content.included.body}</p>}
            <ol className="mt-10 grid gap-x-8 border-t border-border sm:grid-cols-2 lg:grid-cols-5">
              {content.included.items.map((it, i) => (
                <li key={i} className="border-b border-border py-6 lg:border-b-0">
                  <p className="text-caption font-mono text-accent">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="text-body mt-2 font-medium text-foreground">{it.title}</h3>
                  <p className="text-small mt-2 text-muted-foreground">{it.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </Section>
      )}

      {content.work.length > 0 && (
        <Section tone="dark" aria-labelledby="work-title">
          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>SELECTED WORK</Eyebrow>
                <h2 id="work-title" className="text-h1 mt-4 text-foreground">See what it looks like.</h2>
              </div>
              <Link to="/work" className="text-small text-muted-foreground hover:text-foreground">Explore all work →</Link>
            </div>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {content.work.map((w) => (
                <li key={w.id}><PortfolioCard slug={w.slug} title={w.title} label={w.category?.name} client={w.client} media={w.media} /></li>
              ))}
            </ul>
          </Reveal>
        </Section>
      )}

      {content.faq && (
        <Section tone="white" aria-labelledby="faq-title">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <Eyebrow>{content.faq.eyebrow || "PRICING FAQ"}</Eyebrow>
              <h2 id="faq-title" className="text-h1 mt-4 text-foreground">{content.faq.title}</h2>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {content.faq.items.map((f, i) => (
                <details key={i} className="group py-5">
                  <summary className="text-body flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                    {f.title}<span aria-hidden className="text-accent transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="text-small mt-3 whitespace-pre-line text-muted-foreground">{f.body}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section tone="dark" aria-labelledby="final-cta" className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_120%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_70%)]" />
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="final-cta" className="text-display text-foreground">Have a Project in Mind?<br />Let’s Make It Happen.</h2>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/book-a-call" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}>Book a Call<span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span></Link>
            <Link to="/start-a-project" className={buttonVariants({ variant: "secondary", size: "lg" })}>Start a Project</Link>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
