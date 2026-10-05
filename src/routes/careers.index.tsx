import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, CalendarClock, Clock, MapPin, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteContainer } from "@/components/layout/primitives";
import { CompanySections } from "@/components/content/CompanyBlocks";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { siteChromeQuery } from "@/lib/navigation";
import { companyPageQuery, jobsQuery, type JobCard } from "@/lib/company.functions";
import { fetchMyApplications, fetchMyInterviews, isUpcoming, statusLabel, type MyApplication } from "@/lib/applicant-data";
import { formatDeadline } from "@/lib/job-details";
import { pageMeta, canonical } from "@/lib/seo";

const DESC = "Explore open roles across creative, AI, design, technology and business.";

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

/* ---------------- Applicant (client-only, signed-in only) ---------------- */
type Me = { name: string; headline: string; photo: string | null; apps: MyApplication[]; interviews: number };

function useApplicant() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return alive && setMe(null);
      const db = supabase as unknown as { from: (t: string) => any };
      const [p, a, apps, ivs] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        db.from("applicant_profiles").select("photo_path, study_department, study_status, institute, current_location").eq("user_id", user.id).maybeSingle(),
        fetchMyApplications().catch(() => [] as MyApplication[]),
        fetchMyInterviews().catch(() => []),
      ]);
      const ap = (a?.data ?? {}) as Record<string, string | null>;
      let photo: string | null = null;
      if (ap["photo_path"]) photo = (await supabase.storage.from("applicant-media").createSignedUrl(ap["photo_path"], 3600)).data?.signedUrl ?? null;
      const headline = [ap["study_department"], ap["study_status"]].filter(Boolean).join(" · ");
      const summary = [ap["institute"], ap["current_location"]].filter(Boolean).join(" · ");
      if (alive) setMe({ name: p.data?.full_name || user.email || "Applicant", headline: [headline, summary].filter(Boolean).join(" — "), photo, apps, interviews: ivs.filter(isUpcoming).length });
    })();
    return () => { alive = false; };
  }, []);
  return me;
}

const card = "rounded-md border border-border bg-surface p-5";
const ACTIVE = (s: string) => !["withdrawn", "rejected", "hired"].includes(s);

function ApplicantPanel({ me }: { me: Me | null | undefined }) {
  if (me === undefined) return <div className={`${card} h-48 animate-pulse`} aria-hidden />;
  if (!me) return (
    <div className={card}>
      <span className="grid size-10 place-items-center rounded-full bg-muted text-accent"><UserRound className="size-5" aria-hidden /></span>
      <h2 className="text-h4 mt-4 text-foreground">Looking for your next opportunity?</h2>
      <p className="text-small mt-2 text-muted-foreground">Create an account to save your profile and track applications.</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link to="/careers/sign-in" search={{ next: "/careers" }} className="text-small rounded-sm border border-border px-3 py-2 text-center text-foreground hover:border-foreground">Sign In</Link>
        <Link to="/careers/sign-up" className="text-small rounded-sm bg-accent px-3 py-2 text-center text-accent-foreground hover:bg-[var(--accent-hover)]">Create Account</Link>
      </div>
    </div>
  );
  const active = me.apps.filter((a) => ACTIVE(a.status));
  const latest = me.apps[0];
  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} text-center`}>
        {me.photo ? <img src={me.photo} alt="" className="mx-auto size-16 rounded-full object-cover" /> : <span className="text-h4 mx-auto grid size-16 place-items-center rounded-full bg-muted text-foreground">{me.name.charAt(0).toUpperCase()}</span>}
        <p className="text-h4 mt-3 break-words text-foreground">{me.name}</p>
        {me.headline && <p className="text-small mt-1 text-muted-foreground">{me.headline}</p>}
        <Link to="/careers/account/applications" className="text-small mt-4 inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-accent-foreground hover:bg-[var(--accent-hover)]">My Applications</Link>
      </div>
      <div className={card}>
        <h2 className="text-small font-medium text-foreground">Application summary</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {([["Active", String(active.length)], ["Interviews", String(me.interviews)], ["Latest", latest ? statusLabel(latest.status) : "—"]] as const).map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-sm bg-muted px-2 py-3"><dd className="text-small truncate font-medium text-foreground">{v}</dd><dt className="text-caption mt-1 text-muted-foreground">{k}</dt></div>
          ))}
        </dl>
      </div>
      {me.apps.length > 0 && (
        <div className={card}>
          <h2 className="text-small font-medium text-foreground">Application status</h2>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {me.apps.slice(0, 4).map((a) => (
              <li key={a.id}><Link to="/careers/account/applications/$id" params={{ id: a.id }} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                <span className="text-small min-w-0 truncate text-foreground">{a.job_title}</span>
                <span className="text-caption shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-accent">{statusLabel(a.status)}</span>
              </Link></li>
            ))}
          </ul>
          <div className="text-caption mt-3 flex gap-4 text-muted-foreground">
            <Link to="/careers/account/interviews" className="hover:text-foreground">Interviews</Link>
            <Link to="/careers/account/profile" className="hover:text-foreground">Profile</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Filters ---------------- */
type Groups = "location" | "type" | "department" | "workMode" | "experience";
type F = Record<Groups, string[]> & { salary: boolean };
const EMPTY: F = { location: [], type: [], department: [], workMode: [], experience: [], salary: false };
const GROUPS: [Groups, string][] = [["workMode", "Work mode"], ["location", "Location"], ["type", "Job type"], ["department", "Department"], ["experience", "Experience"]];
const expOf = (j: JobCard) => (j.experienceKind && j.experience ? j.experience : "");
const valOf = (j: JobCard, g: Groups) => (g === "experience" ? expOf(j) : j[g]) || "";

function FilterPanel({ jobs, f, set }: { jobs: JobCard[]; f: F; set: (f: F) => void }) {
  const any = GROUPS.some(([g]) => f[g].length) || f.salary;
  const hasSalary = jobs.some((j) => j.salaryValue);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-h4 text-foreground">Filter Jobs</h2>
        {any && <button onClick={() => set(EMPTY)} className="text-small text-accent hover:underline">Clear All</button>}
      </div>
      {GROUPS.map(([g, label]) => {
        const opts = [...new Set(jobs.map((j) => valOf(j, g)).filter(Boolean))].sort();
        if (!opts.length) return null;
        return (
          <fieldset key={g}>
            <legend className="text-caption mb-2 uppercase tracking-wide text-muted-foreground">{label}</legend>
            <div className="flex flex-col gap-1.5">
              {opts.map((o) => {
                const on = f[g].includes(o);
                return (
                  <label key={o} className="text-small flex cursor-pointer items-center gap-2.5 text-foreground">
                    <input type="checkbox" checked={on} onChange={() => set({ ...f, [g]: on ? f[g].filter((x) => x !== o) : [...f[g], o] })} className="size-4 rounded-sm accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1 truncate">{o}</span>
                    <span className="text-caption text-muted-foreground">{jobs.filter((j) => valOf(j, g) === o).length}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {hasSalary && (
        <fieldset>
          <legend className="text-caption mb-2 uppercase tracking-wide text-muted-foreground">Salary</legend>
          <label className="text-small flex cursor-pointer items-center gap-2.5 text-foreground">
            <input type="checkbox" checked={f.salary} onChange={() => set({ ...f, salary: !f.salary })} className="size-4 accent-[var(--accent)]" />Published salary only
          </label>
        </fieldset>
      )}
    </div>
  );
}

/* ---------------- Job card ---------------- */
function daysLeft(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d < 0 ? "Closed" : d === 0 ? "Closes today" : d <= 14 ? `${d} day${d === 1 ? "" : "s"} left` : `Apply by ${formatDeadline(iso)}`;
}
const Tag = ({ children, tone }: { children: ReactNode; tone?: "accent" }) => (
  <span className={`text-caption rounded-full px-2 py-0.5 ${tone ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>{children}</span>
);

function JobItem({ j, app }: { j: JobCard; app?: MyApplication | undefined }) {
  const facts: [typeof MapPin, string][] = ([[MapPin, j.location ?? ""], [Briefcase, [j.type, j.workMode].filter(Boolean).join(" · ")], [Clock, j.deadlineAt ? daysLeft(j.deadlineAt) : j.window === "closed" ? "Closed" : ""]] as [typeof MapPin, string][]).filter(([, v]) => v);
  return (
    <li className="animate-fade-in">
      <Link to="/careers/$slug" params={{ slug: j.slug }} className="group block rounded-md border border-border bg-surface p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[0_12px_30px_-18px_rgb(36_22_15/0.35)] md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-h4 break-words text-foreground group-hover:text-accent">{j.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {j.department && <Tag>{j.department}</Tag>}
              {j.featured && <Tag tone="accent">Featured</Tag>}
              {j.urgent && <Tag tone="accent">Urgent</Tag>}
              {j.window === "not_yet" && <Tag>Opening soon</Tag>}
            </div>
          </div>
          {app ? <span className="text-caption shrink-0 rounded-full bg-accent px-2.5 py-1 text-accent-foreground">Applied · {statusLabel(app.status)}</span>
            : <ArrowRight className="mt-1 size-5 shrink-0 -translate-x-1 text-accent opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />}
        </div>
        {j.summary && <p className="text-small mt-3 line-clamp-2 text-muted-foreground">{j.summary}</p>}
        <div className="text-small mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-muted-foreground">
          {facts.map(([I, v]) => <span key={v} className="inline-flex items-center gap-1.5"><I className="size-4" aria-hidden />{v}</span>)}
          {j.salary !== "Not disclosed" && <span className="font-medium text-foreground">{j.salary}</span>}
          <span className="ml-auto text-foreground">{app ? "View Application" : "View Position"}</span>
        </div>
      </Link>
    </li>
  );
}

/* ---------------- Page ---------------- */
type Sort = "featured" | "newest" | "deadline" | "salary";

function CareersPage() {
  const { data: page } = useSuspenseQuery(companyPageQuery("careers"));
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const me = useApplicant();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [f, setF] = useState<F>(EMPTY);
  const [sort, setSort] = useState<Sort>("featured");
  useEffect(() => { const t = setTimeout(() => setTerm(q), 200); return () => clearTimeout(t); }, [q]);

  const applied = useMemo(() => new Map((me?.apps ?? []).filter((a) => a.status !== "withdrawn").map((a) => [a.job_slug, a])), [me]);
  const shown = useMemo(() => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    const list = jobs.filter((j) => {
      const hay = [j.title, j.department, j.location, j.type, j.workMode, j.summary, ...j.skills].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w)) && GROUPS.every(([g]) => !f[g].length || f[g].includes(valOf(j, g))) && (!f.salary || !!j.salaryValue);
    });
    const t = (s: string | null) => (s ? new Date(s).getTime() : 0);
    if (sort === "newest") list.sort((a, b) => t(b.publishedAt) - t(a.publishedAt));
    if (sort === "deadline") list.sort((a, b) => (t(a.deadlineAt) || Infinity) - (t(b.deadlineAt) || Infinity));
    if (sort === "salary") list.sort((a, b) => (b.salaryValue ?? -1) - (a.salaryValue ?? -1));
    return list;
  }, [jobs, term, f, sort]);
  const activeCount = GROUPS.reduce((n, [g]) => n + f[g].length, 0) + (f.salary ? 1 : 0);
  const h = page.hero;

  return (
    <SiteShell>
      <section className="bg-muted py-8 md:py-12" aria-labelledby="careers-title">
        <SiteContainer>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,23fr)_minmax(0,54fr)_minmax(0,23fr)]">
            {/* Left: applicant summary (collapsible on small screens) */}
            <aside className="hidden lg:block" aria-label="Your applicant summary">
              <div className="hidden lg:sticky lg:top-24 lg:block"><ApplicantPanel me={me} /></div>
            </aside>

            {/* Center */}
            <div className="order-1 min-w-0 lg:order-2 lg:row-span-2">
              <div className="relative overflow-hidden rounded-md bg-ink p-6 text-ink-foreground md:p-8">
                <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_45%,transparent),transparent)]" />
                <p className="text-eyebrow relative text-accent">{h?.eyebrow || "CAREERS AT BRANTA"}</p>
                <h1 id="careers-title" className="text-h2 relative mt-3 max-w-[18ch]">{h?.title || "Find Your Next Opportunity at Branta."}</h1>
                <p className="text-small relative mt-3 max-w-lg opacity-75">{h?.body || DESC}</p>
                <form role="search" onSubmit={(e) => { e.preventDefault(); setTerm(q); }} className="relative mt-6 flex gap-2 rounded-sm bg-surface p-1.5">
                  <label htmlFor="job-search" className="sr-only">Search jobs</label>
                  <Search className="ml-2 size-4 shrink-0 self-center text-muted-foreground" aria-hidden />
                  <input id="job-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs, roles or skills..." className="text-small min-w-0 flex-1 bg-transparent px-1 text-foreground outline-none placeholder:text-muted-foreground" />
                  <button className="text-small shrink-0 rounded-sm bg-accent px-4 py-2 text-accent-foreground hover:bg-[var(--accent-hover)]">Search</button>
                </form>
              </div>

              <details className="group mt-4 rounded-md border border-border bg-surface lg:hidden">
                <summary className="text-small flex cursor-pointer list-none items-center justify-between px-4 py-3 text-foreground">
                  {me ? `${me.name.split(" ")[0]} · ${me.apps.filter((a) => ACTIVE(a.status)).length} active applications` : "Your applicant account"}
                  <span className="text-muted-foreground group-open:rotate-180">⌄</span>
                </summary>
                <div className="border-t border-border p-3"><ApplicantPanel me={me} /></div>
              </details>
              <div id="open-roles" className="mt-6 flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
                <p className="text-small text-muted-foreground" aria-live="polite"><span className="font-medium text-foreground">{shown.length}</span> {shown.length === 1 ? "role" : "roles"}</p>
                <div className="flex items-center gap-2">
                  <Sheet>
                    <SheetTrigger className="text-small inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-foreground lg:hidden">
                      <SlidersHorizontal className="size-4" aria-hidden />Filters{activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-caption text-accent-foreground">{activeCount}</span>}
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                      <SheetHeader><SheetTitle className="sr-only">Filter jobs</SheetTitle></SheetHeader>
                      <FilterPanel jobs={jobs} f={f} set={setF} />
                    </SheetContent>
                  </Sheet>
                  <label className="text-small flex items-center gap-2 text-muted-foreground">
                    <span className="hidden sm:inline">Sort</span>
                    <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="text-small h-9 rounded-sm border border-input bg-surface px-2 text-foreground" aria-label="Sort jobs">
                      <option value="featured">Featured</option><option value="newest">Newest</option><option value="deadline">Deadline soon</option>
                      {jobs.some((j) => j.salaryValue) && <option value="salary">Salary high to low</option>}
                    </select>
                  </label>
                </div>
              </div>

              {activeCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {GROUPS.flatMap(([g]) => f[g].map((v) => (
                    <button key={g + v} onClick={() => setF({ ...f, [g]: f[g].filter((x) => x !== v) })} className="text-caption inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-accent">{v}<X className="size-3" aria-label="Remove" /></button>
                  )))}
                </div>
              )}

              {shown.length ? (
                <ul className="mt-4 flex flex-col gap-3">{shown.map((j) => <JobItem key={j.slug} j={j} app={applied.get(j.slug)} />)}</ul>
              ) : (
                <div className="mt-4 rounded-md border border-dashed border-border bg-surface p-8 text-center">
                  <p className="text-h4 text-foreground">{jobs.length ? "No matching roles found." : "No open roles right now."}</p>
                  <p className="text-small mt-2 text-muted-foreground">{jobs.length ? "Try changing your filters." : "We post new roles here as soon as they open. Check back soon."}</p>
                  {jobs.length > 0 && <button onClick={() => { setF(EMPTY); setQ(""); setTerm(""); }} className="text-small mt-4 text-accent hover:underline">Clear search and filters</button>}
                </div>
              )}
            </div>

            {/* Right: filters (desktop) */}
            <aside className="order-3 hidden lg:block" aria-label="Filter jobs">
              <div className={`${card} lg:sticky lg:top-24`}><FilterPanel jobs={jobs} f={f} set={setF} /></div>
            </aside>
          </div>
          {me && me.interviews > 0 && (
            <Link to="/careers/account/interviews" className="text-small mt-6 inline-flex items-center gap-2 text-foreground hover:text-accent"><CalendarClock className="size-4 text-accent" aria-hidden />You have {me.interviews} upcoming interview{me.interviews === 1 ? "" : "s"}</Link>
          )}
        </SiteContainer>
      </section>
      <CompanySections sections={page.sections} />
    </SiteShell>
  );
}
