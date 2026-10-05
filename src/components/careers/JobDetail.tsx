import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { RichText } from "@/components/content/RichText";
import { formatDeadline, type PublicJob } from "@/lib/job-details";

/** Compact facts card near the top of a job page. */
export function JobFacts({ j }: { j: PublicJob }) {
  const d = j.details;
  const joining = d.joining.immediate ? "Immediate" : d.joining.text || (d.joining.date ? formatDeadline(d.joining.date) : "");
  const facts: [string, string][] = ([
    ["Location", j.location ?? ""], ["Employment type", j.type ?? ""], ["Work mode", j.workMode ?? ""], ["Salary", j.salary],
    ["Vacancy", j.vacancies ? String(j.vacancies) : ""], ["Experience", j.experience], ["Working hours", j.hours],
    ["Deadline", j.deadlineAt ? formatDeadline(j.deadlineAt) : ""], ["Joining", joining],
  ] as [string, string][]).filter(([, v]) => v);
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
      {facts.map(([k, v]) => (
        <div key={k} className="min-w-0 bg-surface p-4">
          <dt className="text-caption text-muted-foreground">{k}</dt>
          <dd className="text-small mt-1 break-words font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <h2 className="text-h3 text-foreground">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
const List = ({ xs }: { xs: string[] }) => (
  <ul className="text-body flex list-disc flex-col gap-2 pl-6 text-foreground/85">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul>
);
const Para = ({ text }: { text: string }) => <p className="text-body whitespace-pre-line text-foreground/85">{text}</p>;

/** Structured body of a job page: every section renders only when it has content. */
export function JobBody({ j }: { j: PublicJob }) {
  const d = j.details;
  const eq = [d.equipment.laptop && "Personal laptop", d.equipment.phone && "Personal smartphone", d.equipment.internet && "Stable internet connection", d.equipment.headset && "Headset"].filter(Boolean) as string[];
  const sch = d.schedule;
  const schedule = ([["Working days", sch.days], ["Days off", sch.days_off], ["Hours", sch.start && sch.end ? `${sch.start} – ${sch.end}` : ""], ["Hours per day", sch.hours_day], ["Hours per week", sch.hours_week], ["Shift", sch.shift]] as [string, string][]).filter(([, v]) => v);
  const edu = [d.education.level && d.education.level !== "Custom" ? `Minimum education: ${d.education.level}` : "", d.education.field && `Preferred field: ${d.education.field}`].filter(Boolean);
  const comm = d.commission;
  const incentives = [comm.available && (comm.percent ? `Commission: ${comm.percent.replace(/%?$/, "%")}` : comm.range ? `Commission: ${comm.range}` : "Commission available"), comm.performance_bonus && "Performance bonus", comm.target_bonus && "Target bonus"].filter(Boolean) as string[];
  const elig = [d.eligibility.show_age && (d.eligibility.min_age || d.eligibility.max_age) ? `Age: ${d.eligibility.min_age || "—"}${d.eligibility.max_age ? `–${d.eligibility.max_age}` : "+"}` : "", d.eligibility.gender, d.eligibility.authorization].filter(Boolean);
  const who = [...d.who.options];
  return (
    <div className="min-w-0">
      {(j.blocks.length > 0 || d.about) && <Block title="About the role">{j.blocks.length ? <RichText blocks={j.blocks} /> : <Para text={d.about} />}</Block>}
      {d.responsibilities.length > 0 && <Block title="Responsibilities"><List xs={d.responsibilities.map((x) => x.text)} /></Block>}
      {d.requirements.length > 0 && <Block title="Requirements"><List xs={d.requirements.map((x) => x.text)} /></Block>}
      {d.preferred.length > 0 && <Block title="Preferred qualifications"><List xs={d.preferred.map((x) => x.text)} /></Block>}
      {(edu.length > 0 || d.education.notes) && <Block title="Education">{edu.length > 0 && <List xs={edu} />}{d.education.notes && <div className="mt-3"><Para text={d.education.notes} /></div>}</Block>}
      {(j.experience || d.experience.text) && <Block title="Experience"><Para text={[j.experience, d.experience.kind !== "custom" ? d.experience.text : ""].filter(Boolean).join("\n")} /></Block>}
      {(d.skills.length > 0 || d.languages.length > 0) && (
        <Block title="Skills">
          {d.skills.length > 0 && <ul className="flex flex-wrap gap-2">{d.skills.map((s) => <li key={s.id} className="text-caption rounded-sm border border-border px-2.5 py-1 text-foreground">{s.name}{s.level === "preferred" && <span className="text-muted-foreground"> · preferred</span>}</li>)}</ul>}
          {d.languages.length > 0 && <dl className="mt-5 grid gap-2 sm:grid-cols-2">{d.languages.map((l) => <div key={l.id} className="text-small"><dt className="inline font-medium text-foreground">{l.language}: </dt><dd className="inline text-muted-foreground">{[l.proficiency, l.note].filter(Boolean).join(" — ")}</dd></div>)}</dl>}
        </Block>
      )}
      {(eq.length > 0 || d.equipment.text) && (
        <Block title="Equipment you'll need">
          {eq.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">{eq.map((x) => <li key={x} className="text-small flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 font-medium text-foreground"><Check className="size-4 shrink-0 text-accent" aria-hidden />{x} required</li>)}</ul>}
          {d.equipment.text && <div className="mt-3"><Para text={d.equipment.text} /></div>}
        </Block>
      )}
      {(schedule.length > 0 || sch.text) && (
        <Block title="Working hours">
          {schedule.length > 0 && <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{schedule.map(([k, v]) => <div key={k}><dt className="text-caption text-muted-foreground">{k}</dt><dd className="text-small text-foreground">{v}</dd></div>)}</dl>}
          {sch.text && <div className="mt-4"><Para text={sch.text} /></div>}
        </Block>
      )}
      {(incentives.length > 0 || comm.text) && <Block title="Compensation & incentives"><p className="text-body font-medium text-foreground">{j.salary}</p>{incentives.length > 0 && <div className="mt-3"><List xs={incentives} /></div>}{comm.text && <div className="mt-3"><Para text={comm.text} /></div>}</Block>}
      {d.benefits.length > 0 && (
        <Block title="Benefits & perks">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {d.benefits.map((b) => <li key={b.id} className="rounded-sm border border-border bg-surface px-4 py-3"><p className="text-small font-medium text-foreground">{b.title}</p>{b.description && <p className="text-caption mt-1 text-muted-foreground">{b.description}</p>}</li>)}
          </ul>
        </Block>
      )}
      {(d.offer.items.length > 0 || d.offer.intro) && <Block title={d.offer.heading || "What we offer"}>{d.offer.intro && <Para text={d.offer.intro} />}{d.offer.items.length > 0 && <div className="mt-3"><List xs={d.offer.items.map((x) => x.text)} /></div>}</Block>}
      {(d.growth.steps.length > 0 || d.growth.text) && (
        <Block title="Career growth">
          {d.growth.text && <Para text={d.growth.text} />}
          {d.growth.steps.length > 0 && <ol className="mt-3 flex flex-col gap-2">{d.growth.steps.map((s, i) => <li key={s.id} className="text-small flex items-center gap-3 text-foreground"><span className="text-caption grid size-6 shrink-0 place-items-center rounded-full border border-border tabular-nums">{i + 1}</span>{s.text}</li>)}</ol>}
        </Block>
      )}
      {(d.probation.applicable || d.training.provided) && (
        <Block title="Probation & training">
          <List xs={[
            d.probation.applicable && `Probation${d.probation.duration ? `: ${d.probation.duration}` : ""}${d.probation.salary ? ` (salary during probation: ${d.probation.salary})` : ""}`,
            d.probation.notes, d.training.provided && `Training provided${d.training.duration ? `: ${d.training.duration}` : ""}${d.training.paid ? " (paid)" : ""}`, d.training.text,
          ].filter(Boolean) as string[]} />
        </Block>
      )}
      {(who.length > 0 || d.who.text) && <Block title="Who can apply">{who.length > 0 && <ul className="flex flex-wrap gap-2">{who.map((w) => <li key={w} className="text-caption rounded-sm border border-border px-2.5 py-1 text-foreground">{w}</li>)}</ul>}{d.who.text && <div className="mt-3"><Para text={d.who.text} /></div>}</Block>}
      {(elig.length > 0 || d.eligibility.notes) && <Block title="Eligibility">{elig.length > 0 && <List xs={elig} />}{d.eligibility.notes && <div className="mt-3"><Para text={d.eligibility.notes} /></div>}</Block>}
      {(d.office_address || d.joining.notice) && <Block title="Additional details"><List xs={[d.office_address && `Office: ${d.office_address}`, d.joining.notice && `Notice period: ${d.joining.notice}`].filter(Boolean) as string[]} /></Block>}
      {d.additional && <Block title="Additional information"><Para text={d.additional} /></Block>}
    </div>
  );
}

export function JobBadges({ j }: { j: Pick<PublicJob, "featured" | "urgent" | "window"> }) {
  return (
    <>
      {j.urgent && <span className="text-caption rounded-sm bg-accent px-2 py-0.5 font-medium text-accent-foreground">Urgent hiring</span>}
      {j.featured && <span className="text-caption rounded-sm border border-accent px-2 py-0.5 text-accent">Featured</span>}
      {j.window === "closed" && <span className="text-caption rounded-sm border border-border px-2 py-0.5 text-muted-foreground">Applications closed</span>}
    </>
  );
}
