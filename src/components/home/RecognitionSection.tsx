import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Award, BadgeCheck, Handshake, Medal, ShieldCheck, Star, Trophy, type LucideIcon } from "lucide-react";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import type { Recognition, RecognitionItem } from "@/lib/recognition.functions";

const ICONS: Record<string, LucideIcon> = { funding: ShieldCheck, champion: Trophy, award: Medal, certification: BadgeCheck, recognition: Star, partnership: Handshake };

export function RecognitionSection({ data }: { data: NonNullable<Recognition> }) {
  const ref = useReveal<HTMLDivElement>(0.1);
  const r = "opacity-0 transition-all duration-700 ease-out group-data-[revealed=true]/r:opacity-100";
  return (
    <Section tone="warm" id="recognition" className="overflow-hidden">
      <SiteContainer>
        <div ref={ref} className="group/r grid items-center gap-12 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-16">
          <div>
            <p className={cn("text-eyebrow flex items-center gap-2 text-muted-foreground", r)}><span aria-hidden className="size-1.5 rounded-full bg-accent" />{data.eyebrow}</p>
            <h2 className={cn("text-display mt-5 whitespace-pre-line text-foreground translate-y-6 delay-100 group-data-[revealed=true]/r:translate-y-0", r)}>{data.title}</h2>
            {data.body && <p className={cn("text-body mt-5 max-w-md text-muted-foreground delay-200", r)}>{data.body}</p>}
            {data.ctaLabel && (
              <Link to={data.ctaUrl} className={cn("text-small group mt-8 inline-flex items-center gap-2 font-medium text-foreground underline decoration-border underline-offset-8 transition-colors hover:text-accent hover:decoration-accent delay-300", r)}>
                {data.ctaLabel}<span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            )}
          </div>
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-[-10%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)] blur-2xl" />
            <ul role="list" className={cn("relative grid gap-5", data.items.length > 1 && "sm:grid-cols-2")}>
              {data.items.map((it, i) => (
                <li key={it.id} className="translate-y-5 opacity-0 transition-all duration-700 ease-out group-data-[revealed=true]/r:translate-y-0 group-data-[revealed=true]/r:opacity-100"
                  style={{ transitionDelay: `${300 + i * 100}ms` }}>
                  <Card it={it} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SiteContainer>
    </Section>
  );
}

function Card({ it }: { it: RecognitionItem }) {
  const Icon = ICONS[it.type] ?? Award;
  const body = (
    <>
      <span aria-hidden className="absolute right-5 top-5 grid size-9 place-items-center rounded-full border border-border bg-background text-accent">
        <Icon className="size-4" />
      </span>
      <p className="text-caption pr-12 font-medium uppercase tracking-[0.14em] text-accent">{it.label}</p>
      <h3 className="text-h4 mt-2 pr-10 text-foreground">{it.organization}</h3>
      <div className="mt-6 flex h-24 items-center">
        {it.logo ? (
          <img src={it.logo} alt={`${it.organization} logo`} loading="lazy" className="max-h-full max-w-[85%] object-contain object-left transition-transform duration-500 group-hover/c:scale-[1.03]" />
        ) : (
          <span className="text-h3 text-muted-foreground">{it.organization}</span>
        )}
      </div>
      {(it.title || it.description || it.year) && (
        <div className="mt-6 border-t border-border pt-4">
          {it.title && <p className="text-small font-medium text-foreground">{it.title}</p>}
          {it.description && <p className="text-small mt-1 text-muted-foreground">{it.description}</p>}
          {it.year && <p className="text-caption mt-2 text-muted-foreground">{it.year}</p>}
        </div>
      )}
      {it.url && <ArrowUpRight aria-hidden className="absolute bottom-5 right-5 size-4 text-accent opacity-0 transition-opacity group-hover/c:opacity-100" />}
    </>
  );
  const cls = "group/c relative block h-full rounded-[22px] border border-border bg-background p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_18px_40px_-28px_color-mix(in_oklab,var(--accent)_60%,transparent)] motion-reduce:hover:translate-y-0 md:p-7";
  return it.url
    ? <a href={it.url} target="_blank" rel="noreferrer" className={cls}>{body}</a>
    : <div className={cls}>{body}</div>;
}
