import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { DarkSection, Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import { vimeoId } from "@/lib/hero";
import { cn } from "@/lib/utils";
import type { FeaturedWork as FW, WorkItem } from "@/lib/featured-work.functions";

/** Editorial rhythm: large film, tall + medium pair, wide, small + tall pair. */
const SLOTS = [
  "md:col-span-12 aspect-[16/9]",
  "md:col-span-5 aspect-[4/5]",
  "md:col-span-7 aspect-[4/3] md:self-end",
  "md:col-span-12 aspect-[21/9]",
  "md:col-span-5 aspect-[4/3] md:self-end",
  "md:col-span-7 aspect-[16/10]",
];

function canHover() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WorkMediaView({ media, title, playing }: { media: WorkItem["media"]; title: string; alt?: string; playing: boolean }) {
  return <Media item={{ media, title } as WorkItem} playing={playing} />;
}

function Media({ item, playing }: { item: WorkItem; playing: boolean }) {
  const m = item.media;
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!playing) setReady(false); }, [playing]);
  if (!m) {
    return <div className="flex h-full w-full items-center justify-center bg-muted/10 text-caption text-muted-foreground">Media coming soon</div>;
  }
  const poster = m.type === "image" ? m.url : m.poster;
  const vid = m.type === "vimeo" ? vimeoId(m.url) : null;
  return (
    <>
      {poster ? (
        <img src={poster} alt={m.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
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
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")} />
      )}
    </>
  );
}

function Card({ item, slot, index, playing, onHover, show }: {
  item: WorkItem; slot: string; index: number; playing: boolean; onHover: (id: string | null) => void;
  show: Pick<NonNullable<FW>, "showClient" | "showCategory" | "showServices">;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  // Stop preview when the card leaves the viewport.
  useEffect(() => {
    if (!playing || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting) onHover(null); });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [playing, onHover]);

  const meta = [show.showClient && item.client, show.showCategory && item.category, item.year].filter(Boolean).join(" · ");
  const services = show.showServices ? item.services.join(" · ") : "";
  const linkable = "/work/$slug" in router.routesByPath;

  const body = (
    <>
      <div ref={ref} className={cn("relative w-full overflow-hidden rounded-[4px] bg-muted/10", slot.split(" ").filter((c) => c.includes("aspect")).join(" "))}>
        <Media item={item} playing={playing} />
        <span className="text-caption absolute left-3 top-3 z-10 font-mono text-ink-foreground/70">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 transition-transform duration-300 group-hover:translate-x-1">
          <h3 className="text-h4 font-medium text-foreground">{item.title}</h3>
          {meta && <p className="text-caption mt-1 text-muted-foreground">{meta}</p>}
          {services && <p className="text-caption mt-1 text-muted-foreground/80">{services}</p>}
        </div>
        <span aria-hidden className={cn("mt-1 text-accent transition-all duration-300", linkable ? "opacity-60 group-hover:translate-x-1 group-hover:opacity-100" : "opacity-0")}>→</span>
      </div>
    </>
  );

  const handlers = {
    onMouseEnter: () => canHover() && onHover(item.id),
    onMouseLeave: () => onHover(null),
  };
  const cls = cn("group block min-w-0", slot.split(" ").filter((c) => !c.includes("aspect")).join(" "));

  if (linkable && item.slug) {
    return <Link to="/work/$slug" params={{ slug: item.slug }} className={cn(cls, "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent")} {...handlers} onFocus={handlers.onMouseEnter} onBlur={handlers.onMouseLeave}>{body}</Link>;
  }
  return <article className={cls} {...handlers}>{body}</article>;
}

export function FeaturedWork({ content }: { content: NonNullable<FW> }) {
  const [playing, setPlaying] = useState<string | null>(null);
  if (!content.items.length) return null;
  const n = content.items.length;
  // With very few projects, keep each one large instead of forcing pairs.
  const slots = n <= 2 ? content.items.map(() => SLOTS[0]!) : SLOTS;

  return (
    <DarkSection aria-labelledby="featured-work-title">
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
        <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-12 md:mt-20 md:grid-cols-12 md:gap-y-16">
          {content.items.map((item, i) => (
            <Card key={item.id} item={item} index={i} slot={slots[i] ?? SLOTS[5]!} playing={playing === item.id} onHover={setPlaying}
              show={content} />
          ))}
        </div>
      </SiteContainer>
    </DarkSection>
  );
}
