import { canonical } from "@/lib/seo";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteShell } from "@/components/layout/SiteShell";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { WorkMediaView } from "@/components/home/FeaturedWork";
import { siteChromeQuery } from "@/lib/navigation";
import { workListQuery, type WorkCard } from "@/lib/work.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/work/")({
  validateSearch: z.object({ filter: z.string().regex(/^[a-z0-9-]+$/).optional().catch(undefined) }),
  head: () => ({ links: canonical("/work"),
    meta: [
      { title: "Work — Branta Tech" },
      { name: "description", content: "Films, campaigns, AI visuals, brands, websites and digital products created by Branta Tech." },
      { property: "og:title", content: "Work — Branta Tech" },
      { property: "og:description", content: "Explore films, campaigns, visuals, brands, websites and digital products created by Branta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(workListQuery)]),
  errorComponent: () => <p className="p-8">Something went wrong loading our work.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: WorkPage,
});

/** Editorial rhythm by column span; aspect follows the real media orientation. */
const SPANS = [12, 7, 5, 5, 7, 4, 4, 4];
function slot(c: WorkCard, i: number) {
  const span = SPANS[i % SPANS.length]!;
  const o = c.media?.orientation;
  const aspect = span === 12 ? "aspect-[16/9] md:aspect-[21/9]"
    : o === "portrait" ? "aspect-[4/5]"
    : o === "square" ? "aspect-square"
    : span >= 7 ? "aspect-[16/10]" : "aspect-[4/3]";
  const col = { 12: "md:col-span-12", 7: "md:col-span-7", 5: "md:col-span-5", 4: "md:col-span-4" }[span]!;
  return { col, aspect };
}

const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Card({ c, i, playing, setPlaying }: { c: WorkCard; i: number; playing: boolean; setPlaying: (id: string | null) => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { col, aspect } = slot(c, i);
  useEffect(() => {
    if (!playing || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting) setPlaying(null); });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [playing, setPlaying]);
  const meta = [c.client, c.category?.name, c.year].filter(Boolean).join(" · ");
  const on = () => canHover() && setPlaying(c.id);
  return (
    <li className={cn("min-w-0", col)}>
      <Link ref={ref} to="/work/$slug" params={{ slug: c.slug }} onMouseEnter={on} onMouseLeave={() => setPlaying(null)} onFocus={on} onBlur={() => setPlaying(null)}
        className="group block rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <div className={cn("relative overflow-hidden rounded-[4px] bg-muted/10", aspect)}>
          <WorkMediaView media={c.media} title={c.title} playing={playing} />
        </div>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-h4 font-medium text-foreground">{c.title}</h2>
            {meta && <p className="text-caption mt-1 text-muted-foreground">{meta}</p>}
            {c.services.length > 0 && <p className="text-caption mt-1 text-muted-foreground/80">{c.services.slice(0, 3).map((s) => s.name).join(" · ")}</p>}
          </div>
          <span aria-hidden className="mt-1 text-accent opacity-60 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">→</span>
        </div>
      </Link>
    </li>
  );
}

function WorkPage() {
  const { data } = useSuspenseQuery(workListQuery);
  const { filter } = Route.useSearch();
  const navigate = useNavigate({ from: "/work/" });
  const [playing, setPlaying] = useState<string | null>(null);
  const active = data.filters.some((f) => f.slug === filter) ? filter! : null;
  const items = active ? data.items.filter((c) => c.category?.slug === active || c.services.some((s) => s.slug === active)) : data.items;
  const setFilter = (slug: string | null) => { setPlaying(null); void navigate({ search: slug ? { filter: slug } : {}, replace: true, resetScroll: false }); };
  const chip = (on: boolean) => cn("text-small shrink-0 rounded-full border px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent",
    on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground");

  return (
    <SiteShell>
      <DarkSection aria-labelledby="work-title" className="pb-12 md:pb-16">
        <Eyebrow>OUR WORK</Eyebrow>
        <h1 id="work-title" className="text-display-xl mt-6 max-w-5xl text-foreground">Ideas Made Visible.<br />Systems Made Real.</h1>
        <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">Explore films, campaigns, visuals, brands, websites and digital products created by Branta.</p>
      </DarkSection>
      <Section className="pt-10 md:pt-14" aria-label="Projects">
        {data.filters.length > 0 && (
          <div role="group" aria-label="Filter work" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            <button type="button" aria-pressed={!active} onClick={() => setFilter(null)} className={chip(!active)}>All</button>
            {data.filters.map((f) => (
              <button key={f.slug} type="button" aria-pressed={active === f.slug} onClick={() => setFilter(f.slug)} className={chip(active === f.slug)}>{f.name}</button>
            ))}
          </div>
        )}
        <p className="text-caption mt-6 text-muted-foreground" aria-live="polite">{items.length} {items.length === 1 ? "project" : "projects"}</p>
        {items.length ? (
          <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-14 md:grid-cols-12 md:gap-y-20">
            {items.map((c, i) => <Card key={c.id} c={c} i={i} playing={playing === c.id} setPlaying={setPlaying} />)}
          </ul>
        ) : (
          <p className="text-body mt-10 text-muted-foreground">Published work will appear here.</p>
        )}
      </Section>
    </SiteShell>
  );
}
