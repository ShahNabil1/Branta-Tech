import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { vimeoId } from "@/lib/hero";
import { cn } from "@/lib/utils";

type Props = { type: "vimeo" | "video"; url: string; poster: string | null; title: string; mode: "background" | "controls"; className?: string };

/**
 * Poster-first video. "background": muted loop, desktop only, mounts near the viewport and fades in once playing.
 * "controls": poster + play button; the player mounts only on click (one real embed per click), with full controls.
 */
export function VideoPlayer({ type, url, poster, title, mode, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const id = type === "vimeo" ? vimeoId(url) : null;

  useEffect(() => {
    if (mode !== "background" || !box.current) return;
    const ok = window.matchMedia("(min-width: 768px) and (hover: hover)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ok) return;
    const io = new IntersectionObserver(([e]) => setMount(!!e?.isIntersecting), { rootMargin: "200px" });
    io.observe(box.current);
    return () => io.disconnect();
  }, [mode]);

  useEffect(() => {
    if (!mount || !id) { setReady(false); return; }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com" || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string } = {};
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === "ready") frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: "play" }), "https://player.vimeo.com");
      if (d.event === "play") setReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mount, id]);

  const src = id
    ? mode === "background"
      ? `https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&dnt=1`
      : `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`
    : null;

  return (
    <div ref={box} className={cn("relative overflow-hidden bg-muted/20", className)}>
      {poster && <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
      {mount && src && (
        <iframe
          ref={frame}
          title={`${title} film`}
          src={src}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          {...(mode === "background" ? { tabIndex: -1, "aria-hidden": true } : {})}
          onLoad={() => mode === "controls" && setTimeout(() => setReady(true), 400)}
          className={cn("absolute inset-0 h-full w-full border-0 transition-opacity duration-700", mode === "background" && "pointer-events-none", ready ? "opacity-100" : "opacity-0")}
        />
      )}
      {mount && type === "video" && (
        <video
          src={url}
          poster={poster ?? undefined}
          {...(mode === "background" ? { muted: true, loop: true, autoPlay: true, "aria-hidden": true } : { controls: true, autoPlay: true })}
          playsInline
          onPlaying={() => setReady(true)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
        />
      )}
      {mode === "controls" && !mount && (
        <button
          type="button"
          onClick={() => setMount(true)}
          aria-label={`Play ${title}`}
          className="group absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 md:size-20">
            <Play className="ml-1 size-6" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
