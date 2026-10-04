import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import { OrgChart } from "@/components/content/TeamStructure";
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
  return (
    <SiteShell>
      <Section tone="warm" aria-labelledby="team-title" className="py-20 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow className="justify-center">{h?.eyebrow || "PEOPLE BEHIND BRANTA"}</Eyebrow>
          <h1 id="team-title" className="mt-5 text-[2.5rem] font-medium leading-[1.05] tracking-tight text-foreground md:text-[3.25rem] lg:text-[3.75rem]">{h?.title || "Meet the Team Behind the Work."}</h1>
          <p className="mx-auto mt-5 max-w-xl text-[1rem] text-muted-foreground md:text-[1.0625rem]">{h?.body || DESC}</p>
          <p className="text-caption mt-4 text-muted-foreground">Creative. AI. Technology.</p>
        </div>
        {h?.media && <img src={h.media} alt="The Branta team" className="mx-auto mt-12 aspect-[16/9] w-full max-w-5xl rounded-[8px] object-cover" />}
      </Section>

      <Section tone="warm" aria-labelledby="org-title" className="border-t border-border py-20 md:py-24">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-12 text-center">
            <Eyebrow className="justify-center">HOW WE'RE ORGANISED</Eyebrow>
            <h2 id="org-title" className="mt-4 text-[2rem] font-medium leading-tight tracking-tight text-foreground md:text-[2.5rem]">Our Structure.</h2>
          </div>
          {team.length ? <OrgChart team={team} /> : <p className="text-body text-center text-muted-foreground">Team profiles are coming soon.</p>}
        </div>
      </Section>

      <Section tone="dark" aria-labelledby="join-title" className="py-20 md:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="min-w-0 lg:col-span-7">
            <Eyebrow>JOIN BRANTA</Eyebrow>
            <h2 id="join-title" className="mt-5 max-w-[14ch] text-[2.25rem] font-medium leading-[1.05] tracking-tight text-foreground md:text-[3rem] lg:text-[3.5rem]">Want to Build With Us?</h2>
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
