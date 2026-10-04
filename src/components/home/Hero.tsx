import { SmartLink } from "@/components/layout/SiteHeader";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/brand-button";
import { MaskReveal, Reveal } from "@/components/motion/Reveal";
import { SiteContainer } from "@/components/layout/primitives";
import { vimeoId, type HeroContent, type HeroMediaItem, type HeroMediaRole } from "@/lib/hero";

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
    if (!el || reduced) return;
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

function ImageTile({ item, ratio, className, priority }: { item: HeroMediaItem; ratio: string; className?: string; priority?: boolean }) {
  return (
    <figure className={cn("media-zoom relative overflow-hidden rounded-md bg-muted", className)} style={{ aspectRatio: ratio }}>
      <img
        src={item.url}
        alt={item.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="size-full object-cover"
      />
      {item.label && <Label>{item.label}</Label>}
    </figure>
  );
}

function VimeoTile({ item, className }: { item: HeroMediaItem; className?: string }) {
  const id = vimeoId(item.url);
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState(false);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  // Initialise quietly after hydration; later on small screens, never with reduced motion / data saver.
  useEffect(() => {
    if (!id || reduced) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    // Only the visible copy (desktop or mobile layout) loads the player.
    if (!wrap.current || wrap.current.offsetParent === null) return;
    const t = window.setTimeout(() => setMount(true), window.innerWidth < 768 ? 2500 : 400);
    return () => window.clearTimeout(t);
  }, [id, reduced]);

  // Listen for the player actually playing, then fade in.
  useEffect(() => {
    if (!mount) return;
    const post = (method: string, value?: string) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(value ? { method, value } : { method }), "https://player.vimeo.com");
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com" || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string } = {};
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === "ready") { post("addEventListener", "play"); post("addEventListener", "timeupdate"); }
      if (d.event === "play" || d.event === "timeupdate" || d.event === "playProgress") setPlaying(true);
    };
    window.addEventListener("message", onMsg);
    // Pause when well outside the viewport.
    const io = new IntersectionObserver(([en]) => post(en?.isIntersecting ? "play" : "pause"), { rootMargin: "200px" });
    if (wrap.current) io.observe(wrap.current);
    return () => { window.removeEventListener("message", onMsg); io.disconnect(); };
  }, [mount]);

  return (
    <div ref={wrap} className={cn("relative overflow-hidden rounded-md bg-muted", className)} style={{ aspectRatio: "16/9" }}>
      {item.poster_url && (
        <img src={item.poster_url} alt={item.alt} fetchPriority="high" loading="eager" decoding="async" className="absolute inset-0 size-full object-cover" />
      )}
      {mount && id && (
        <iframe
          ref={frame}
          title={item.alt || item.label || "Hero film"}
          aria-hidden={!playing}
          tabIndex={-1}
          src={`https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1`}
          allow="autoplay; fullscreen; picture-in-picture"
          className={cn(
            "pointer-events-none absolute inset-0 size-full border-0 transition-opacity duration-[var(--dur-cinematic)] ease-[var(--ease-out-expo)]",
            playing ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {item.label && <Label>{item.label}</Label>}
    </div>
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

  const filmTile = film && (film.type === "vimeo"
    ? <VimeoTile item={film} />
    : <ImageTile item={film} ratio="16/9" priority />);

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
    <section className="dark overflow-hidden bg-background pt-12 pb-[var(--section-y)] text-foreground md:pt-16 lg:pt-20">
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
                      {product && <Reveal delay={260}><ImageTile item={product} ratio="4/5" /></Reveal>}
                      {ugc && <Reveal delay={320} className="translate-y-6"><ImageTile item={ugc} ratio="4/5" /></Reveal>}
                    </div>
                  )}
                </div>
                <div ref={drift} className="grid content-start gap-3 pt-14 will-change-transform">
                  {fashion && <Reveal delay={220}><ImageTile item={fashion} ratio="9/14" /></Reveal>}
                  {campaign && <Reveal delay={380}><ImageTile item={campaign} ratio="1/1" /></Reveal>}
                </div>
                {web && <Reveal delay={420} className="col-span-2 mt-6"><ImageTile item={web} ratio="21/9" /></Reveal>}
              </div>

              {/* Mobile */}
              <div className="grid gap-3 md:hidden">
                {filmTile}
                {(fashion || product) && (
                  <div className="grid grid-cols-2 gap-3">
                    {fashion && <ImageTile item={fashion} ratio="4/5" />}
                    {product && <ImageTile item={product} ratio="4/5" />}
                  </div>
                )}
                {ugc && <ImageTile item={ugc} ratio="4/3" />}
                {campaign && !web && <ImageTile item={campaign} ratio="4/3" />}
                {web && <ImageTile item={web} ratio="16/10" />}
              </div>
            </div>
          )}

          <div className="lg:hidden">{capabilities}</div>
        </div>
      </SiteContainer>
    </section>
  );
}
