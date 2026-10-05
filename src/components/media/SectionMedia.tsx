import { BrantaVideo, resolvePriority, type VideoPriority } from "@/components/media/BrantaVideo";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Aspect, Position, SectionMediaItem } from "@/lib/section-media";

const ASPECT_CLS: Record<Aspect, string> = {
  "16:9": "aspect-video", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "4:3": "aspect-[4/3]",
  portrait: "aspect-[9/16]", wide: "aspect-[21/9]", full: "",
};
const POS_CLS: Record<Position, string> = {
  center: "object-center", top: "object-top", bottom: "object-bottom", left: "object-left", right: "object-right",
};

/**
 * One public renderer for CMS media (image / direct video / Vimeo). Videos go through BrantaVideo
 * (poster-first, priority loading, sound). `fill` covers the parent (backgrounds); `eager` = first-screen media.
 */
export function SectionMedia({ item, className, fill, decorative, eager, priority }: {
  item: SectionMediaItem; className?: string; fill?: boolean; decorative?: boolean; eager?: boolean; priority?: VideoPriority;
}) {
  const [imgBad, setImgBad] = useState(false);
  const alt = decorative ? "" : item.alt;
  const pos = POS_CLS[item.position];
  return (
    <div role={decorative ? "presentation" : undefined} aria-hidden={decorative || undefined}
      className={cn("relative overflow-hidden bg-muted", fill ? "absolute inset-0" : ASPECT_CLS[item.aspect] || "aspect-video", className)}>
      {item.type === "image" ? (
        !imgBad && <img src={item.url} alt={alt} decoding="async" loading={eager ? "eager" : "lazy"} onError={() => setImgBad(true)} className={cn("absolute inset-0 size-full object-cover", pos)} />
      ) : (
        <BrantaVideo kind={item.type} url={item.url} poster={item.poster_url} alt={alt || item.label}
          priority={resolvePriority(item.priority, priority ?? (eager ? "critical" : "high"))}
          autoplay={item.autoplay} loop={item.loop} objectPosition={pos}
          playButton={!decorative && !fill} sound={!decorative && !fill && item.sound_control} />
      )}
    </div>
  );
}
