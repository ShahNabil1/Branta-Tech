import { Link } from "@tanstack/react-router";
import { BrantaVideo } from "@/components/media/BrantaVideo";
import { Eyebrow, Section, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import type { WebSoftware, WebWork } from "@/lib/web-software.functions";
import { cn } from "@/lib/utils";
import { PortfolioCard, PORTFOLIO_GRID } from "@/components/work/PortfolioCard";

/** Promo film via BrantaVideo: poster first, prepares early (mobile included), fades in once playing. */
function Promo({ id, poster, title }: { id: string | null; poster: string | null; title: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[6px] bg-muted/10">
      {id ? <BrantaVideo kind="vimeo" url={`https://vimeo.com/${id}`} poster={poster} alt={`${title} promo film`} priority="high" sound playButton />
        : poster && <img src={poster} alt={`${title} promo film`} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
    </div>
  );
}

export function WebSoftwareShowcase({ content }: { content: NonNullable<WebSoftware> }) {
  return (
    <Section tone="warm" aria-labelledby="web-software-title">
      <SiteContainer>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h2 id="web-software-title" className="text-display mt-4 text-foreground">{content.title}</h2>
          </div>
          <div className="md:col-span-5 md:pb-2">
            {content.body && <p className="text-body-lg max-w-md text-muted-foreground">{content.body}</p>}
            {content.statement && (
              <p className="text-small mt-4 font-medium text-foreground">
                {content.statement.split("\n").map((l, i) => <span key={i} className="block">{l}</span>)}
              </p>
            )}
            <div className="mt-6"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="secondary" /></div>
          </div>
        </div>

        {(content.promoVimeo || content.promoPoster) && (
          <div className="mt-12 md:mt-16"><Promo id={content.promoVimeo} poster={content.promoPoster} title={content.title} /></div>
        )}

        {content.capabilities.length > 0 && (
          <ul aria-label="Web and software capabilities" className="text-eyebrow mt-6 flex flex-wrap gap-x-3 gap-y-2 text-muted-foreground">
            {content.capabilities.map((c, i) => (
              <li key={c} className="flex items-center gap-3">
                <span>{c}</span>
                {i < content.capabilities.length - 1 && <span aria-hidden className="text-accent">·</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-20 border-t border-border pt-10">
          <h3 className="text-h3 text-foreground">{content.workHeading}</h3>
          {content.work.length ? (
            <ul className={cn("mt-8", PORTFOLIO_GRID)}>
              {content.work.map((w) => (
                <li key={w.id} className="min-w-0">
                  <PortfolioCard slug={w.slug} title={w.title} label={w.services[0]} client={w.client}
                    media={w.image ? { type: "image", url: w.image, poster: null, alt: w.alt, orientation: "landscape", position: "top" } : null} headingLevel="h3" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small mt-4 text-muted-foreground">Selected digital work will appear here.</p>
          )}
        </div>
      </SiteContainer>
    </Section>
  );
}
