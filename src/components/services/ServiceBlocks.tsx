import { Link } from "@tanstack/react-router";
import { VideoPlayer } from "@/components/work/VideoPlayer";
import { useState } from "react";
import { PortfolioCard, PORTFOLIO_GRID } from "@/components/work/PortfolioCard";
import type { ServiceMedia } from "@/lib/services";
import type { WorkCard } from "@/lib/work.functions";
import { cn } from "@/lib/utils";

/** Poster-first media: images lazy-load (unless priority), videos mount only on click. */
export function ServiceMediaView({ media, title, className, priority }: { media: ServiceMedia; title: string; className?: string; priority?: boolean }) {
  if (media.type === "image")
    return (
      <img src={media.url} alt={media.alt || title} loading={priority ? "eager" : "lazy"} decoding="async" {...(priority ? { fetchPriority: "high" as const } : {})}
        className={cn("w-full rounded-[6px] bg-muted/10 object-cover", className)} />
    );
  return <VideoPlayer type={media.type} url={media.url} poster={media.poster || null} title={title} mode="controls" className={cn("rounded-[6px]", className)} />;
}

/** Up to six real, published projects. Caller hides this when empty. */
export function RelatedWork({ items, heading = "Selected work" }: { items: WorkCard[]; heading?: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <h2 className="text-h2 text-foreground">{heading}</h2>
        <Link to="/work" className="text-small shrink-0 font-medium text-muted-foreground hover:text-foreground">All work →</Link>
      </div>
      <ul className={cn("mt-8", PORTFOLIO_GRID)}>
        {items.map((c) => (
          <li key={c.id} className="min-w-0">
            <PortfolioCard slug={c.slug} title={c.title} label={c.category?.name ?? c.services[0]?.name} client={c.client} media={c.media}
              playing={playing === c.id} onPreview={(on) => setPlaying(on ? c.id : null)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Numbered editorial list used by "What we create" and "Process". */
export function NumberedList({ items, ordered }: { items: { label: string; description: string }[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className="grid border-t border-border sm:grid-cols-2">
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`} className="flex gap-5 border-b border-border py-6 sm:odd:pr-8 sm:even:border-l sm:even:pl-8">
          <span aria-hidden className="text-caption mt-1 w-6 shrink-0 font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <p className="text-h4 font-medium text-foreground">{it.label}</p>
            {it.description && <p className="text-small mt-2 text-muted-foreground">{it.description}</p>}
          </div>
        </li>
      ))}
    </Tag>
  );
}
