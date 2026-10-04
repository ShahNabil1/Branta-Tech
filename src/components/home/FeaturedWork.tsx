import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DarkSection, Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import { vimeoId } from "@/lib/hero";
import { cn } from "@/lib/utils";
import type { FeaturedWork as FW, WorkItem } from "@/lib/featured-work.functions";

function canHover() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WorkMediaView({ media, title, playing }: { media: WorkItem["media"]; title: string; alt?: string; playing: boolean }) {
  return <Media item={{ media, title } as WorkItem} playing={playing} />;
}

const COVER_POS: Record<string, string> = { center: "object-center", top: "object-top", bottom: "object-bottom", left: "object-left", right: "object-right" };

function Media({ item, playing }: { item: WorkItem; playing: boolean }) {
  const m = item.media;
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!playing) setReady(false); }, [playing]);
  if (!m) {
    return <div className="flex h-full w-full items-center justify-center bg-muted/10 text-caption text-muted-foreground">Media coming soon</div>;
  }
  const poster = m.type === "image" ? m.url : m.poster;
  const pos = COVER_POS[m.position ?? "center"] ?? "object-center";
  const vid = m.type === "vimeo" ? vimeoId(m.url) : null;
  return (
    <>
      {poster ? (
        <img src={poster} alt={m.alt} loading="lazy" decoding="async" className={cn("absolute inset-0 h-full w-full object-cover transition-transform", pos, " duration-700 ease-out group-hover:scale-[1.03]")} />
      ) : (
        <div className="absolute inset-0 bg-muted/10" />
      )}
      {playing && vid && (
        <iframe
          title={`${item.title} preview`}
          src={`https://player.vimeo.com/video/${vid}?background=1&autoplay=1&muted=1&loop=1&dnt=1`}
          allow="autoplay; fullscreen"
          tabIndex={-1}
          aria-hidden
          onLoad={() => setTimeout(() => setReady(true), 600)}
          className={cn("pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
        />
      )}
      {playing && m.type === "video" && (
        <video src={m.url} poster={poster ?? undefined} muted loop playsInline autoPlay onPlaying={() => setReady(true)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", pos, ready ? "opacity-100" : "opacity-0")} />
      )}
    </>
  );
}

/** Tile width/aspect by real orientation, with a rhythm so neighbours differ. */
function tileShape(item: WorkItem, i: number) {
  void item;
  return i % 3 === 0
    ? "w-[86vw] sm:w-[64vw] md:w-[44rem] aspect-video"
    : "w-[80vw] sm:w-[56vw] md:w-[34rem] aspect-video";
}

function Tile({ item, i, playing, onHover, showClient }: { item: WorkItem; i: number; playing: boolean; onHover: (id: string | null) => void; showClient: boolean }) {
  const on = () => canHover() && onHover(item.id);
  return (
    <li className="shrink-0">
      <Link to="/work/$slug" params={{ slug: item.slug }} draggable={false}
        onMouseEnter={on} onMouseLeave={() => onHover(null)} onFocus={(e) => { e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); on(); }} onBlur={() => onHover(null)}
        className="group block rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <div className={cn("relative overflow-hidden rounded-[4px] bg-muted/10", tileShape(item, i))}>
          <Media item={item} playing={playing} />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {item.label && <p className="text-caption flex items-center gap-2 text-muted-foreground"><span aria-hidden className="h-1 w-1 rounded-full bg-accent" />{item.label}</p>}
            <h3 className="text-body mt-1 font-medium text-foreground/80 transition-colors duration-300 group-hover:text-foreground">
              {item.title}{showClient && item.client && <span className="text-muted-foreground"> · {item.client}</span>}
            </h3>
          </div>
          <span aria-hidden className="mt-1 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:opacity-100">→</span>
        </div>
      </Link>
    </li>
  );
}

/** Slow ping-pong drift via scrollLeft (no duplicated content). Pauses on hover/interaction and for reduced motion. */
function Row({ items, dir, speed, playing, onHover, showClient, label }: {
  items: WorkItem[]; dir: "left" | "right"; speed: number; playing: string | null; onHover: (id: string | null) => void; showClient: boolean; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ hover: false, until: 0, dir: dir === "left" ? 1 : -1, pos: -1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const s = state.current;
    s.dir = dir === "left" ? 1 : -1;
    s.pos = -1;
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      const max = el.scrollWidth - el.clientWidth;
      if (max > 4) {
        if (s.pos < 0) { s.pos = s.dir === 1 ? 0 : max; el.scrollLeft = s.pos; }
        if (!s.hover && t > s.until && !document.hidden) {
          s.pos += s.dir * speed * dt / 1000;
          if (s.pos >= max) { s.pos = max; s.dir = -1; s.until = t + 1500; }
          if (s.pos <= 0) { s.pos = 0; s.dir = 1; s.until = t + 1500; }
          el.scrollLeft = s.pos;
        } else s.pos = el.scrollLeft;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hold = () => { s.until = performance.now() + 4000; s.pos = el.scrollLeft; };
    el.addEventListener("pointerdown", hold); el.addEventListener("wheel", hold, { passive: true }); el.addEventListener("touchstart", hold, { passive: true }); el.addEventListener("focusin", hold);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointerdown", hold); el.removeEventListener("wheel", hold); el.removeEventListener("touchstart", hold); el.removeEventListener("focusin", hold); };
  }, [items, dir, speed]);
  if (!items.length) return null;
  return (
    <div ref={ref} role="region" aria-label={label} onMouseEnter={() => { state.current.hover = true; }} onMouseLeave={() => { state.current.hover = false; state.current.pos = ref.current?.scrollLeft ?? -1; }}
      className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max items-start gap-4 px-[var(--gutter)] md:gap-6">
        {items.map((it, i) => <Tile key={it.id} item={it} i={i + (dir === "right" ? 1 : 0)} playing={playing === it.id} onHover={onHover} showClient={showClient} />)}
      </ul>
    </div>
  );
}

export function FeaturedWork({ content }: { content: NonNullable<FW> }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [fade, setFade] = useState(false);
  if (!content.items.length) return null;
  const items = filter ? content.items.filter((x) => x.tags.includes(filter)) : content.items;
  const row1 = items.filter((_, i) => i % 2 === 0);
  const row2 = items.filter((_, i) => i % 2 === 1);
  const pick = (slug: string | null) => { if (slug === filter) return; setPlaying(null); setFade(true); setTimeout(() => { setFilter(slug); setFade(false); }, 200); };
  const chip = (on: boolean) => cn("text-small shrink-0 rounded-full px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-accent",
    on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground");

  return (
    <DarkSection bleed aria-labelledby="featured-work-title" className="overflow-hidden">
      <SiteContainer>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h2 id="featured-work-title" className="text-display mt-4 text-foreground">{content.title}</h2>
          </div>
          <div className="md:col-span-5 md:pb-2">
            {content.body && <p className="text-body-lg max-w-md text-muted-foreground">{content.body}</p>}
            <div className="mt-6"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="secondary" /></div>
          </div>
        </div>
        {content.filters.length > 1 && (
          <div role="group" aria-label="Filter work" className="-mx-5 mt-12 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:mt-16 md:flex-wrap md:px-0">
            <button type="button" aria-pressed={!filter} onClick={() => pick(null)} className={chip(!filter)}>All</button>
            {content.filters.map((f) => (
              <button key={f.slug} type="button" aria-pressed={filter === f.slug} onClick={() => pick(f.slug)} className={chip(filter === f.slug)}>{f.name}</button>
            ))}
          </div>
        )}
      </SiteContainer>
      <div className={cn("mt-10 space-y-8 transition-opacity duration-200 md:space-y-10", fade ? "opacity-0" : "opacity-100")} aria-live="polite">
        <Row key={`a-${filter}`} items={row1} dir="left" speed={22} playing={playing} onHover={setPlaying} showClient={content.showClient} label="Selected work, row one" />
        <Row key={`b-${filter}`} items={row2} dir="right" speed={18} playing={playing} onHover={setPlaying} showClient={content.showClient} label="Selected work, row two" />
      </div>
    </DarkSection>
  );
}
