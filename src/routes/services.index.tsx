import { canonical } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { ServiceMediaView } from "@/components/services/ServiceBlocks";
import { siteChromeQuery } from "@/lib/navigation";
import { servicesIndexQuery, type GroupBlock } from "@/lib/services.functions";
import { buttonVariants } from "@/components/ui/brand-button";
import { cn } from "@/lib/utils";

const TITLE = "Services | Branta Tech";
const DESC = "Branta brings creative production, digital products and automation together under one team.";

export const Route = createFileRoute("/services/")({
  head: () => ({ links: canonical("/services"),
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(servicesIndexQuery)]),
  errorComponent: () => <p className="p-8">Something went wrong loading our services.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: ServicesPage,
});

function ServicesPage() {
  const { data: groups } = useSuspenseQuery(servicesIndexQuery);
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="services-title">
        <Eyebrow>WHAT WE DO</Eyebrow>
        <h1 id="services-title" className="text-display-xl mt-6 max-w-[14ch] text-foreground">Creative. AI. Technology.</h1>
        <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">{DESC}</p>
        {groups.length > 0 && (
          <nav aria-label="Service groups" className="mt-14 border-t border-border pt-6">
            <ol className="flex flex-wrap gap-x-8 gap-y-3">
              {groups.map((g, i) => (
                <li key={g.slug}>
                  <a href={`#${g.slug}`} className="text-small text-muted-foreground hover:text-foreground">
                    <span className="mr-2 font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>{g.name}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </Section>
      {groups.map((g, i) => <GroupSection key={g.slug} g={g} i={i} />)}
    </SiteShell>
  );
}

function GroupSection({ g, i }: { g: GroupBlock; i: number }) {
  const dark = i % 2 === 1;
  const flip = i % 2 === 1;
  const services = g.services.slice(0, 6);
  return (
    <Section tone={dark ? "dark" : "warm"} id={g.slug} aria-labelledby={`g-${g.slug}`} className="scroll-mt-20 border-t border-border">
      <div className={cn("grid gap-10 lg:grid-cols-12 lg:gap-16", !g.media && "lg:items-start")}>
        <div className={cn("min-w-0", g.media ? "lg:col-span-5" : "lg:col-span-6", flip && g.media && "lg:order-2")}>
          <p className="text-caption font-mono text-accent">{String(i + 1).padStart(2, "0")}</p>
          <h2 id={`g-${g.slug}`} className="text-display mt-4 break-words text-foreground">{g.name}</h2>
          {(g.short || g.description) && <p className="text-body-lg mt-6 max-w-lg text-muted-foreground">{g.short || g.description}</p>}
          <Link to="/services/$slug" params={{ slug: g.slug }} className={cn(buttonVariants({ variant: dark ? "secondary" : "primary", size: "lg" }), "mt-10 h-auto min-h-12 max-w-full whitespace-normal py-3 text-center")}>
            Explore {g.name}<span aria-hidden className="ml-1">→</span>
          </Link>
        </div>
        {g.media && (
          <div className={cn("lg:col-span-7", flip && "lg:order-1")}>
            <ServiceMediaView media={g.media} title={g.name} className="aspect-[4/3]" />
          </div>
        )}
        {services.length > 0 && (
          <ul className={cn("grid border-t border-border sm:grid-cols-2", g.media ? "lg:col-span-12" : "lg:col-span-6 lg:mt-2")}>
            {services.map((s) => (
              <li key={s.slug} className="border-b border-border">
                <Link to="/services/$slug" params={{ slug: s.slug }} className="group flex min-h-14 items-center justify-between gap-4 py-4 pr-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <span className="text-h4 text-foreground">{s.name}</span>
                  <span aria-hidden className="text-accent opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
