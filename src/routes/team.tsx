import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import { DepartmentTeams, LeadershipHierarchy, TeamDirectory, groupDepartments, leadersOf } from "@/components/content/TeamStructure";
import { siteChromeQuery } from "@/lib/navigation";
import { companyPageQuery, teamQuery } from "@/lib/company.functions";
import { pageMeta, canonical } from "@/lib/seo";

const DESC = "A multidisciplinary team working across creative, AI, design, software and automation.";

export const Route = createFileRoute("/team")({
  loader: async ({ context }) => {
    const [, page] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(companyPageQuery("team")), context.queryClient.ensureQueryData(teamQuery)]);
    return { seo: page.seo };
  },
  head: ({ loaderData }) => ({ links: canonical("/team"),
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
  const { top, leads } = leadersOf(team);
  const depts = groupDepartments(team);
  return (
    <SiteShell>
      <Section tone="warm" aria-labelledby="team-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="min-w-0 lg:col-span-8">
            <Eyebrow>{h?.eyebrow || "PEOPLE BEHIND BRANTA"}</Eyebrow>
            <h1 id="team-title" className="text-display-xl mt-6 max-w-[14ch] break-words text-foreground">{h?.title || "Meet the Team Behind the Work."}</h1>
          </div>
          <div className="min-w-0 lg:col-span-4">
            <p className="text-body-lg text-muted-foreground">{h?.body || DESC}</p>
            <p className="text-caption mt-6 text-muted-foreground">Creative. AI. Technology.</p>
          </div>
        </div>
        {h?.media && <img src={h.media} alt="The Branta team" className="mt-14 aspect-[16/9] w-full rounded-[6px] object-cover" />}
      </Section>

      {(top.length > 0 || leads.length > 0) && (
        <Section tone="warm" aria-labelledby="lead-title" className="border-t border-border">
          <Eyebrow>LEADERSHIP</Eyebrow>
          <h2 id="lead-title" className="text-h1 mt-4 mb-14 text-foreground">Who Leads the Work.</h2>
          <LeadershipHierarchy members={team} />
        </Section>
      )}

      {depts.length > 0 && (
        <Section tone="warm" aria-labelledby="dept-title" className="border-t border-border">
          <Eyebrow>TEAMS</Eyebrow>
          <h2 id="dept-title" className="text-h1 mt-4 mb-14 text-foreground">How We're Organised.</h2>
          <DepartmentTeams departments={depts} />
        </Section>
      )}

      <Section tone="warm" aria-labelledby="people-title" className="border-t border-border">
        <Eyebrow>OUR PEOPLE</Eyebrow>
        <h2 id="people-title" className="text-h1 mt-4 mb-14 text-foreground">The People Doing the Work.</h2>
        {team.length ? <TeamDirectory members={team} departments={depts.map((d) => d.name)} /> : <p className="text-body text-muted-foreground">Team profiles are coming soon.</p>}
      </Section>

      <Section tone="dark" aria-labelledby="join-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="min-w-0 lg:col-span-7">
            <Eyebrow>JOIN BRANTA</Eyebrow>
            <h2 id="join-title" className="text-display mt-6 max-w-[12ch] text-foreground">Want to Build With Us?</h2>
          </div>
          <div className="min-w-0 lg:col-span-5">
            <p className="text-body-lg text-muted-foreground">Explore open roles and opportunities across creative, AI and technology.</p>
            <div className="mt-8"><HeroAction label="View Careers" url="/careers" variant="primary" /></div>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
