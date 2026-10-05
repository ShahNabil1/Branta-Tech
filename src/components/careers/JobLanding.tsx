import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { RichText } from "@/components/content/RichText";
import { teamQuery } from "@/lib/company.functions";
import type { PublicJob } from "@/lib/job-details";
import { cn } from "@/lib/utils";

/** Public job landing sections. Every section renders only when the job has content for it. */

export function LandingBlock({ id, title, eyebrow, children, className }: { id?: string; title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={cn("scroll-mt-24 border-t border-border py-10 first:border-t-0 first:pt-0 md:py-12", className)}>
      {eyebrow && <p className="text-eyebrow mb-3 text-accent">{eyebrow}</p>}
      <h2 id={id ? `${id}-h` : undefined} className="text-h3 text-foreground">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
const Para = ({ text }: { text: string }) => <p className="text-body max-w-[68ch] whitespace-pre-line text-foreground/85">{text}</p>;
const Checks = ({ xs }: { xs: string[] }) => (
  <ul className="flex flex-col gap-3">{xs.map((x, i) => <li key={i} className="text-body flex gap-3 text-foreground/85"><Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden /><span className="min-w-0">{x}</span></li>)}</ul>
);
const Chip = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <li className={cn("text-small rounded-full border px-3 py-1", strong ? "border-accent/40 bg-accent/10 text-foreground" : "border-border bg-surface text-muted-foreground")}>{children}</li>
);

export function AboutRole({ j }: { j: PublicJob }) {
  const d = j.details;
  const hl = ([["You'll work on", d.highlights.work_on], ["You'll learn", d.highlights.learn], ["You'll own", d.highlights.own]] as const).filter(([, v]) => v.trim());
  if (!j.blocks.length && !d.about && !hl.length) return null;
  return (
    <LandingBlock id="about" title="About the role">
      <div className="max-w-[68ch]">{j.blocks.length ? <RichText blocks={j.blocks} /> : d.about && <Para text={d.about} />}</div>
      {hl.length > 0 && (
        <div className={cn("mt-8 grid gap-3", hl.length > 1 && "sm:grid-cols-2", hl.length > 2 && "xl:grid-cols-3")}>
          {hl.map(([k, v]) => <div key={k} className="rounded-md border border-border bg-surface p-5"><p className="text-eyebrow text-accent">{k}</p><p className="text-small mt-3 whitespace-pre-line text-foreground">{v}</p></div>)}
        </div>
      )}
    </LandingBlock>
  );
}

/** Responsibilities vs requirements as accessible tabs. */
export function RoleTabs({ j }: { j: PublicJob }) {
  const d = j.details;
  const edu = [d.education.level && d.education.level !== "Custom" ? `Minimum education: ${d.education.level}` : "", d.education.field && `Preferred field: ${d.education.field}`, d.education.notes].filter(Boolean) as string[];
  const exp = [j.experience, d.experience.kind !== "custom" ? d.experience.text : ""].filter(Boolean).join(" — ");
  const tabs = ([
    ["do", "What You'll Do", d.responsibilities.length ? <Checks xs={d.responsibilities.map((x) => x.text)} /> : null],
    ["look", "What We're Looking For", d.requirements.length || d.preferred.length || edu.length || exp ? (
      <div className="flex flex-col gap-8">
        {d.requirements.length > 0 && <Checks xs={d.requirements.map((x) => x.text)} />}
        {(exp || edu.length > 0) && <dl className="grid gap-3 sm:grid-cols-2">{exp && <Fact k="Experience" v={exp} />}{edu.length > 0 && <Fact k="Education" v={edu.join(" · ")} />}</dl>}
        {d.preferred.length > 0 && <div><p className="text-small mb-3 font-medium text-foreground">Nice to have</p><Checks xs={d.preferred.map((x) => x.text)} /></div>}
      </div>
    ) : null],
  ] as [string, string, ReactNode][]).filter(([, , c]) => c);
  const [tab, setTab] = useState(0);
  if (!tabs.length) return null;
  const cur = tabs[Math.min(tab, tabs.length - 1)]!;
  if (tabs.length === 1) return <LandingBlock id="role" title={cur[1]}>{cur[2]}</LandingBlock>;
  return (
    <LandingBlock id="role" title="The work">
      <div role="tablist" aria-label="Role details" className="flex gap-1 rounded-md border border-border bg-muted p-1"
        onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = (tab + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; setTab(n); document.getElementById(`tab-${tabs[n]![0]}`)?.focus(); } }}>
        {tabs.map(([k, l], i) => (
          <button key={k} id={`tab-${k}`} role="tab" aria-selected={cur[0] === k} aria-controls={`panel-${k}`} tabIndex={cur[0] === k ? 0 : -1} onClick={() => setTab(i)}
            className={cn("text-small min-w-0 flex-1 rounded-sm px-3 py-2 transition-colors", cur[0] === k ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      <div key={cur[0]} id={`panel-${cur[0]}`} role="tabpanel" aria-labelledby={`tab-${cur[0]}`} className="animate-fade-in mt-6">{cur[2]}</div>
    </LandingBlock>
  );
}
const Fact = ({ k, v }: { k: string; v: string }) => <div className="rounded-sm border border-border bg-surface p-4"><dt className="text-caption text-muted-foreground">{k}</dt><dd className="text-small mt-1 text-foreground">{v}</dd></div>;

export function SkillsBlock({ j }: { j: PublicJob }) {
  const d = j.details;
  const req = d.skills.filter((s) => s.level !== "preferred"), pref = d.skills.filter((s) => s.level === "preferred");
  if (!d.skills.length && !d.languages.length) return null;
  return (
    <LandingBlock id="skills" title="Skills">
      <div className="flex flex-col gap-6">
        {req.length > 0 && <div><p className="text-caption mb-2 uppercase tracking-wide text-muted-foreground">Required</p><ul className="flex flex-wrap gap-2">{req.map((s) => <Chip key={s.id} strong>{s.name}</Chip>)}</ul></div>}
        {pref.length > 0 && <div><p className="text-caption mb-2 uppercase tracking-wide text-muted-foreground">Preferred</p><ul className="flex flex-wrap gap-2">{pref.map((s) => <Chip key={s.id}>{s.name}</Chip>)}</ul></div>}
        {d.languages.length > 0 && <div><p className="text-caption mb-2 uppercase tracking-wide text-muted-foreground">Languages</p><ul className="flex flex-wrap gap-2">{d.languages.map((l) => <Chip key={l.id}>{l.language}{l.proficiency && ` · ${l.proficiency}`}</Chip>)}</ul></div>}
      </div>
    </LandingBlock>
  );
}

export function CompBenefits({ j }: { j: PublicJob }) {
  const d = j.details, c = d.commission;
  const incentives = [c.available && (c.percent ? `Commission: ${c.percent.replace(/%?$/, "%")}` : c.range ? `Commission: ${c.range}` : "Commission available"), c.performance_bonus && "Performance bonus", c.target_bonus && "Target bonus"].filter(Boolean) as string[];
  const salary = j.salary !== "Not disclosed";
  const offer = d.offer.items.map((x) => x.text);
  if (!salary && !incentives.length && !c.text && !d.benefits.length && !offer.length && !d.offer.intro) return null;
  return (
    <LandingBlock id="benefits" title="Benefits & compensation">
      {(salary || incentives.length > 0 || c.text) && (
        <div className="rounded-md border border-accent/25 bg-accent/[0.06] p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {salary && <div><p className="text-caption uppercase tracking-wide text-muted-foreground">Salary</p><p className="text-h4 mt-2 text-foreground">{j.salary}</p></div>}
            {incentives.length > 0 && <div><p className="text-caption uppercase tracking-wide text-muted-foreground">Bonus & commission</p><ul className="mt-2 flex flex-col gap-1">{incentives.map((x) => <li key={x} className="text-small text-foreground">{x}</li>)}</ul></div>}
          </div>
          {c.text && <p className="text-small mt-4 whitespace-pre-line text-muted-foreground">{c.text}</p>}
        </div>
      )}
      {d.benefits.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.benefits.map((b) => <li key={b.id} className="rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent/50"><p className="text-small font-medium text-foreground">{b.title}</p>{b.description && <p className="text-caption mt-1 text-muted-foreground">{b.description}</p>}</li>)}
        </ul>
      )}
      {(offer.length > 0 || d.offer.intro) && (
        <div className="mt-8"><p className="text-h4 text-foreground">{d.offer.heading || "What we offer"}</p>{d.offer.intro && <div className="mt-3"><Para text={d.offer.intro} /></div>}{offer.length > 0 && <div className="mt-4"><Checks xs={offer} /></div>}</div>
      )}
    </LandingBlock>
  );
}

export function DayInRole({ j }: { j: PublicJob }) {
  const xs = j.details.day;
  if (!xs.length) return null;
  return (
    <LandingBlock id="day" title="A day in the role">
      <ol className="relative flex flex-col gap-6 border-l border-border pl-6">
        {xs.map((s) => (
          <li key={s.id} className="relative">
            <span aria-hidden className="absolute -left-[29px] top-1.5 size-2.5 rounded-full bg-accent ring-4 ring-background" />
            {s.label && <p className="text-caption font-mono text-accent">{s.label}</p>}
            <p className="text-small mt-0.5 font-medium text-foreground">{s.title}</p>
            {s.text && <p className="text-small mt-1 text-muted-foreground">{s.text}</p>}
          </li>
        ))}
      </ol>
    </LandingBlock>
  );
}

/** Other practical details, compact. */
export function GoodToKnow({ j }: { j: PublicJob }) {
  const d = j.details, sch = d.schedule;
  const rows = ([
    ["Working days", sch.days], ["Days off", sch.days_off], ["Hours", sch.start && sch.end ? `${sch.start} – ${sch.end}` : ""], ["Shift", sch.shift],
    ["Equipment", [d.equipment.laptop && "Laptop", d.equipment.phone && "Smartphone", d.equipment.internet && "Stable internet", d.equipment.headset && "Headset"].filter(Boolean).join(", ")],
    ["Who can apply", d.who.options.join(", ")],
    ["Probation", d.probation.applicable ? [d.probation.duration, d.probation.salary && `salary ${d.probation.salary}`].filter(Boolean).join(" · ") || "Yes" : ""],
    ["Training", d.training.provided ? [d.training.duration, d.training.paid && "paid"].filter(Boolean).join(" · ") || "Provided" : ""],
    ["Career growth", d.growth.steps.map((s) => s.text).join(" → ")],
    ["Eligibility", [d.eligibility.show_age && (d.eligibility.min_age || d.eligibility.max_age) ? `Age ${d.eligibility.min_age || "—"}${d.eligibility.max_age ? `–${d.eligibility.max_age}` : "+"}` : "", d.eligibility.gender, d.eligibility.authorization].filter(Boolean).join(" · ")],
    ["Office", d.office_address], ["Notice period", d.joining.notice],
  ] as [string, string][]).filter(([, v]) => v);
  const notes = [sch.text, d.equipment.text, d.who.text, d.growth.text, d.probation.notes, d.training.text, d.eligibility.notes, d.additional].filter(Boolean);
  if (!rows.length && !notes.length) return null;
  return (
    <LandingBlock id="details" title="Good to know">
      {rows.length > 0 && <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</dl>}
      {notes.length > 0 && <div className="mt-6 flex flex-col gap-4">{notes.map((n, i) => <Para key={i} text={n} />)}</div>}
    </LandingBlock>
  );
}

export function MeetTeam({ j }: { j: PublicJob }) {
  const on = j.details.show_team && !!j.department;
  const { data } = useQuery({ ...teamQuery, enabled: on });
  const people = (data ?? []).filter((m) => m.department && m.department.toLowerCase() === j.department!.toLowerCase()).slice(0, 4);
  if (!on || !people.length) return null;
  return (
    <LandingBlock id="team" title="Meet the team">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {people.map((m) => (
          <li key={m.id} className="rounded-md border border-border bg-surface p-4">
            {m.photo ? <img src={m.photo} alt="" loading="lazy" className="aspect-square w-full rounded-sm object-cover" /> : <div className="text-h3 grid aspect-square w-full place-items-center rounded-sm bg-muted text-muted-foreground">{m.name.charAt(0)}</div>}
            <p className="text-small mt-3 font-medium text-foreground">{m.name}</p>
            {m.role && <p className="text-caption text-muted-foreground">{m.role}</p>}
          </li>
        ))}
      </ul>
    </LandingBlock>
  );
}

export function HiringProcess({ j }: { j: PublicJob }) {
  const xs = j.details.process;
  if (!xs.length) return null;
  return (
    <section aria-labelledby="process-h" className="dark bg-background py-14 text-foreground md:py-20">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-[var(--gutter)]">
        <p className="text-eyebrow text-accent">How hiring works</p>
        <h2 id="process-h" className="text-h2 mt-3">Hiring process</h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
          {xs.map((s, i) => (
            <li key={s.id} className="group bg-background p-5 transition-colors hover:bg-surface">
              <div className="flex items-center gap-3">
                <span className="text-caption grid size-7 shrink-0 place-items-center rounded-full border border-accent/60 font-mono text-accent tabular-nums group-hover:bg-accent group-hover:text-accent-foreground">{i + 1}</span>
                <span aria-hidden className="h-px flex-1 bg-border" />
              </div>
              <p className="text-small mt-4 font-medium">{s.title}</p>
              {s.text && <p className="text-caption mt-1 text-muted-foreground">{s.text}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function JobFaq({ j }: { j: PublicJob }) {
  const xs = j.details.faqs;
  if (!xs.length) return null;
  return (
    <LandingBlock id="faq" title="Questions about this role">
      <div className="divide-y divide-border rounded-md border border-border bg-surface">
        {xs.map((f) => (
          <details key={f.id} className="group">
            <summary className="text-small flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {f.title}<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="text-small whitespace-pre-line px-5 pb-5 text-muted-foreground">{f.text}</p>
          </details>
        ))}
      </div>
    </LandingBlock>
  );
}
