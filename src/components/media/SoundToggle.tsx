/**
 * Site-wide video sound control. Every public video starts muted; useVideoSound unmutes one
 * HTML5 <video> or Vimeo iframe on request and mutes whichever video had sound before.
 * Sound state is never persisted — each page load starts muted.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

let current: { mute: () => void } | null = null;

type Target = { kind: "video"; ref: RefObject<HTMLVideoElement | null> } | { kind: "vimeo"; ref: RefObject<HTMLIFrameElement | null> };

export function useVideoSound(target: Target, active = true) {
  const [on, setOn] = useState(false);
  const self = useRef<{ mute: () => void } | null>(null);
  const apply = useCallback((sound: boolean) => {
    if (target.kind === "video") {
      const v = target.ref.current;
      if (!v) return;
      v.muted = !sound;
      if (sound && v.volume === 0) v.volume = 1;
      if (sound && v.paused) void v.play().catch(() => {});
    } else {
      const w = target.ref.current?.contentWindow;
      const post = (method: string, value?: unknown) => w?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), "https://player.vimeo.com");
      post("setMuted", !sound);
      post("setVolume", sound ? 1 : 0);
    }
  }, [target.kind, target.ref]);

  const mute = useCallback(() => { apply(false); setOn(false); if (current === self.current) current = null; }, [apply]);
  self.current ??= { mute: () => mute() };
  self.current.mute = mute;

  const toggle = useCallback(() => {
    if (on) return mute();
    if (current && current !== self.current) current.mute();
    current = self.current;
    apply(true); setOn(true);
  }, [on, mute, apply]);

  // Player gone or inactive: forget sound so it restarts muted.
  useEffect(() => { if (!active && on) mute(); }, [active, on, mute]);
  useEffect(() => () => { if (current === self.current) current = null; }, []);
  return { on, toggle };
}

/** Compact bottom-right sound button (44px tap target). Render only once the video is actually playing. */
export function SoundToggle({ on, onToggle, className }: { on: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      aria-pressed={on}
      className={cn(
        "absolute bottom-3 right-3 z-20 flex size-11 items-center justify-center rounded-full bg-ink/45 text-ink-foreground backdrop-blur-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {on ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
    </button>
  );
}
