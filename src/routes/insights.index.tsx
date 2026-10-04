import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { FeaturedPost, PostTile } from "@/components/content/PostCards";
import { siteChromeQuery } from "@/lib/navigation";
import { insightsQuery } from "@/lib/company.functions";
import { pageMeta, canonical } from "@/lib/seo";

const DESC = "Thoughts on AI, creative production, digital products and automation from the Branta team.";

export const Route = createFileRoute("/insights/")({
  head: () => ({ links: canonical("/insights"), meta: pageMeta({ title: "Insights | Branta Tech", description: DESC }) }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(insightsQuery)]),
  errorComponent: () => <p className="p-8">Something went wrong loading Insights.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: InsightsPage,
});

function InsightsPage() {
  const { data: posts } = useSuspenseQuery(insightsQuery);
  const [lead, ...rest] = posts;
  const pair = rest.slice(0, 2);
  const rows = rest.slice(2);
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="insights-title">
        <Eyebrow>INSIGHTS</Eyebrow>
        <h1 id="insights-title" className="text-display-xl mt-6 max-w-[16ch] break-words text-foreground">Ideas, Experiments and What We Learn.</h1>
        <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">{DESC}</p>
      </Section>
      {!lead ? (
        <Section tone="warm">
          <div className="max-w-2xl border-t border-border pt-8">
            <h2 className="text-h3 text-foreground">The first articles are on the way.</h2>
            <p className="text-body mt-3 text-muted-foreground">We're writing up what we learn from our work in AI, creative production and software. Check back soon.</p>
          </div>
        </Section>
      ) : (
        <Section tone="warm" aria-label="Articles">
          <FeaturedPost p={lead} />
          {pair.length > 0 && (
            <div className="mt-20 grid gap-12 md:grid-cols-12">
              {pair[0] && <div className="md:col-span-7"><PostTile p={pair[0]} size="lg" /></div>}
              {pair[1] && <div className="md:col-span-5 md:mt-24"><PostTile p={pair[1]} /></div>}
            </div>
          )}
          {rows.length > 0 && <div className="mt-20 border-b border-border">{rows.map((p) => <PostTile key={p.slug} p={p} size="row" />)}</div>}
        </Section>
      )}
    </SiteShell>
  );
}
