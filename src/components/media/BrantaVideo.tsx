/**
 * BrantaVideo — the single public video engine (Vimeo + direct MP4/WebM).
 *
 * Sequence everywhere: poster visible → player prepares behind it → muted playback confirmed
 * (Vimeo "timeupdate"/"play" or <video> "playing") → poster fades out. Failures, blocked autoplay
 * or reduced motion keep the poster and show a small Play button; nothing black or broken shows.
 *
 * Priority:
 *  - critical: first-screen video. Player mounts right after hydration, poster fetched eagerly.
 *  - high:     prepares ~900px before entering the viewport.
 *  - lazy:     poster only until near the viewport (or interaction); stays poster-first on Save-Data / 2G.
 * Once mounted a player is kept (paused off-screen, resumed on return) so scrolling back is instant;
 * it unmounts only when `active` turns false (e.g. a capability tab switch, card hover ending).
 */
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { SoundToggle, useVideoSound } from "@/components/media/SoundToggle";
import { vimeoId } from "@/lib/hero";
import { cn } from "@/lib/utils";

export type VideoPriority = "critical" | "high" | "lazy";
export const PRIORITY_OPTIONS: [VideoPriority | "auto", string][] = [["auto", "Automatic"], ["critical", "Load immediately"], ["high", "Load early"], ["lazy", "Load when needed"]];
export const parsePriority = (v: unknown): VideoPriority | "auto" => (v === "critical" || v === "high" || v === "lazy" ? v : "auto");
export const resolvePriority = (v: VideoPriority | "auto" | undefined, fallback: VideoPriority): VideoPriority => (!v || v === "auto" ? fallback : v);

const ORIGIN = "https://player.vimeo.com";
const MARGIN: Record<VideoPriority, string> = { critical: "1200px", high: "900px", lazy: "250px" };

type Env = { motion: boolean; slow: boolean; ready: boolean };
function useEnv(): Env {
  const [env, setEnv] = useState<Env>({ motion: false, slow: false, ready: false });
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    setEnv({ motion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, slow: !!c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? ""), ready: true });
  }, []);
  return env;
}

export type BrantaVideoProps = {
  kind: "vimeo" | "video";
  url: string;
  poster?: string | null | undefined;
  alt?: string;
  priority?: VideoPriority;
  autoplay?: boolean;
  loop?: boolean;
  /** Full Vimeo/native controls instead of background playback (user-driven films). */
  controls?: boolean;
  /** External gate (active tab, hovered card). false unmounts the player. */
  active?: boolean;
  /** Show the sound toggle once playing (large primary media only). */
  sound?: boolean;
  /** Show a Play button when autoplay is off, blocked, or reduced motion. */
  playButton?: boolean;
  /** Oversize the Vimeo frame to hide letterboxing in cover crops. */
  cover?: boolean;
  objectPosition?: string;
  className?: string;
  onPlayingChange?: (playing: boolean) => void;
};

export function BrantaVideo({
  kind, url, poster, alt = "", priority = "lazy", autoplay = true, loop = true, controls = false, active = true,
  sound = false, playButton = false, cover = false, objectPosition = "object-center", className, onPlayingChange,
}: BrantaVideoProps) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const env = useEnv();
  const id = kind === "vimeo" ? vimeoId(url) : null;
  const valid = kind === "vimeo" ? !!id : /^https:\/\/|^\//.test(url);

  const [near, setNear] = useState(priority === "critical");
  const [visible, setVisible] = useState(true);
  const [manual, setManual] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [posterBad, setPosterBad] = useState(false);

  // Viewport awareness: one observer for "prepare" (generous margin), one for "on screen" (pause/resume).
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const prep = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setNear(true); prep.disconnect(); } }, { rootMargin: MARGIN[priority] });
    const vis = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: "80px" });
    prep.observe(el); vis.observe(el);
    return () => { prep.disconnect(); vis.disconnect(); };
  }, [priority]);

  const auto = autoplay && env.motion && !(env.slow && priority !== "critical");
  const want = env.ready && valid && !failed && active && near && (manual || auto);
  useEffect(() => { if (want) setMounted(true); }, [want]);
  useEffect(() => { if (!active) { setMounted(false); setManual(false); } }, [active]);
  useEffect(() => { if (!mounted) { setPlaying(false); setStalled(false); } }, [mounted]);
  useEffect(() => { onPlayingChange?.(playing); }, [playing, onPlayingChange]);

  // Autoplay blocked / slow start: poster stays, a play control appears after a grace period.
  useEffect(() => {
    if (!mounted || playing) return;
    const t = window.setTimeout(() => setStalled(true), priority === "critical" ? 9000 : 7000);
    return () => window.clearTimeout(t);
  }, [mounted, playing, priority]);

  // Vimeo: listen for real playback; pause when off-screen, resume on return.
  const post = (method: string, value?: unknown) => frame.current?.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), ORIGIN);
  useEffect(() => {
    if (!mounted || !id) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string; data?: { seconds?: number } } = {};
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === "ready") { for (const ev of ["play", "timeupdate", "error"]) post("addEventListener", ev); post("play"); }
      if (d.event === "timeupdate" || d.event === "playProgress" || d.event === "play") setPlaying(true);
      if (d.event === "error") { setFailed(true); setMounted(false); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mounted, id]);
  useEffect(() => {
    if (!mounted) return;
    if (id) { post(visible ? "play" : "pause"); return; }
    const v = vid.current;
    if (!v) return;
    if (visible) v.play().catch(() => setStalled(true)); else v.pause();
  }, [mounted, visible, id]);

  const snd = useVideoSound(id ? { kind: "vimeo", ref: frame } : { kind: "video", ref: vid }, mounted && playing);
  const start = () => { setFailed(false); setStalled(false); setManual(true); setMounted(true); vid.current?.play().catch(() => setStalled(true)); };

  const showPoster = !!poster && !posterBad;
  const fade = "transition-opacity duration-700 ease-[var(--ease-out-expo)]";
  const params = controls
    ? `autoplay=1&muted=1&playsinline=1&dnt=1&title=0&byline=0&portrait=0&loop=${loop ? 1 : 0}`
    : `background=1&autoplay=1&muted=1&playsinline=1&loop=${loop ? 1 : 0}&autopause=0&dnt=1`;

  return (
    <div ref={box} className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Branded fallback under everything: never a black or empty panel. */}
      <div aria-hidden className="absolute inset-0 bg-ink bg-[radial-gradient(60%_60%_at_70%_40%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)]" />
      {showPoster && (
        <img src={poster!} alt={alt} decoding="async" draggable={false}
          loading={priority === "lazy" ? "lazy" : "eager"} {...(priority === "critical" ? { fetchPriority: "high" as const } : {})}
          onError={() => setPosterBad(true)}
          className={cn("absolute inset-0 size-full object-cover", objectPosition, fade, playing && !controls ? "opacity-0" : "opacity-100")} />
      )}
      {mounted && id && (
        <iframe ref={frame} title={alt || "Video"} src={`${ORIGIN}/video/${id}?${params}`}
          allow="autoplay; fullscreen; picture-in-picture" allowFullScreen={controls}
          {...(controls ? {} : { tabIndex: -1, "aria-hidden": true })}
          className={cn("absolute border-0", fade, cover ? "left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2" : "inset-0 size-full scale-[1.02]", !controls && "pointer-events-none", playing ? "opacity-100" : "opacity-0")} />
      )}
      {mounted && kind === "video" && (
        <video ref={vid} src={url} poster={showPoster ? poster! : undefined} muted loop={loop} playsInline autoPlay
          preload={priority === "critical" ? "auto" : "metadata"} controls={controls && playing} aria-label={alt || undefined}
          onPlaying={() => setPlaying(true)} onError={() => { setFailed(true); setMounted(false); }}
          className={cn("absolute inset-0 size-full object-cover", objectPosition, fade, playing ? "opacity-100" : "opacity-0")} />
      )}
      {playButton && valid && !playing && (!mounted || stalled || failed) && (
        <button type="button" onClick={start} aria-label={alt ? `Play ${alt}` : "Play video"}
          className="absolute left-1/2 top-1/2 z-20 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink/45 text-ink-foreground backdrop-blur-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Play className="ml-0.5 size-6" aria-hidden />
        </button>
      )}
      {sound && mounted && playing && !controls && <SoundToggle on={snd.on} onToggle={snd.toggle} />}
    </div>
  );
}
