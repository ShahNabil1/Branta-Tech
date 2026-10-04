import { useMemo, useState } from "react";
import type { TeamMember } from "@/lib/company.functions";
import { cn } from "@/lib/utils";

/** Level 0 = top leadership, 1 = leads / department heads, 2 = team. Ordering is done server-side. */
export const leadersOf = (m: TeamMember[]) => ({ top: m.filter((x) => x.level === 0), leads: m.filter((x) => x.level === 1) });

function Portrait({ m, className }: { m: TeamMember; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[4px] bg-muted", className)}>
      {m.photo ? (
        <img src={m.photo} alt={`Portrait of ${m.name}${m.role ? `, ${m.role}` : ""}`} loading="lazy" decoding="async" className="media-zoom aspect-[4/5] w-full object-cover" />
      ) : (
        <div aria-hidden className="grid aspect-[4/5] place-items-center text-h2 text-muted-foreground/40">{m.name.charAt(0)}</div>
      )}
    </div>
  );
}

function LinkedIn({ m }: { m: TeamMember }) {
  if (!m.linkedin) return null;
  return (
    <a href={m.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`}
      className="text-caption mt-3 inline-block text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
      LinkedIn
    </a>
  );
}

function LeaderCard({ m, large }: { m: TeamMember; large?: boolean }) {
  return (
    <article className={cn("group relative min-w-0 rounded-[6px] border border-border bg-card p-4", large ? "sm:grid sm:grid-cols-[180px_1fr] sm:gap-6 sm:p-5" : "")}>
      <Portrait m={m} className={large ? "w-full max-w-[220px] sm:max-w-none" : ""} />
      <div className={cn("min-w-0", large ? "mt-5 sm:mt-0 sm:self-end" : "mt-4")}>
        {m.role && <p className="text-eyebrow text-muted-foreground">{m.role}</p>}
        <h3 className={cn("mt-2 break-words text-foreground", large ? "text-h2" : "text-h3")}>{m.name}</h3>
        {m.shortBio && <p className="text-small mt-3 text-muted-foreground">{m.shortBio}</p>}
        <LinkedIn m={m} />
      </div>
    </article>
  );
}

/** Data-driven org chart. Desktop: top row, connector, leads row. Mobile: vertical list with a thin rail. */
export function LeadershipHierarchy({ members }: { members: TeamMember[] }) {
  const { top, leads } = leadersOf(members);
  const cols = Math.min(Math.max(leads.length, 1), 4);
  return (
    <ol aria-label="Leadership structure" className="relative">
      {top.length > 0 && (
        <li className="relative">
          <span className="sr-only">Top leadership</span>
          <div className={cn("mx-auto grid gap-6", top.length > 1 ? "md:grid-cols-2 max-w-4xl" : "max-w-xl")}>
            {top.map((m) => <LeaderCard key={m.id} m={m} large />)}
          </div>
          {leads.length > 0 && (
            <div aria-hidden className="mx-auto h-12 w-px bg-border md:h-14">
              <span className="block size-1.5 -translate-x-[2.5px] translate-y-[calc(100%*0)] rounded-full bg-accent" />
            </div>
          )}
        </li>
      )}
      {leads.length > 0 && (
        <li className="relative">
          <span className="sr-only">{top.length ? `Reporting to ${top.map((t) => t.name).join(" and ")}` : "Leadership"}</span>
          {/* Horizontal connector (desktop only, only when leads sit side by side) */}
          {top.length > 0 && leads.length > 1 && (
            <div aria-hidden className="hidden lg:block">
              <div className="h-px bg-border" style={{ marginInline: `calc(100% / ${cols * 2})` }} />
            </div>
          )}
          <ul className={cn("grid gap-6 sm:grid-cols-2", cols >= 3 && "lg:grid-cols-3", cols >= 4 && "xl:grid-cols-4", top.length > 0 && "border-l border-border pl-5 sm:border-l-0 sm:pl-0")}>
            {leads.map((m) => (
              <li key={m.id} className="relative min-w-0">
                {top.length > 0 && <span aria-hidden className="mx-auto hidden h-8 w-px bg-border lg:block" />}
                <LeaderCard m={m} />
              </li>
            ))}
          </ul>
        </li>
      )}
    </ol>
  );
}

type Dept = { name: string; members: TeamMember[] };
export function groupDepartments(members: TeamMember[]): Dept[] {
  const map = new Map<string, TeamMember[]>();
  for (const m of members) if (m.department) map.set(m.department, [...(map.get(m.department) ?? []), m]);
  return [...map].map(([name, list]) => ({ name, members: list }));
}

export function DepartmentTeams({ departments }: { departments: Dept[] }) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-[6px] border border-border bg-border md:grid-cols-2 xl:grid-cols-3">
      {departments.map((d) => (
        <li key={d.name} className="min-w-0 bg-background p-6 md:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-h3 break-words text-foreground">{d.name}</h3>
            <p className="text-caption shrink-0 text-muted-foreground">{d.members.length} {d.members.length === 1 ? "person" : "people"}</p>
          </div>
          <ul className="mt-6 grid gap-4">
            {d.members.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-3">
                <div className="size-11 shrink-0 overflow-hidden rounded-[4px] bg-muted">
                  {m.photo ? <img src={m.photo} alt="" loading="lazy" className="size-full object-cover" /> : <span aria-hidden className="grid size-full place-items-center text-small text-muted-foreground">{m.name.charAt(0)}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-small truncate font-medium text-foreground">{m.name}{m.level <= 1 && <span className="sr-only"> (lead)</span>}</p>
                  {m.role && <p className="text-caption truncate text-muted-foreground">{m.role}</p>}
                </div>
                {m.level <= 1 && <span aria-hidden title="Lead" className="ml-auto size-1.5 shrink-0 rounded-full bg-accent" />}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function TeamDirectory({ members, departments }: { members: TeamMember[]; departments: string[] }) {
  const showFilters = departments.length >= 2 && members.length >= 8;
  const [f, setF] = useState<string | null>(null);
  const list = useMemo(() => (f ? members.filter((m) => m.department === f) : members), [f, members]);
  return (
    <>
      {showFilters && (
        <div role="group" aria-label="Filter by department" className="mb-10 flex flex-wrap gap-2">
          {[null, ...departments].map((d) => (
            <button key={d ?? "all"} type="button" aria-pressed={f === d} onClick={() => setF(d)}
              className={cn("text-small rounded-full border px-4 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                f === d ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
              {d ?? "All"}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-1 gap-x-6 gap-y-12 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {list.map((m) => (
          <li key={m.id} className="group min-w-0">
            <Portrait m={m} />
            <h3 className="text-h3 mt-4 break-words text-foreground">{m.name}</h3>
            {m.role && <p className="text-small mt-1 text-muted-foreground">{m.role}</p>}
            {m.department && <p className="text-caption mt-2 text-muted-foreground/80">{m.department}</p>}
            {m.shortBio && <p className="text-small mt-3 line-clamp-3 text-muted-foreground">{m.shortBio}</p>}
            <LinkedIn m={m} />
          </li>
        ))}
      </ul>
    </>
  );
}
