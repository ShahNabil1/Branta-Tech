import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { DarkSection, Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import type { WebSoftware, WebWork } from "@/lib/web-software.functions";
import { cn } from "@/lib/utils";
import { PortfolioCard, PORTFOLIO_GRID } from "@/components/work/PortfolioCard";

/** Poster first; on desktop the muted background player mounts near the viewport and fades in once Vimeo reports playback. */
function Promo({ id, poster, title }: { id: string | null; poster: string | null; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(false);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "setVolume", value: next ? 1 : 0 }), "https://player.vimeo.com");
  };

  useEffect(() => {
    if (!id || !box.current) return;
    const desktop = window.matchMedia("(min-width: 768px) and (hover: hover)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!desktop || reduce) return;
    const io = new IntersectionObserver(([e]) => setMount(!!e?.isIntersecting), { rootMargin: "200px" });
    io.observe(box.current);
    return () => io.disconnect();
  }, [id]);

  useEffect(() => {
    if (!mount) { setReady(false); return; }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com" || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string } = {};
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === "ready") frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: "play" }), "https://player.vimeo.com");
      if (d.event === "play") setReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mount]);

  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-[6px] bg-muted/10">
      {poster && <img src={poster} alt={`${title} promo film`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
      {mount && id && (
        <iframe
          ref={frame}
          title={`${title} promo film`}
          src={`https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&dnt=1`}
          allow="autoplay; fullscreen"
          tabIndex={-1}
          className={cn("pointer-events-none absolute inset-0 h-full w-full border-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
        />
      )}
      {ready && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={sound ? "Mute film sound" : "Play film sound"}
          aria-pressed={sound}
          className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
        >
          {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}

export function WebSoftwareShowcase({ content }: { content: NonNullable<WebSoftware> }) {
  return (
    <DarkSection aria-labelledby="web-software-title">
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
    </DarkSection>
  );
}
