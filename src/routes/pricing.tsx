import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/brand-button";
import { useState } from "react";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import { PhotoCalculator } from "@/components/pricing/PhotoCalculator";
import { publicPhotoPricingQuery } from "@/lib/pricing-photo.functions";
import { PortfolioCard } from "@/components/work/PortfolioCard";
import { siteChromeQuery } from "@/lib/navigation";
import { pricingContentQuery, publicPricingQuery } from "@/lib/pricing-page.functions";
import { absoluteUrl, canonical, jsonLd, pageMeta } from "@/lib/seo";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import { Camera, Check, Clapperboard } from "lucide-react";
import { money } from "@/components/pricing/PricingCalculator";

const TITLE = "AI Video & Product Photography Pricing | Branta Tech";
const DESC = "Configure an AI video or an AI product photoshoot and get an instant estimate from Branta Tech, or ask us for a custom quote.";

export const Route = createFileRoute("/pricing")({
  loader: async ({ context }) => {
    const [chrome, video, photo, content] = await Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery),
      context.queryClient.ensureQueryData(publicPricingQuery),
      context.queryClient.ensureQueryData(publicPhotoPricingQuery),
      context.queryClient.ensureQueryData(pricingContentQuery),
    ]);
    return { chrome, video, photo, content };
  },
  head: ({ loaderData }) => {
    const faq = loaderData?.content.faq?.items ?? [];
    return {
      links: canonical("/pricing"),
      meta: pageMeta({ title: TITLE, description: DESC, path: "/pricing" }),
      scripts: faq.length ? [jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", url: absoluteUrl("/pricing"), mainEntity: faq.map((item) => ({ "@type": "Question", name: item.title, acceptedAnswer: { "@type": "Answer", text: item.body } })) })] : [],
    };
  },
  errorComponent: () => <p className="p-8">Something went wrong loading pricing.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: PricingPage,
});

const CATEGORIES = [
  { id: "video" as const, title: "AI Video Production", body: "Commercials, OVCs, TVCs, motion graphics and social video production." },
  { id: "photography" as const, title: "AI Product Photography", body: "Website product images, e-commerce, fashion photography, AI models and campaign visuals." },
];
const BENEFITS = ["Instant estimate in BDT", "Transparent, itemized breakdown", "Final quote confirmed on a call"];

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={cn("reveal", className)}>{children}</div>;
}
const posterOf = (m: { type: string; url: string; poster: string | null } | null) => (m ? (m.type === "image" ? m.url : m.poster) : null);

function PricingPage() {
  const { data: pricing } = useSuspenseQuery(publicPricingQuery);
  const { data: content } = useSuspenseQuery(pricingContentQuery);
  const { data: photo } = useSuspenseQuery(publicPhotoPricingQuery);
  const [category, setCategory] = useState<"video" | "photography">("video");
  const scrollToCalc = () => document.getElementById("calculator")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const heroMedia = content.work.map((w) => ({ w, src: posterOf(w.media) })).filter((x) => x.src).slice(0, 3);
  const packages = photo.active ? photo.config.packages : [];
  const featured = packages.length > 1 ? Math.min(1, packages.length - 1) : -1;
  const cur = photo.active ? photo.config.settings.currency : "BDT";

  return (
    <SiteShell>
      {/* 1. Hero */}
      <Section tone="muted" aria-labelledby="pricing-hero" className="pb-12 md:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <Eyebrow>PRICING THAT SCALES WITH YOUR VISION</Eyebrow>
            <h1 id="pricing-hero" className="text-display mt-6 max-w-[16ch] text-foreground">Simple, Flexible Pricing for AI Production.</h1>
            <p className="text-body-lg mt-6 max-w-xl text-muted-foreground">High-quality AI video and product photography, built for modern brands. Choose your service, customize your requirements, and get an instant estimate.</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {BENEFITS.map((b) => <li key={b} className="text-small flex items-center gap-2 text-foreground"><Check aria-hidden className="size-4 text-accent" />{b}</li>)}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={scrollToCalc} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}>
                Calculate Your Price<span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-y-0.5">↓</span>
              </button>
              <Link to="/book-a-call" className={buttonVariants({ variant: "secondary", size: "lg" })}>Book a Call</Link>
            </div>
          </div>
          {heroMedia.length > 0 ? (
            <div aria-hidden className="relative hidden aspect-[5/4] lg:block">
              {heroMedia.map(({ w, src }, i) => (
                <img key={w.id} src={src!} alt="" loading={i ? "lazy" : "eager"}
                  className={cn("absolute rounded-[20px] object-cover shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)]",
                    i === 0 && "left-0 top-0 h-[68%] w-[78%]", i === 1 && "bottom-0 right-0 h-[52%] w-[56%] border-4 border-[var(--warm-white)]", i === 2 && "bottom-[6%] left-[6%] h-[30%] w-[32%] border-4 border-[var(--warm-white)]")} />
              ))}
            </div>
          ) : (
            <div className="hidden rounded-[20px] border border-border bg-[var(--white)] p-8 lg:block">
              <p className="text-eyebrow text-muted-foreground">HOW IT WORKS</p>
              <ol className="mt-6 space-y-5">
                {["Choose AI video or product photography", "Configure your requirements", "See your estimate instantly", "Book a call to finalise"].map((t, i) => (
                  <li key={t} className="flex items-center gap-4"><span className="text-caption grid size-8 place-items-center rounded-full bg-muted font-mono">{i + 1}</span><span className="text-body text-foreground">{t}</span></li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Section>

      {/* 2–4. Categories + calculator + live summary */}
      <Section tone="muted" id="calculator" aria-labelledby="calc-title" className="scroll-mt-16 pt-0 md:pt-0">
        <h2 id="calc-title" className="sr-only">Pricing calculator</h2>
        <div role="tablist" aria-label="Pricing category" className="mb-8 grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} aria-controls="calc-panel" onClick={() => setCategory(c.id)}
                className={cn("group flex items-start gap-4 rounded-[20px] border p-5 text-left transition-[background-color,border-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:p-6",
                  on ? "border-accent bg-accent/[0.05] shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-[var(--white)] hover:border-foreground/30")}>
                <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-[12px] transition-colors", on ? "bg-accent text-accent-foreground" : "bg-muted text-foreground")}>
                  {c.id === "video" ? <Clapperboard className="size-5" /> : <Camera className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3"><span className="text-h4 font-medium text-foreground">{c.title}</span>
                    <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-accent bg-accent" : "border-border")}>{on && <Check className="size-3 text-accent-foreground" />}</span></span>
                  <span className="text-small mt-1.5 block text-muted-foreground">{c.body}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div id="calc-panel" role="tabpanel" key={category} className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
          {category === "video" ? <PricingCalculator data={pricing} /> : <PhotoCalculator data={photo} disclaimer={pricing.disclaimer} />}
        </div>
        {content.notes && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {content.notes.items.map((it, i) => <li key={i} className="rounded-[14px] border border-border bg-[var(--white)] p-5"><p className="text-small font-medium text-foreground">{it.title}</p><p className="text-caption mt-1 text-muted-foreground">{it.body}</p></li>)}
          </ul>
        )}
      </Section>

      {/* 5. Popular packages (published photography packages only) */}
      {packages.length > 0 && (
        <Section tone="white" aria-labelledby="pkg-title">
          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>POPULAR PACKAGES</Eyebrow>
                <h2 id="pkg-title" className="text-h1 mt-4 text-foreground">Product photoshoot packages.</h2>
              </div>
              <p className="text-small max-w-sm text-muted-foreground">Priced per product. Bulk discounts apply automatically in the calculator.</p>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {packages.map((p, i) => {
                const hot = i === featured;
                const views = p.view_ids.map((id) => photo.active ? photo.config.views.find((v) => v.id === id)?.name : null).filter(Boolean) as string[];
                return (
                  <li key={p.id} className={cn("relative isolate flex flex-col overflow-hidden rounded-[20px] p-6 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transform-none",
                    hot ? "dark bg-background text-foreground shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--accent)_60%,transparent)]" : "border border-dashed border-border bg-[var(--white)]")}>
                    {hot && <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_70%_at_70%_110%,color-mix(in_oklab,var(--accent)_55%,transparent),transparent_70%)]" />}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-caption text-muted-foreground">{p.image_count} images · per product</p>
                      {hot && <span className="text-caption rounded-full bg-foreground/10 px-2.5 py-1 text-foreground">Featured</span>}
                    </div>
                    <p className="text-h2 mt-3 tabular-nums text-foreground">{money(Math.round((p.price_per_product ?? 0) * 100), cur)}</p>
                    <h3 className="text-body mt-2 font-medium text-foreground">{p.name}</h3>
                    {photo.active && photo.descriptions[p.id] && <p className="text-small mt-2 text-muted-foreground">{photo.descriptions[p.id]}</p>}
                    {views.length > 0 && <ul className="mt-5 space-y-2">{views.map((v) => <li key={v} className="text-small flex items-center gap-2 text-muted-foreground"><Check aria-hidden className="size-3.5 text-accent" />{v}</li>)}</ul>}
                    <button type="button" onClick={() => { setCategory("photography"); scrollToCalc(); }}
                      className={cn(buttonVariants({ variant: hot ? "primary" : "secondary", size: "md" }), "mt-auto w-full justify-center", "mt-8")}>Configure package</button>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </Section>
      )}

      {/* 6. What's included */}
      {content.included && (
        <Section tone="muted" aria-labelledby="incl-title">
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
              <div>
                <Eyebrow>{content.included.eyebrow || "WHAT'S INCLUDED"}</Eyebrow>
                <h2 id="incl-title" className="text-h1 mt-4 text-foreground">{content.included.title}</h2>
                {content.included.body && <p className="text-body mt-4 text-muted-foreground">{content.included.body}</p>}
              </div>
              <ol className="grid gap-x-8 sm:grid-cols-2">
                {content.included.items.map((it, i) => (
                  <li key={i} className="flex gap-4 border-t border-border py-5">
                    <span className="text-caption font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                    <span><h3 className="text-body font-medium text-foreground">{it.title}</h3><p className="text-small mt-1.5 text-muted-foreground">{it.body}</p></span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </Section>
      )}

      {/* 7. Related work */}
      {content.work.length > 0 && (
        <Section tone="white" aria-labelledby="work-title">
          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>RELATED WORK</Eyebrow>
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

      {/* 8. FAQ */}
      {content.faq && (
        <Section tone="muted" aria-labelledby="faq-title">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <Eyebrow>{content.faq.eyebrow || "PRICING FAQ"}</Eyebrow>
              <h2 id="faq-title" className="text-h1 mt-4 text-foreground">{content.faq.title || "Frequently asked questions"}</h2>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {content.faq.items.map((f, i) => (
                <details key={i} className="group py-5">
                  <summary className="text-body flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    {f.title}<span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--white)] text-accent transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none">+</span>
                  </summary>
                  <p className="text-small mt-3 max-w-2xl whitespace-pre-line text-muted-foreground group-open:animate-in group-open:fade-in group-open:slide-in-from-top-1 motion-reduce:animate-none">{f.body}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* 9. Final CTA */}
      <Section tone="dark" aria-labelledby="final-cta" className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_120%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_70%)]" />
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="final-cta" className="text-display text-foreground">Have Something Bigger in Mind?</h2>
          <p className="text-body-lg mx-auto mt-6 max-w-xl text-muted-foreground">Let’s discuss your creative requirements and build the right production solution.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/book-a-call" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}>Book a Call<span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span></Link>
            <Link to="/start-a-project" className={buttonVariants({ variant: "secondary", size: "lg" })}>Start a Project</Link>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
