import { useState } from "react";
import { Section } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import type { CompanySection, TeamMember } from "@/lib/company.functions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** CMS "text" sections as alternating editorial blocks. Only fields that exist render. */
export function CompanySections({ sections, startTone = 0 }: { sections: CompanySection[]; startTone?: number }) {
  return (
    <>
      {sections.map((s, i) => {
        const dark = (i + startTone) % 2 === 1;
        return (
          <Section key={s.id} tone={dark ? "dark" : "warm"} aria-labelledby={`s-${s.id}`} className="border-t border-border">
            <div className={cn("grid gap-10 lg:grid-cols-12", s.media && "lg:items-center")}>
              <div className={cn("min-w-0", s.media ? "lg:col-span-6" : "lg:col-span-4")}>
                {s.eyebrow && <p className="text-eyebrow text-accent">{s.eyebrow}</p>}
                {s.title && <h2 id={`s-${s.id}`} className="text-h1 mt-4 break-words text-foreground">{s.title}</h2>}
              </div>
              <div className={cn("min-w-0", s.media ? "lg:col-span-6" : "lg:col-span-7 lg:col-start-6")}>
                {s.media && <img src={s.media} alt={s.title || ""} loading="lazy" decoding="async" className="mb-8 aspect-[4/3] w-full rounded-[6px] object-cover" />}
                {s.body && <p className="text-body-lg whitespace-pre-line text-muted-foreground">{s.body}</p>}
                {s.ctaLabel && s.ctaUrl && <div className="mt-8"><HeroAction label={s.ctaLabel} url={s.ctaUrl} variant={dark ? "secondary" : "primary"} /></div>}
              </div>
            </div>
          </Section>
        );
      })}
    </>
  );
}

/** Editorial portraits; members with a full bio open a detail dialog. */
export function TeamGrid({ members }: { members: TeamMember[] }) {
  const [open, setOpen] = useState<TeamMember | null>(null);
  return (
    <>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m, i) => {
          const body = (
            <>
              <div className={cn("overflow-hidden rounded-[6px] bg-muted", i % 3 === 1 && "lg:mt-16")}>
                {m.photo ? <img src={m.photo} alt={`Portrait of ${m.name}`} loading="lazy" decoding="async" className="media-zoom aspect-[4/5] w-full object-cover" />
                  : <div aria-hidden className="grid aspect-[4/5] place-items-center text-display text-muted-foreground/40">{m.name.charAt(0)}</div>}
              </div>
              <h3 className="text-h3 mt-5 text-foreground">{m.name}</h3>
              {m.role && <p className="text-small mt-1 text-accent">{m.role}</p>}
              {m.shortBio && <p className="text-small mt-3 text-muted-foreground">{m.shortBio}</p>}
            </>
          );
          return (
            <li key={m.id} className="min-w-0">
              {m.fullBio ? (
                <button type="button" onClick={() => setOpen(m)} className="group block w-full text-left" aria-label={`Read more about ${m.name}`}>{body}</button>
              ) : <div className="group">{body}</div>}
              {m.linkedin && <a href={m.linkedin} target="_blank" rel="noopener noreferrer" className="text-caption mt-3 inline-block underline underline-offset-4">LinkedIn</a>}
            </li>
          );
        })}
      </ul>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          {open && (
            <>
              <DialogTitle>{open.name}</DialogTitle>
              {open.role && <DialogDescription>{open.role}</DialogDescription>}
              <p className="text-body whitespace-pre-line text-muted-foreground">{open.fullBio}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
