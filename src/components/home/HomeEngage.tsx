import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { SmartLink } from "@/components/layout/SiteHeader";
import { HeroAction } from "@/components/home/Hero";
import { buttonVariants } from "@/components/ui/brand-button";
import type { HomeClosing } from "@/lib/home-closing.functions";
import { priceLabel } from "@/lib/home-engage";
import { cn } from "@/lib/utils";

type P<K extends keyof HomeClosing> = { content: NonNullable<HomeClosing[K]> };

/* ---------- Services snapshot: compact 3×2 editorial grid ---------- */
export function ServicesSnapshot({ content }: P<"services">) {
  return (
    <Section tone="warm" aria-labelledby="services-snap-title">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>{content.eyebrow || "WHAT WE DO"}</Eyebrow>
          <h2 id="services-snap-title" className="text-h1 mt-4 whitespace-pre-line text-foreground">{content.title}</h2>
          {content.body && <p className="text-body-lg mt-4 text-muted-foreground">{content.body}</p>}
        </div>
        {content.ctaLabel && (
          <SmartLink url={content.ctaUrl} className="text-small shrink-0 font-medium text-muted-foreground hover:text-foreground">{content.ctaLabel} →</SmartLink>
        )}
      </div>
      <ul className="mt-10 grid border-t border-border sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((it, i) => (
          <li key={i} className="min-w-0 border-b border-border">
            <SmartLink url={it.url || undefined} className="group flex h-full items-start justify-between gap-4 py-6 pr-2 sm:px-4 lg:px-6">
              <span className="min-w-0">
                <span className="text-h4 block font-medium text-foreground">{it.label}</span>
                {it.description && <span className="text-small mt-2 block text-muted-foreground">{it.description}</span>}
              </span>
              <span aria-hidden className="mt-1 text-accent transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
            </SmartLink>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- Pricing: three light cards on a soft orange atmosphere ---------- */
export function PricingSection({ content }: P<"pricing">) {
  return (
    <Section tone="white" aria-labelledby="pricing-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_100%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_70%),radial-gradient(40%_40%_at_10%_20%,color-mix(in_oklab,var(--accent)_7%,transparent),transparent_70%)]" />
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>{content.eyebrow || "WORK WITH BRANTA"}</Eyebrow>
        <h2 id="pricing-title" className="text-h1 mt-4 whitespace-pre-line text-foreground">{content.title}</h2>
        {content.body && <p className="text-body-lg mt-4 text-muted-foreground">{content.body}</p>}
      </div>
      <ul className={cn("mx-auto mt-12 grid max-w-6xl gap-5", content.plans.length >= 3 ? "md:grid-cols-3" : content.plans.length === 2 ? "md:grid-cols-2 max-w-4xl" : "max-w-md")}>
        {content.plans.map((p) => {
          const pr = priceLabel(p);
          return (
            <li key={p.id} className={cn("flex min-w-0 flex-col rounded-[8px] border bg-[var(--warm)] p-6 md:p-7",
              p.highlighted ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border")}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-h4 font-medium text-foreground">{p.name}</h3>
                {p.badge && <span className="text-caption rounded-full bg-accent px-2.5 py-1 font-medium tracking-wide text-accent-foreground">{p.badge}</span>}
              </div>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2 text-foreground">
                {pr.prefix && <span className="text-small text-muted-foreground">{pr.prefix}</span>}
                <span className="text-h3 font-medium">{pr.main}</span>
                {pr.suffix && <span className="text-small text-muted-foreground">{pr.suffix}</span>}
              </p>
              {p.tagline && <p className="text-small mt-3 text-muted-foreground">{p.tagline}</p>}
              {p.features.length > 0 && (
                <ul className="mb-8 mt-6 grid gap-2.5 border-t border-border pt-6">
                  {p.features.map((f, i) => (
                    <li key={i} className="text-small flex gap-3 text-foreground"><span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{f}</li>
                  ))}
                </ul>
              )}
              {p.cta_label && (
                <SmartLink url={p.cta_url} pendingClassName="cursor-not-allowed opacity-60"
                  className={cn(buttonVariants({ variant: p.highlighted ? "primary" : "secondary", size: "lg" }), "mt-auto w-full justify-center")}>
                  {p.cta_label}
                </SmartLink>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ---------- Book a Call CTA: dark charcoal + soft orange glow ---------- */
export function BookCallCta({ content }: P<"bookCall">) {
  return (
    <DarkSection aria-labelledby="book-call-cta-title" className="relative isolate overflow-hidden border-t border-border">
      <div aria-hidden className="pointer-events-none absolute -bottom-1/3 left-1/2 -z-10 h-[120%] w-[90%] -translate-x-1/2 rounded-full bg-accent/25 blur-[120px]" />
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>{content.eyebrow || "HAVE A PROJECT IN MIND?"}</Eyebrow>
        <h2 id="book-call-cta-title" className="text-display mt-4 whitespace-pre-line text-foreground">{content.title}</h2>
        {content.body && <p className="text-body-lg mx-auto mt-5 max-w-xl text-muted-foreground">{content.body}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="primary" />
          <HeroAction label={content.secondary.label} url={content.secondary.url} variant="secondary" />
        </div>
      </div>
    </DarkSection>
  );
}
