import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { CompanySections } from "@/components/content/CompanyBlocks";
import { siteChromeQuery } from "@/lib/navigation";
import { companyPageQuery, isInternship, jobsQuery, type JobCard } from "@/lib/company.functions";
import { pageMeta, canonical } from "@/lib/seo";

const DESC = "Join a team working across creative, AI, design, software and automation.";

export const Route = createFileRoute("/careers/")({
  loader: async ({ context }) => {
    const [, page] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(companyPageQuery("careers")), context.queryClient.ensureQueryData(jobsQuery)]);
    return { seo: page.seo };
  },
  head: ({ loaderData }) => ({ links: canonical("/careers"),
    meta: pageMeta({ title: loaderData?.seo.title || "Careers | Branta Tech", description: loaderData?.seo.description || DESC, image: loaderData?.seo.ogImage, noindex: loaderData?.seo.noindex }),
  }),
  errorComponent: () => <p className="p-8">Something went wrong loading careers.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: CareersPage,
});

function JobRow({ j }: { j: JobCard }) {
  const meta = [j.department, j.type, j.location, j.workMode].filter(Boolean).join(" · ");
  return (
    <li>
      <Link to="/careers/$slug" params={{ slug: j.slug }} className="group grid gap-3 border-t border-border py-8 md:grid-cols-12 md:items-baseline">
        <h3 className="text-h3 min-w-0 break-words text-foreground group-hover:text-accent md:col-span-6">{j.title}</h3>
        <p className="text-small text-muted-foreground md:col-span-4">{meta}</p>
        <span className="text-small text-foreground md:col-span-2 md:text-right">View role →</span>
        {j.summary && <p className="text-small text-muted-foreground md:col-span-8">{j.summary}</p>}
      </Link>
    </li>
  );
}

function CareersPage() {
  const { data: page } = useSuspenseQuery(companyPageQuery("careers"));
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const roles = jobs.filter((j) => !isInternship(j));
  const interns = jobs.filter(isInternship);
  const h = page.hero;
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="careers-title">
        <Eyebrow>{h?.eyebrow || "CAREERS"}</Eyebrow>
        <h1 id="careers-title" className="text-display-xl mt-6 max-w-[16ch] break-words text-foreground">{h?.title || "Build What Comes Next With Us."}</h1>
        <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">{h?.body || DESC}</p>
        {jobs.length > 0 && <a href="#open-roles" className="text-body mt-10 inline-block underline underline-offset-4">See open roles ↓</a>}
      </Section>
      <CompanySections sections={page.sections} />
      <Section tone="warm" id="open-roles" aria-labelledby="roles-title" className="scroll-mt-20 border-t border-border">
        <h2 id="roles-title" className="text-h1 text-foreground">Open roles</h2>
        {roles.length ? <ul className="mt-10 border-b border-border">{roles.map((j) => <JobRow key={j.slug} j={j} />)}</ul> : (
          <div className="mt-10 max-w-xl border-t border-border pt-8">
            <p className="text-h3 text-foreground">No open roles right now.</p>
            <p className="text-body mt-3 text-muted-foreground">We post new roles here as soon as they open. Check back soon.</p>
          </div>
        )}
      </Section>
      {interns.length > 0 && (
        <Section tone="muted" aria-labelledby="intern-title">
          <h2 id="intern-title" className="text-h1 text-foreground">Internship opportunities</h2>
          <ul className="mt-10 border-b border-border">{interns.map((j) => <JobRow key={j.slug} j={j} />)}</ul>
        </Section>
      )}
    </SiteShell>
  );
}
