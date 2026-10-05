import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrantaVideo } from "@/components/media/BrantaVideo";
import { cn } from "@/lib/utils";
import type { WorkMedia } from "@/lib/featured-work.functions";

/**
 * The single public portfolio card. Every project preview on the site uses it.
 * Media is always a 16:9 frame with object-cover; variants only change width/metadata.
 */

const COVER_POS: Record<string, string> = { center: "object-center", top: "object-top", bottom: "object-bottom", left: "object-left", right: "object-right" };

export function canHoverPreview() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Poster-first media inside a parent 16:9 frame. Video/Vimeo mounts only while `playing`. */
export function WorkMediaView({ media: m, title, alt, playing }: { media: WorkMedia | null; title: string; alt?: string; playing: boolean }) {
  if (!m) return <div className="text-caption flex h-full w-full items-center justify-center bg-muted/10 text-muted-foreground">Media coming soon</div>;
  const poster = m.type === "image" ? m.url : m.poster;
  const pos = COVER_POS[m.position ?? "center"] ?? "object-center";
  return (
    <>
      {poster ? (
        <img src={poster} alt={alt ?? m.alt ?? title} loading="lazy" decoding="async" draggable={false}
          className={cn("absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100", pos)} />
      ) : <div className="absolute inset-0 bg-muted/10" />}
      {(m.type === "vimeo" || m.type === "video") && playing && (
        <BrantaVideo kind={m.type} url={m.url} poster={null} alt="" priority="lazy" active={playing} cover objectPosition={pos} className="[&>div:first-child]:hidden" />
      )}
    </>
  );
}

export type PortfolioCardProps = {
  slug: string;
  title: string;
  label?: string | null | undefined;
  client?: string | null;
  media: WorkMedia | null;
  /** Preview state (only one card plays at a time — owned by the parent). */
  playing?: boolean;
  onPreview?: ((on: boolean) => void) | undefined;
  /** Width class for rails; grids leave this empty to fill their column. */
  className?: string;
  headingLevel?: "h2" | "h3";
  onFocusScroll?: boolean;
  /** When set, clicking opens an inline player instead of navigating. */
  onActivate?: (() => void) | undefined;
  selected?: boolean;
};

export function PortfolioCard({ slug, title, label, client, media, playing = false, onPreview, className, headingLevel = "h3", onFocusScroll, onActivate, selected }: PortfolioCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!playing || !ref.current || !onPreview) return;
    const io = new IntersectionObserver(([e]) => { if (e && e.intersectionRatio < 0.5) onPreview(false); }, { threshold: [0, 0.5] });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [playing, onPreview]);
  const start = () => onPreview && canHoverPreview() && onPreview(true);
  const stop = () => onPreview?.(false);
  const H = headingLevel;
  return (
    <Link ref={ref} to="/work/$slug" params={{ slug }} draggable={false}
      onClick={onActivate ? (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onActivate(); } : undefined}
      aria-current={selected || undefined}
      onMouseEnter={start} onMouseLeave={stop} onBlur={stop}
      onFocus={(e) => { if (onFocusScroll) e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); start(); }}
      className={cn("group block min-w-0 rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent", className)}>
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-[4px] bg-muted/10", selected && "ring-2 ring-accent ring-offset-2 ring-offset-background")}>
        <WorkMediaView media={media} title={title} playing={playing} />
      </div>
      <div className="mt-3 flex min-h-[4.25rem] items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption flex h-4 items-center gap-2 truncate uppercase tracking-wide text-muted-foreground">
            {label && <><span aria-hidden className="size-1 shrink-0 rounded-full bg-accent" /><span className="truncate">{label}</span></>}
          </p>
          <H className="text-body mt-1 line-clamp-2 font-medium text-foreground/85 transition-colors duration-300 group-hover:text-foreground">{title}</H>
          {client && <p className="text-caption mt-0.5 truncate text-muted-foreground">{client}</p>}
        </div>
        <span aria-hidden className="mt-5 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:opacity-100">→</span>
      </div>
    </Link>
  );
}

/** Uniform grid used by /work, Related work, Services and Web & Software. */
export const PORTFOLIO_GRID = "grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 md:gap-y-10";
/** Fixed rail width so every moving/scrolling card is identical. */
export const PORTFOLIO_RAIL_W = "w-[78vw] max-w-[340px] sm:w-[320px] md:w-[340px]";
