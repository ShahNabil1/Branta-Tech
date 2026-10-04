import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { CompanySections, TeamGrid } from "@/components/content/CompanyBlocks";
import { siteChromeQuery } from "@/lib/navigation";
import { companyPageQuery, teamQuery } from "@/lib/company.functions";
import { pageMeta } from "@/lib/seo";

const DESC = "Meet the creative directors, designers, engineers and AI specialists at Branta.";

export const Route = createFileRoute("/team")({
  loader: async ({ context }) => {
    const [, page] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(companyPageQuery("team")), context.queryClient.ensureQueryData(teamQuery)]);
    return { seo: page.seo };
  },
  head: ({ loaderData }) => ({
    meta: pageMeta({ title: loaderData?.seo.title || "Team | Branta Tech", description: loaderData?.seo.description || DESC, image: loaderData?.seo.ogImage, noindex: loaderData?.seo.noindex }),
  }),
  errorComponent: () => <p className="p-8">Something went wrong loading the team.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: TeamPage,
});

function TeamPage() {
  const { data: page } = useSuspenseQuery(companyPageQuery("team"));
  const { data: team } = useSuspenseQuery(teamQuery);
  const h = page.hero;
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="team-title">
        <Eyebrow>{h?.eyebrow || "TEAM"}</Eyebrow>
        <h1 id="team-title" className="text-display-xl mt-6 max-w-[14ch] break-words text-foreground">{h?.title || "People Behind the Work."}</h1>
        {h?.body && <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">{h.body}</p>}
      </Section>
      <Section tone="warm" aria-label="Team members">
        {team.length ? <TeamGrid members={team} /> : <p className="text-body text-muted-foreground">Team profiles are coming soon.</p>}
      </Section>
      <CompanySections sections={page.sections} startTone={1} />
    </SiteShell>
  );
}
