import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DarkSection, Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import { PortfolioCard, PORTFOLIO_RAIL_W } from "@/components/work/PortfolioCard";
import { FILM_FILTERS, type AiFilm, type FilmItem } from "@/lib/ai-film.functions";
import { cn } from "@/lib/utils";

const STEPS = ["Concept", "Direction", "AI Production", "Sound", "Post"];

function FilmCard({ item, playing, setPlaying }: { item: FilmItem; playing: boolean; setPlaying: (id: string | null) => void }) {
  return (
    <li className="shrink-0 snap-start">
      <PortfolioCard slug={item.slug} title={item.title} label={item.format} client={item.client} media={item.media}
        playing={playing} onPreview={(on) => setPlaying(on ? item.id : null)} className={PORTFOLIO_RAIL_W} />
    </li>
  );
}

export function AiFilmShowcase({ content }: { content: NonNullable<AiFilm> }) {
  const [filter, setFilter] = useState("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const rail = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const available = FILM_FILTERS.filter((f) => content.items.some((i) => i.filters.includes(f.key)));
  const showFilters = content.filterEnabled && available.length > 0;
  const items = filter === "all" ? content.items : content.items.filter((i) => i.filters.includes(filter));

  useEffect(() => { rail.current?.scrollTo({ left: 0 }); setPlaying(null); }, [filter]);
  if (!content.items.length) return null;

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <DarkSection aria-labelledby="ai-film-title" className="overflow-hidden">
      <SiteContainer>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h2 id="ai-film-title" className="text-display mt-4 text-foreground">{content.title}</h2>
          </div>
          <div className="md:col-span-5 md:pb-2">
            {content.body && <p className="text-body-lg max-w-md text-muted-foreground">{content.body}</p>}
            <div className="mt-6"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="secondary" /></div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          {showFilters ? (
            <div role="group" aria-label="Filter films" className="no-scrollbar flex gap-2 overflow-x-auto">
              {[{ key: "all", label: "All" }, ...available].map((f) => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                  className={cn("text-caption shrink-0 rounded-full border px-3 py-1.5 transition-colors",
                    filter === f.key ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                  {f.label}
                </button>
              ))}
            </div>
          ) : <span />}
          <div className="hidden gap-2 sm:flex">
            <button type="button" aria-label="Previous films" onClick={() => step(-1)} className="grid size-10 place-items-center rounded-full border border-border text-foreground hover:border-foreground"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next films" onClick={() => step(1)} className="grid size-10 place-items-center rounded-full border border-border text-foreground hover:border-foreground"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      </SiteContainer>

      {/* Native horizontal scroll: vertical wheel still scrolls the page. Mouse drag on desktop. */}
      <ul
        ref={rail}
        aria-label="AI film work"
        className="no-scrollbar mt-6 flex cursor-grab snap-x snap-mandatory items-start gap-4 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-2 active:cursor-grabbing md:gap-5"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !rail.current) return;
          drag.current = { x: e.clientX, left: rail.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !rail.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) { d.moved = true; rail.current.style.scrollSnapType = "none"; }
          rail.current.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => { drag.current = null; if (rail.current) rail.current.style.scrollSnapType = ""; }}
        onPointerLeave={() => { drag.current = null; if (rail.current) rail.current.style.scrollSnapType = ""; }}
      >
        {items.map((item) => (
          <FilmCard key={item.id} item={item} playing={playing === item.id} setPlaying={setPlaying} />
        ))}
      </ul>

      <SiteContainer>
        <div className="mt-14 border-t border-border pt-6">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-eyebrow text-muted-foreground" aria-label="AI film workflow">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={cn(i === 2 && "text-foreground")}>{s}</span>
                {i < STEPS.length - 1 && <span aria-hidden className="text-accent">→</span>}
              </li>
            ))}
          </ol>
          <p className="text-caption mt-3 text-muted-foreground">One workflow from idea to final frame.</p>
        </div>
      </SiteContainer>
    </DarkSection>
  );
}
