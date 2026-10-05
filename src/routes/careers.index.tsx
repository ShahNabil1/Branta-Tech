import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { JobBadges } from "@/components/careers/JobDetail";
import { formatDeadline } from "@/lib/job-details";
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
  const meta = [j.department, j.location, j.type, j.workMode].filter(Boolean).join(" · ");
  return (
    <li>
      <Link to="/careers/$slug" params={{ slug: j.slug }} className="group grid gap-3 border-t border-border py-8 md:grid-cols-12 md:items-baseline">
        <div className="min-w-0 md:col-span-6">
          {(j.urgent || j.featured || j.window === "closed") && <div className="mb-2 flex flex-wrap gap-2"><JobBadges j={j} /></div>}
          <h3 className="text-h3 break-words text-foreground group-hover:text-accent">{j.title}</h3>
        </div>
        <div className="text-small flex flex-col gap-1 text-muted-foreground md:col-span-4">
          <span>{meta}</span>
          {j.salary !== "Not disclosed" && <span className="text-foreground">{j.salary}</span>}
          {j.deadlineAt && <span>Apply by {formatDeadline(j.deadlineAt)}</span>}
        </div>
        <span className="text-small text-foreground md:col-span-2 md:text-right">View position →</span>
        {j.summary && <p className="text-small text-muted-foreground md:col-span-8">{j.summary}</p>}
      </Link>
    </li>
  );
}

const KEYS = [["department", "Department"], ["location", "Location"], ["type", "Employment type"], ["workMode", "Work mode"]] as const;
type FK = (typeof KEYS)[number][0];
function Filters({ jobs, value, onChange }: { jobs: JobCard[]; value: Partial<Record<FK | "open", string>>; onChange: (v: Partial<Record<FK | "open", string>>) => void }) {
  const opts = (k: FK) => [...new Set(jobs.map((j) => j[k]).filter((x): x is string => !!x))].sort();
  const keys = KEYS.filter(([k]) => opts(k).length > 1);
  const hasClosed = jobs.some((j) => j.window !== "open");
  if (jobs.length < 2 || (!keys.length && !hasClosed)) return null;
  const sel = "text-small h-10 w-full rounded-sm border border-input bg-surface px-3 text-foreground";
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Filter roles">
      {keys.map(([k, l]) => (
        <label key={k} className="block"><span className="text-caption mb-1 block text-muted-foreground">{l}</span>
          <select className={sel} value={value[k] ?? ""} onChange={(e) => onChange({ ...value, [k]: e.target.value || undefined })}>
            <option value="">All</option>{opts(k).map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      ))}
      {hasClosed && (
        <label className="block"><span className="text-caption mb-1 block text-muted-foreground">Applications</span>
          <select className={sel} value={value.open ?? ""} onChange={(e) => onChange({ ...value, open: e.target.value || undefined })}>
            <option value="">All</option><option value="open">Open now</option><option value="closed">Closed</option>
          </select>
        </label>
      )}
    </div>
  );
}

function CareersPage() {
  const { data: page } = useSuspenseQuery(companyPageQuery("careers"));
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const [flt, setFlt] = useState<Partial<Record<FK | "open", string>>>({});
  const shown = jobs.filter((j) => KEYS.every(([k]) => !flt[k] || j[k] === flt[k]) && (!flt.open || (flt.open === "open" ? j.window === "open" : j.window !== "open")));
  const roles = shown.filter((j) => !isInternship(j));
  const interns = shown.filter(isInternship);
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
        <Filters jobs={jobs} value={flt} onChange={setFlt} />
        {roles.length ? <ul className="mt-10 border-b border-border">{roles.map((j) => <JobRow key={j.slug} j={j} />)}</ul> : (
          <div className="mt-10 max-w-xl border-t border-border pt-8">
            <p className="text-h3 text-foreground">{jobs.length && shown.length < jobs.length ? "No roles match these filters." : "No open roles right now."}</p>
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
