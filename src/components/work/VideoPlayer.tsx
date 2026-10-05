import { BrantaVideo } from "@/components/media/BrantaVideo";
import { cn } from "@/lib/utils";

type Props = { type: "vimeo" | "video"; url: string; poster: string | null; title: string; mode: "background" | "controls"; className?: string };

/**
 * Case-study / service video on top of BrantaVideo.
 * "background": muted loop that prepares early and fades in once playing (sound toggle available).
 * "controls": poster + Play; the full player mounts only on click.
 */
export function VideoPlayer({ type, url, poster, title, mode, className }: Props) {
  const bg = mode === "background";
  return (
    <div className={cn("relative overflow-hidden bg-muted/20", className)}>
      <BrantaVideo kind={type} url={url} poster={poster} alt={`${title} film`} priority={bg ? "high" : "lazy"}
        autoplay={bg} controls={!bg} playButton sound={bg} />
    </div>
  );
}
