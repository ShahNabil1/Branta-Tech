import { Link } from "@tanstack/react-router";
import { formatPostDate, type PostCard } from "@/lib/company.functions";
import { cn } from "@/lib/utils";

function Meta({ p, className }: { p: PostCard; className?: string }) {
  const bits = [p.author?.name, formatPostDate(p.publishedAt)].filter(Boolean);
  if (!bits.length) return null;
  return <p className={cn("text-caption text-muted-foreground", className)}>{bits.join(" · ")}</p>;
}

/** Large lead story: cover left/top, headline beside it. */
export function FeaturedPost({ p }: { p: PostCard }) {
  return (
    <Link to="/insights/$slug" params={{ slug: p.slug }} className="group grid gap-8 lg:grid-cols-12 lg:items-end">
      {p.cover && (
        <div className="overflow-hidden rounded-[6px] lg:col-span-7">
          <img src={p.cover} alt={p.coverAlt} className="media-zoom aspect-[16/10] w-full object-cover" />
        </div>
      )}
      <div className={cn("min-w-0", p.cover ? "lg:col-span-5" : "lg:col-span-9")}>
        {p.category && <p className="text-eyebrow text-accent">{p.category}</p>}
        <h2 className="text-display mt-4 break-words text-foreground group-hover:underline decoration-1 underline-offset-8">{p.title}</h2>
        {p.excerpt && <p className="text-body-lg mt-6 text-muted-foreground">{p.excerpt}</p>}
        <Meta p={p} className="mt-6" />
      </div>
    </Link>
  );
}

/** Supporting story; `size` varies rhythm so the list doesn't read as a uniform grid. */
export function PostTile({ p, size = "md" }: { p: PostCard; size?: "lg" | "md" | "row" }) {
  if (size === "row") {
    return (
      <Link to="/insights/$slug" params={{ slug: p.slug }} className="group grid gap-4 border-t border-border py-8 md:grid-cols-12 md:items-baseline">
        <p className="text-eyebrow text-accent md:col-span-2">{p.category ?? ""}</p>
        <h3 className="text-h3 min-w-0 break-words text-foreground group-hover:text-accent md:col-span-6">{p.title}</h3>
        <div className="md:col-span-4">
          {p.excerpt && <p className="text-small line-clamp-2 text-muted-foreground">{p.excerpt}</p>}
          <Meta p={p} className="mt-2" />
        </div>
      </Link>
    );
  }
  return (
    <Link to="/insights/$slug" params={{ slug: p.slug }} className="group block min-w-0">
      {p.cover && (
        <div className="overflow-hidden rounded-[6px]">
          <img src={p.cover} alt={p.coverAlt} loading="lazy" decoding="async" className={cn("media-zoom w-full object-cover", size === "lg" ? "aspect-[4/5]" : "aspect-[4/3]")} />
        </div>
      )}
      {p.category && <p className="text-eyebrow mt-5 text-accent">{p.category}</p>}
      <h3 className={cn("mt-3 break-words text-foreground group-hover:text-accent", size === "lg" ? "text-h2" : "text-h3")}>{p.title}</h3>
      {p.excerpt && <p className="text-small mt-3 line-clamp-3 text-muted-foreground">{p.excerpt}</p>}
      <Meta p={p} className="mt-4" />
    </Link>
  );
}
