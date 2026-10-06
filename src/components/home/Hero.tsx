import { BrantaVideo } from "@/components/media/BrantaVideo";
import { SmartLink } from "@/components/layout/SiteHeader";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/brand-button";
import { MaskReveal, Reveal } from "@/components/motion/Reveal";
import { SiteContainer } from "@/components/layout/primitives";
import { type HeroContent, type HeroMediaItem, type HeroMediaRole } from "@/lib/hero";

/* ---------- helpers ---------- */

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/** Small scroll parallax (max ±`max` px). */
function useParallax<T extends HTMLElement>(max = 24) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      el.style.transform = `translate3d(0, ${(-p * max).toFixed(1)}px, 0)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener("scroll", on, { passive: true });
    tick();
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); el.style.transform = ""; };
  }, [max, reduced]);
  return ref;
}

function DeferredMediaTile({ item, ratio, className }: { item: HeroMediaItem; ratio: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setNear(true); io.disconnect(); }
    }, { rootMargin: "160px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("relative overflow-hidden rounded-md bg-muted", className)} style={{ aspectRatio: ratio }}>
      {near && <MediaTile item={item} ratio={ratio} className="absolute inset-0" />}
    </div>
  );
}

export function HeroAction({ label, url, variant }: { label: string; url: string; variant: "primary" | "secondary" }) {
  if (!label) return null;
  const cls = cn(buttonVariants({ variant, size: "lg" }));
  // SmartLink activates internal links only when the page (or published service) exists; otherwise inactive.
  return (
    <SmartLink url={url} className={cls} pendingClassName="cursor-not-allowed opacity-60">
      {label}<span aria-hidden className="ml-1">→</span>
    </SmartLink>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-caption pointer-events-none absolute bottom-3 left-3 z-10 rounded-[3px] bg-ink/70 px-2 py-1 font-medium text-ink-foreground backdrop-blur-sm">
      {children}
    </span>
  );
}

/* ---------- tiles ---------- */

/** Neutral frame shown while loading or when media is unavailable — never a broken icon or raw alt text. */
function Placeholder() {
  return <div aria-hidden className="absolute inset-0 bg-muted" />;
}

function SafeImg({ src, alt, priority, className, onFail }: { src: string; alt: string; priority?: boolean | undefined; className?: string | undefined; onFail?: (() => void) | undefined }) {
  const [ok, setOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { setOk(true); setLoaded(false); const el = ref.current; if (el?.complete) { if (el.naturalWidth) setLoaded(true); else { setOk(false); onFail?.(); } } }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!src || !ok) return null;
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => { setOk(false); onFail?.(); }}
      className={cn("absolute inset-0 size-full object-cover text-transparent transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
    />
  );
}

/**
 * One tile for any media type. Slot (ratio) comes from the role; type only changes what renders inside.
 * Videos use BrantaVideo: the main film is critical (prepares on load, mobile included), other tiles load early.
 */
function MediaTile({ item, ratio, priority, className }: { item: HeroMediaItem; ratio: string; priority?: boolean | undefined; className?: string | undefined }) {
  const isVideo = item.type === "video" || item.type === "vimeo";
  return (
    <figure className={cn("media-zoom relative overflow-hidden rounded-md bg-muted", className)} style={{ aspectRatio: ratio }}>
      <Placeholder />
      {item.type === "image" && <SafeImg src={item.url} alt={item.alt} priority={priority} />}
      {isVideo && (
        <BrantaVideo kind={item.type as "video" | "vimeo"} url={item.url} poster={item.poster_url} alt={item.alt || item.label}
          priority={priority ? "critical" : "high"} autoplay={item.autoplay} loop={item.loop} controls={!item.autoplay}
          playButton={!item.autoplay || !!priority} sound={!!priority && item.autoplay} />
      )}
      {item.label && <Label>{item.label}</Label>}
    </figure>
  );
}

/* ---------- hero ---------- */

function Headline({ title }: { title: string }) {
  const lines = title.includes("\n")
    ? title.split("\n").map((l) => l.trim()).filter(Boolean)
    : title.trim().split(/\s+/).reduce<string[]>((acc, w, i) => {
        if (i % 2 === 0) acc.push(w); else acc[acc.length - 1] += ` ${w}`;
        return acc;
      }, []);
  return (
    <h1 className="text-hero">
      {lines.map((line, i) => {
        const last = i === lines.length - 1;
        const dot = last && line.endsWith(".");
        return (
          <span key={i} className="block">
            <MaskReveal delay={i * 110}>
              {dot ? <>{line.slice(0, -1)}<span className="text-accent">.</span></> : line}
            </MaskReveal>
          </span>
        );
      })}
    </h1>
  );
}

export function HomeHero({ hero }: { hero: HeroContent }) {
  const by = (r: HeroMediaRole) => hero.media.find((m) => m.role === r);
  const film = by("film");
  const fashion = by("fashion");
  const product = by("product");
  const ugc = by("ugc");
  const campaign = by("campaign");
  const web = by("web");
  const drift = useParallax<HTMLDivElement>(24);

  const filmTile = film && <MediaTile item={film} ratio="16/9" priority />;

  const capabilities = hero.capabilities.length > 0 && (
    <Reveal delay={360}>
      <ul className="text-small flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground" aria-label="Capabilities">
        {hero.capabilities.map((c, i) => (
          <li key={c} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden className="h-3 w-px bg-border" />}
            {c}
          </li>
        ))}
      </ul>
    </Reveal>
  );

  return (
    <section className="dark hero-glow relative isolate overflow-hidden pt-12 pb-[var(--section-y)] text-foreground md:pt-16 lg:pt-20">
      <SiteContainer wide>
        <div className="grid gap-12 lg:grid-cols-[44fr_56fr] lg:items-center lg:gap-14 xl:gap-20">
          {/* Copy */}
          <div className="min-w-0">
            {hero.eyebrow && (
              <Reveal>
                <p className="text-eyebrow mb-7 flex items-center gap-2 text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                  {hero.eyebrow}
                </p>
              </Reveal>
            )}
            {hero.title && <Headline title={hero.title} />}
            {hero.body && (
              <Reveal delay={240}>
                <p className="text-body-lg mt-7 max-w-[34rem] text-muted-foreground">{hero.body}</p>
              </Reveal>
            )}
            <Reveal delay={300}>
              <div className="mt-9 flex flex-wrap gap-3">
                <HeroAction label={hero.primary.label} url={hero.primary.url} variant="primary" />
                <HeroAction label={hero.secondary.label} url={hero.secondary.url} variant="secondary" />
              </div>
            </Reveal>
            <div className="mt-10 hidden lg:block">{capabilities}</div>
          </div>

          {/* Media wall */}
          {hero.media.length > 0 && (
            <div className="min-w-0">
              {/* Desktop / tablet-wide */}
              <div className="hidden grid-cols-[2fr_1fr] gap-3 md:grid">
                <div className="grid content-start gap-3">
                  {filmTile && <Reveal delay={150}>{filmTile}</Reveal>}
                  {(product || ugc) && (
                    <div className="grid grid-cols-2 gap-3">
                      {product && <Reveal delay={260}><MediaTile item={product} ratio="4/5" /></Reveal>}
                      {ugc && <Reveal delay={320} className="translate-y-6"><MediaTile item={ugc} ratio="4/5" /></Reveal>}
                    </div>
                  )}
                </div>
                <div ref={drift} className="grid content-start gap-3 pt-14 will-change-transform">
                  {fashion && <Reveal delay={220}><MediaTile item={fashion} ratio="9/14" /></Reveal>}
                  {campaign && <Reveal delay={380}><MediaTile item={campaign} ratio="1/1" /></Reveal>}
                </div>
                {web && <Reveal delay={420} className="col-span-2 mt-6"><MediaTile item={web} ratio="21/9" /></Reveal>}
              </div>

              {/* Mobile */}
              <div className="grid gap-3 md:hidden">
                {filmTile}
                {(fashion || product) && (
                  <div className="grid grid-cols-2 gap-3">
                    {fashion && <DeferredMediaTile item={fashion} ratio="4/5" />}
                    {product && <DeferredMediaTile item={product} ratio="4/5" />}
                  </div>
                )}
                {ugc && <DeferredMediaTile item={ugc} ratio="4/3" />}
                {campaign && !web && <DeferredMediaTile item={campaign} ratio="4/3" />}
                {web && <DeferredMediaTile item={web} ratio="16/10" />}
              </div>
            </div>
          )}

          <div className="lg:hidden">{capabilities}</div>
        </div>
      </SiteContainer>
    </section>
  );
}
