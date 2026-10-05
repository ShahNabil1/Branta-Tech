import { useEffect, useRef, useState } from "react";
import { WorkMediaModal } from "@/components/work/WorkMediaModal";
import { Link } from "@tanstack/react-router";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { PortfolioCard, PORTFOLIO_RAIL_W } from "@/components/work/PortfolioCard";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import type { WorkCard } from "@/lib/work.functions";
import type { WorkShowcase as Data } from "@/lib/work-showcase.functions";

const VARIANCE = [1, 1.08, 1.03, 1.12, 0.97, 1.06, 1.1, 1.01, 1.05];

/** Animated rows only on hover-capable devices without reduced motion; touch/reduced get swipeable static rows. */
function useAnimatedRows() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return on;
}

export function WorkShowcase({ data }: { data: NonNullable<Data> }) {
  const animated = useAnimatedRows();
  const [active, setActive] = useState<{ row: string; card: WorkCard } | null>(null);
  const rows = [
    ...(data.featured.length ? [{ key: "featured", label: "Featured", tone: "dark" as const, items: data.featured, description: "", exploreUrl: data.ctaUrl }] : []),
    ...data.groups,
  ];
  if (!rows.length) return null;
  const jump = (id: string) => document.getElementById(`work-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div id="work-showcase">
      <WorkMediaModal card={active?.card ?? null} onClose={() => setActive(null)} />
      {rows.map((row, i) => {
        const featured = row.key === "featured";
        return (
          <Section key={row.key} id={`work-${row.key}`} tone={row.tone} bleed className="scroll-mt-20 overflow-hidden">
            <RowHeader
              eyebrow={featured ? data.eyebrow : row.label}
              title={featured || i === 0 ? data.title : null}
              body={featured || i === 0 ? data.body : row.description}
              cta={{ label: featured || i === 0 ? data.ctaLabel : `Explore ${row.label}`, url: featured || i === 0 ? data.ctaUrl : row.exploreUrl }}
            >
              {i === 0 && data.showJumpNav && data.groups.length > 1 && (
                <nav aria-label="Work categories" className="mt-8 flex flex-wrap gap-2">
                  <Link to="/work" className="text-caption rounded-full border border-border px-3 py-1.5 uppercase tracking-wide text-foreground transition-colors hover:border-accent hover:text-accent">Explore All</Link>
                  {data.groups.map((g) => (
                    <a key={g.key} href={`#work-${g.key}`} onClick={(e) => { e.preventDefault(); jump(g.key); }}
                      className="text-caption rounded-full border border-border px-3 py-1.5 uppercase tracking-wide text-muted-foreground transition-colors hover:border-accent hover:text-accent">{g.label}</a>
                  ))}
                </nav>
              )}
            </RowHeader>
            <WorkRow
              rowKey={row.key} items={row.items} reverse={i % 2 === 0} animated={animated}
              duration={data.speed * (VARIANCE[i % VARIANCE.length] ?? 1)}
              live={data.hoverPreview}
              headingLevel="h3" activeSlug={active?.row === row.key ? active.card.slug : null}
              onActivate={(card) => { setActive({ row: row.key, card }); }}
            />
          </Section>
        );
      })}
    </div>
  );
}

function RowHeader({ eyebrow, title, body, cta, children }: { eyebrow: string; title: string | null; body: string; cta: { label: string; url: string }; children?: React.ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <SiteContainer>
      <div ref={ref} className="translate-y-4 opacity-0 transition-all duration-700 ease-out data-[revealed=true]:translate-y-0 data-[revealed=true]:opacity-100">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-eyebrow flex items-center gap-2 text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-accent" />{eyebrow}</p>
            {title ? <h2 className="text-display mt-4 text-foreground">{title}</h2> : null}
            {body && <p className={cn("text-body text-muted-foreground", title ? "mt-4" : "mt-3")}>{body}</p>}
          </div>
          <Link to={cta.url} className="text-small group inline-flex items-center gap-2 font-medium text-foreground underline decoration-border underline-offset-8 transition-colors hover:text-accent hover:decoration-accent">
            {cta.label}<span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
        {children}
      </div>
    </SiteContainer>
  );
}

function WorkRow({ rowKey, items, reverse, animated, duration, live, headingLevel, activeSlug, onActivate }: {
  activeSlug: string | null; onActivate: (card: WorkCard) => void;
  rowKey: string; items: WorkCard[]; reverse: boolean; animated: boolean; duration: number;
  live: boolean; headingLevel: "h3";
}) {
  const ref = useReveal<HTMLDivElement>(0.05);
  // Fill the loop so short rows still span wide screens; the second half is a visual duplicate.
  const reps = animated ? Math.max(1, Math.ceil(8 / items.length)) : 1;
  const base = Array.from({ length: reps }, () => items).flat();
  const track = animated ? [...base, ...base] : base;
  const card = (p: WorkCard, idx: number) => {
    const dup = idx >= items.length;
    const id = `${rowKey}:${idx}`;
    return (
      <div key={id} aria-hidden={dup || undefined} inert={dup || undefined}
        className={cn("relative shrink-0 snap-start transition-transform duration-500 ease-out hover:z-10 hover:scale-[1.14] focus-within:z-10 focus-within:scale-[1.14] motion-reduce:hover:scale-100", PORTFOLIO_RAIL_W)}>
          <LiveCard enabled={live && !!p.media && p.media.type !== "image"}>{(on) => <PortfolioCard playing={on} slug={p.slug} title={p.title} label={p.category?.name ?? p.services[0]?.name ?? null} client={p.client} media={p.media}
            headingLevel={headingLevel} onFocusScroll={!animated}
            onActivate={() => onActivate(p)} />}</LiveCard>
      </div>
    );
  };
  return (
    <div ref={ref}
      className={cn("mt-10 opacity-0 transition-all duration-1000 ease-out data-[revealed=true]:translate-x-0 data-[revealed=true]:opacity-100", reverse ? "-translate-x-8" : "translate-x-8")}>
      {animated ? (
        <div className="group/row overflow-x-clip py-10 -my-10">
          <ul role="list" aria-label="Projects"
            className={cn("flex w-max gap-6 pl-6 animate-marquee group-hover/row:[animation-play-state:paused] group-focus-within/row:[animation-play-state:paused]", activeSlug && "[animation-play-state:paused]", reverse ? "[animation-direction:reverse]" : "")}
            style={{ ["--marquee-duration" as string]: `${Math.round(duration * (track.length / 12 || 1))}s` }}>
            {track.map((p, idx) => <li key={idx} className="contents">{card(p, idx)}</li>)}
          </ul>
        </div>
      ) : (
        <ul role="list" aria-label="Projects" className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-4 [scrollbar-width:none]">
          {track.map((p, idx) => <li key={idx} className="contents">{card(p, idx)}</li>)}
        </ul>
      )}
    </div>
  );
}

/**
 * Live muted tile: the card's video mounts only while the card is on (or just beside) the screen,
 * so a row never holds more players than the visible cards. Leaving the screen keeps the player
 * for a few seconds so moving rows don't flicker back to posters.
 */
function LiveCard({ enabled, children }: { enabled: boolean; children: (on: boolean) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(t);
      if (e?.isIntersecting) setOn(true);
      else t = setTimeout(() => setOn(false), 4000);
    }, { rootMargin: "150px 120px" });
    io.observe(el);
    return () => { clearTimeout(t); io.disconnect(); };
  }, [enabled]);
  return <div ref={ref}>{children(enabled && on)}</div>;
}
