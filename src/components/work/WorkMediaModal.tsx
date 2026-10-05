import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BrantaVideo } from "@/components/media/BrantaVideo";
import type { WorkCard } from "@/lib/work.functions";

/**
 * The single project media popup for homepage work cards. One player exists only while open;
 * video always starts muted (sound only via the toggle). Radix handles focus trap, Escape,
 * backdrop close, scroll lock and focus return to the clicked card.
 */
export function WorkMediaModal({ card, onClose }: { card: WorkCard | null; onClose: () => void }) {
  const m = card?.media ?? null;
  const isVideo = !!m && (m.type === "vimeo" || m.type === "video");
  const poster = m ? (m.type === "image" ? m.url : m.poster) : null;
  const label = card ? card.category?.name ?? card.services[0]?.name ?? null : null;
  return (
    <DialogPrimitive.Root open={!!card} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-[2px] duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        {card && (
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="dark fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-[1120px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] border border-border bg-background text-foreground shadow-[0_40px_120px_-30px_rgb(0_0_0/0.7)] duration-250 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none">
            <div className="relative aspect-video w-full bg-muted/10">
              {isVideo ? (
                <BrantaVideo key={card.slug} kind={m.type as "vimeo" | "video"} url={m.url} poster={poster} alt={m.alt || card.title}
                  priority="critical" autoplay loop sound playButton active />
              ) : poster ? (
                <img src={poster} alt={m?.alt || card.title} className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <div className="text-caption flex h-full items-center justify-center text-muted-foreground">Media coming soon</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-6">
              <div className="min-w-0">
                {label && <p className="text-caption flex items-center gap-2 uppercase tracking-wide text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-accent" />{label}</p>}
                <DialogPrimitive.Title className="text-h4 mt-1 truncate text-foreground">{card.title}</DialogPrimitive.Title>
                {card.client && <p className="text-small text-muted-foreground">{card.client}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Link to="/work/$slug" params={{ slug: card.slug }} onClick={onClose}
                  className="text-small group inline-flex min-h-11 items-center gap-2 font-medium text-foreground underline decoration-accent underline-offset-8 hover:text-accent">
                  View Case Study<span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
                <DialogPrimitive.Close aria-label="Close video"
                  className="inline-flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                  <X className="size-5" aria-hidden />
                </DialogPrimitive.Close>
              </div>
            </div>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
