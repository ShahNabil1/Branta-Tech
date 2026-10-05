import { SoundToggle, useVideoSound } from "@/components/media/SoundToggle";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { vimeoId } from "@/lib/hero";
import type { Aspect, Position, SectionMediaItem } from "@/lib/section-media";

const ASPECT_CLS: Record<Aspect, string> = {
  "16:9": "aspect-video", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "4:3": "aspect-[4/3]",
  portrait: "aspect-[9/16]", wide: "aspect-[21/9]", full: "",
};
const POS_CLS: Record<Position, string> = {
  center: "object-center", top: "object-top", bottom: "object-bottom", left: "object-left", right: "object-right",
};

function useInView(ref: React.RefObject<Element | null>) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setV(!!e?.isIntersecting), { rootMargin: "150px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return v;
}
function useMotionAllowed() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !save);
  }, []);
  return ok;
}

/**
 * One public renderer for CMS media (image / direct video / Vimeo). Poster-first: the poster shows
 * immediately and video fades in only once playing; failures stay on the poster or a neutral placeholder.
 * Players mount only while in view. `fill` makes it cover its parent (backgrounds).
 */
export function SectionMedia({ item, className, fill, decorative, eager }: {
  item: SectionMediaItem; className?: string; fill?: boolean; decorative?: boolean; eager?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const motionOk = useMotionAllowed();
  const [playing, setPlaying] = useState(false);
  const [imgBad, setImgBad] = useState(false);
  const [posterBad, setPosterBad] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const alt = decorative ? "" : item.alt;
  const fit = cn("absolute inset-0 size-full object-cover", POS_CLS[item.position]);
  const run = inView && motionOk && item.autoplay && item.type !== "image";
  const vId = item.type === "vimeo" ? vimeoId(item.url) : null;
  const vs = useVideoSound({ kind: "vimeo", ref: frame }, run && playing && !!vId);
  const hs = useVideoSound({ kind: "video", ref: vid }, run && playing && item.type === "video");
  const snd = vId ? vs : hs;

  useEffect(() => { if (!run) setPlaying(false); }, [run]);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (run) v.play().catch(() => setPlaying(false)); else v.pause();
  }, [run]);
  useEffect(() => {
    if (!run || !vId) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com" || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string } = {};
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === "ready") for (const ev of ["play", "timeupdate"]) frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: ev }), "https://player.vimeo.com");
      if (d.event === "play" || d.event === "timeupdate" || d.event === "playProgress") setPlaying(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [run, vId]);

  const poster = item.type === "image" ? (imgBad ? "" : item.url) : (posterBad ? "" : item.poster_url);
  return (
    <div
      ref={box}
      role={decorative ? "presentation" : undefined}
      aria-hidden={decorative || undefined}
      className={cn("relative overflow-hidden bg-muted", fill ? "absolute inset-0" : ASPECT_CLS[item.aspect] || "aspect-video", className)}
    >
      {poster && (
        <img
          src={poster} alt={item.type === "image" ? alt : ""} decoding="async" loading={eager ? "eager" : "lazy"}
          onError={() => (item.type === "image" ? setImgBad(true) : setPosterBad(true))} className={fit}
        />
      )}
      {item.type === "video" && (
        <video
          ref={vid} src={inView ? item.url : undefined} poster={poster || undefined} muted
          loop={item.loop} playsInline preload="none" aria-label={alt || undefined} onPlaying={() => setPlaying(true)}
          onError={() => setPlaying(false)}
          className={cn(fit, "transition-opacity duration-500", playing ? "opacity-100" : "opacity-0")}
        />
      )}
      {run && vId && (
        <iframe
          ref={frame} title={alt || item.label || "Video"} tabIndex={-1}
          src={`https://player.vimeo.com/video/${vId}?background=1&autoplay=1&muted=1&loop=${item.loop ? 1 : 0}&autopause=0&dnt=1`}
          allow="autoplay; fullscreen; picture-in-picture"
          className={cn("pointer-events-none absolute inset-0 size-full scale-[1.02] border-0 transition-opacity duration-500", playing ? "opacity-100" : "opacity-0")}
        />
      )}
      {!decorative && !fill && run && playing && <SoundToggle on={snd.on} onToggle={snd.toggle} />}
    </div>
  );
}
