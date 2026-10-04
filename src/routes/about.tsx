import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { CompanySections, TeamGrid } from "@/components/content/CompanyBlocks";
import { ClientLogos, FinalCta } from "@/components/home/HomeClosing";
import { siteChromeQuery } from "@/lib/navigation";
import { companyPageQuery, teamQuery } from "@/lib/company.functions";
import { homeClosingQuery } from "@/lib/home-closing.functions";
import { pageMeta, canonical } from "@/lib/seo";

const DESC = "Branta brings creative direction, AI-powered production and technology under one team to help brands create, build and move faster.";

export const Route = createFileRoute("/about")({
  loader: async ({ context }) => {
    const [, page] = await Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(companyPageQuery("about")),
      context.queryClient.ensureQueryData(teamQuery), context.queryClient.ensureQueryData(homeClosingQuery),
    ]);
    return { seo: page.seo };
  },
  head: ({ loaderData }) => ({ links: canonical("/about"),
    meta: pageMeta({ title: loaderData?.seo.title || "About | Branta Tech", description: loaderData?.seo.description || DESC, image: loaderData?.seo.ogImage, noindex: loaderData?.seo.noindex }),
  }),
  errorComponent: () => <p className="p-8">Something went wrong loading this page.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: AboutPage,
});

function AboutPage() {
  const { data: page } = useSuspenseQuery(companyPageQuery("about"));
  const { data: team } = useSuspenseQuery(teamQuery);
  const { data: closing } = useSuspenseQuery(homeClosingQuery);
  const preview = (team.some((m) => m.featured) ? team.filter((m) => m.featured) : team).slice(0, 3);
  const h = page.hero;
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="about-title">
        <Eyebrow>{h?.eyebrow || "ABOUT BRANTA"}</Eyebrow>
        <h1 id="about-title" className="text-display-xl mt-6 max-w-[18ch] break-words text-foreground">
          {h?.title || (<>Creative Thinking.<br />AI-Native Production.<br />Technology That Works.</>)}
        </h1>
        <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">{h?.body || DESC}</p>
      </Section>
      <CompanySections sections={page.sections} />
      {closing.clients && <ClientLogos content={closing.clients} />}
      {preview.length > 0 && (
        <Section tone="warm" aria-labelledby="team-preview" className="border-t border-border">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>TEAM</Eyebrow>
              <h2 id="team-preview" className="text-h1 mt-4 text-foreground">People Behind the Work.</h2>
            </div>
            <Link to="/team" className="text-body underline underline-offset-4 hover:text-accent">Meet the team →</Link>
          </div>
          <TeamGrid members={preview} />
        </Section>
      )}
      {closing.finalCta && <FinalCta content={closing.finalCta} />}
    </SiteShell>
  );
}
