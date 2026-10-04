import type { TeamMember } from "@/lib/company.functions";
import { cn } from "@/lib/utils";

/**
 * Data-driven org chart built ONLY from manager_id + department + leadership_level.
 * Level 0 = top leadership, 1 = executive / lead, 2 = member. Nobody's reporting line is guessed.
 * Every published member appears exactly once.
 */

export type Branch = { dept: string; members: TeamMember[] };
export type ExecNode = { lead: TeamMember; branches: Branch[] };
export type OrgTree = { roots: TeamMember[]; execs: ExecNode[]; rootBranches: Branch[]; others: TeamMember[] };

function groupByDept(members: TeamMember[], fallback: string): Branch[] {
  const map = new Map<string, TeamMember[]>();
  for (const m of members) {
    const k = m.department ?? fallback;
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map].map(([dept, members]) => ({ dept, members }));
}

export function buildOrg(team: TeamMember[]): OrgTree {
  const ids = new Set(team.map((m) => m.id));
  const kids = (id: string) => team.filter((m) => m.managerId === id && m.id !== id);
  const placed = new Set<string>();
  const descendants = (id: string): TeamMember[] => {
    const out: TeamMember[] = [];
    const walk = (pid: string) => kids(pid).forEach((k) => { if (!placed.has(k.id)) { placed.add(k.id); out.push(k); walk(k.id); } });
    walk(id);
    return out;
  };
  const noManager = (m: TeamMember) => !m.managerId || !ids.has(m.managerId);
  let roots = team.filter((m) => m.level === 0 && noManager(m));
  if (!roots.length) roots = []; // no confirmed top — executives become the top row on their own
  roots.forEach((r) => placed.add(r.id));

  const execCandidates = roots.length
    ? roots.flatMap((r) => kids(r.id).filter((k) => k.level <= 1))
    : team.filter((m) => m.level <= 1 && noManager(m));
  execCandidates.forEach((e) => placed.add(e.id));
  const execs = execCandidates.map((lead) => {
    const desc = descendants(lead.id);
    return { lead, branches: groupByDept(desc, lead.department ?? "Team") };
  });

  const rootDirect = roots.flatMap((r) => kids(r.id).filter((k) => !placed.has(k.id)));
  rootDirect.forEach((k) => placed.add(k.id));
  const rootBranches = groupByDept([...rootDirect, ...rootDirect.flatMap((k) => descendants(k.id))], "Team");

  const others = team.filter((m) => !placed.has(m.id));
  return { roots, execs, rootBranches, others };
}

function Avatar({ m, size }: { m: TeamMember; size: "sm" | "md" | "lg" }) {
  const s = { sm: "size-7", md: "size-12", lg: "size-16" }[size];
  return m.photo ? (
    <img src={m.photo} alt={size === "sm" ? "" : `Portrait of ${m.name}`} loading="lazy" decoding="async" className={cn(s, "shrink-0 rounded-full bg-muted object-cover")} />
  ) : (
    <span aria-hidden className={cn(s, "grid shrink-0 place-items-center rounded-full bg-muted text-caption text-muted-foreground")}>{m.name.charAt(0)}</span>
  );
}

function PersonCard({ m, tier }: { m: TeamMember; tier: "root" | "exec" | "member" }) {
  const body = (
    <>
      <Avatar m={m} size={tier === "root" ? "lg" : tier === "exec" ? "md" : "md"} />
      <div className="min-w-0 text-left">
        <p className={cn("truncate font-medium text-foreground", tier === "root" ? "text-[1.25rem] leading-tight" : tier === "exec" ? "text-[1rem] leading-tight" : "text-[0.875rem] leading-tight")}>{m.name}</p>
        {m.role && <p className="mt-1 truncate text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{m.role}</p>}
      </div>
    </>
  );
  const cls = cn("flex items-center gap-3 rounded-[10px] border border-border bg-card",
    tier === "root" ? "w-[280px] max-w-full p-4" : tier === "exec" ? "w-[240px] max-w-full p-3.5" : "w-full p-2.5");
  return m.linkedin ? (
    <a href={m.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${m.name}${m.role ? `, ${m.role}` : ""} on LinkedIn`}
      className={cn(cls, "transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-accent")}>{body}</a>
  ) : <div className={cls}>{body}</div>;
}

const VLine = ({ className }: { className?: string }) => <span aria-hidden className={cn("mx-auto block h-6 w-px bg-border", className)} />;

function BranchBlock({ b }: { b: Branch }) {
  return (
    <li className="flex w-[200px] max-w-full flex-col items-stretch">
      <div className="rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
        <p className="truncate text-[0.9375rem] font-medium text-foreground">{b.dept}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{b.members.length} {b.members.length === 1 ? "Member" : "Members"}</p>
          <div aria-hidden className="flex -space-x-2">{b.members.slice(0, 4).map((m) => <span key={m.id} className="rounded-full ring-2 ring-card"><Avatar m={m} size="sm" /></span>)}</div>
        </div>
      </div>
      <VLine className="h-4" />
      <ul className="space-y-2" aria-label={`${b.dept} members`}>
        {b.members.map((m) => <li key={m.id}><PersonCard m={m} tier="member" /></li>)}
      </ul>
    </li>
  );
}

/** Classic org-chart rail: each column draws its half of the top connector so lines meet exactly (md+). Mobile stacks with a centre line. */
function Col({ children, i, n }: { children: React.ReactNode; i: number; n: number }) {
  return (
    <li className="relative flex flex-col items-center md:px-2.5">
      {n > 1 && <span aria-hidden className={cn("absolute top-0 hidden h-px bg-border md:block", i === 0 ? "left-1/2 right-0" : i === n - 1 ? "left-0 right-1/2" : "inset-x-0")} />}
      <span aria-hidden className="block h-6 w-px bg-border" />
      <span aria-hidden className="block size-1.5 rounded-full bg-accent" />
      {children}
    </li>
  );
}

function ExecColumn({ e }: { e: ExecNode }) {
  return (
    <>
      <PersonCard m={e.lead} tier="exec" />
      {e.branches.length > 0 && (
        <>
          <VLine />
          <ul aria-label={`Reporting to ${e.lead.name}`} className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center">
            {e.branches.map((b) => <BranchBlock key={b.dept} b={b} />)}
          </ul>
        </>
      )}
    </>
  );
}

export function OrgChart({ team }: { team: TeamMember[] }) {
  const org = buildOrg(team);
  const cols = org.execs.length + org.rootBranches.length;
  return (
    <div className="flex flex-col items-center">
      {org.roots.length > 0 && (
        <ul aria-label="Top leadership" className="flex flex-col items-center gap-4 sm:flex-row">
          {org.roots.map((r) => <li key={r.id}><PersonCard m={r} tier="root" /></li>)}
        </ul>
      )}
      {cols > 0 && (
        <>
          {org.roots.length > 0 && <VLine />}
          <div className="w-full overflow-x-auto [scrollbar-width:thin]">
            <ul aria-label="Leadership and teams" className="mx-auto flex w-max max-w-full flex-col items-center gap-0 md:max-w-none md:flex-row md:items-start md:gap-0">
              {org.execs.map((e, i) => <Col key={e.lead.id} i={i} n={cols}><ExecColumn e={e} /></Col>)}
              {org.rootBranches.map((b, i) => <Col key={b.dept} i={org.execs.length + i} n={cols}><ul><BranchBlock b={b} /></ul></Col>)}
            </ul>
          </div>
        </>
      )}
      {org.others.length > 0 && (
        <div className="mt-14 w-full border-t border-border pt-8">
          <h3 className="text-center text-[1.125rem] font-medium text-foreground">{org.roots.length || org.execs.length ? "Other Team Members" : "Our Team"}</h3>
          <ul className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {org.others.map((m) => <li key={m.id}><PersonCard m={m} tier="member" /></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
