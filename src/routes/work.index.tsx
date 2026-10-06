import { canonical, pageMeta } from "@/lib/seo";
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteShell } from "@/components/layout/SiteShell";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { PortfolioCard, PORTFOLIO_GRID } from "@/components/work/PortfolioCard";
import { siteChromeQuery } from "@/lib/navigation";
import { workListQuery } from "@/lib/work.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/work/")({
  validateSearch: z.object({ filter: z.string().regex(/^[a-z0-9-]+$/).optional().catch(undefined) }),
  head: () => ({ links: canonical("/work"),
    meta: pageMeta({ title: "Work — Branta Tech", description: "Films, campaigns, AI visuals, brands, websites and digital products created by Branta Tech.", path: "/work" }),
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(workListQuery)]),
  errorComponent: () => <p className="p-8">Something went wrong loading our work.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: WorkPage,
});

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
          <ul className={cn("mt-8", PORTFOLIO_GRID)}>
            {items.map((c) => (
              <li key={c.id} className="min-w-0">
                <PortfolioCard slug={c.slug} title={c.title} label={c.category?.name ?? c.services[0]?.name} client={c.client} media={c.media} headingLevel="h2"
                  playing={playing === c.id} onPreview={(on) => setPlaying(on ? c.id : null)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body mt-10 text-muted-foreground">Published work will appear here.</p>
        )}
      </Section>
    </SiteShell>
  );
}
