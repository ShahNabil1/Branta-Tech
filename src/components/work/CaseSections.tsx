import { useState, type ReactNode } from "react";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { VideoPlayer } from "@/components/work/VideoPlayer";
import type { CaseMedia } from "@/lib/case-study";
import type { CaseSection, CaseStudy, Credit } from "@/lib/work.functions";
import { cn } from "@/lib/utils";

const DEFAULT_EYEBROW: Record<string, string> = {
  challenge: "THE CHALLENGE", solution: "APPROACH", result: "RESULT", process: "PROCESS", credits: "CREDITS",
  key_facts: "PROJECT DETAILS", quote: "CLIENT FEEDBACK", before_after: "BEFORE / AFTER", gallery: "GALLERY",
};

export function MediaFigure({ m, title, className, ratio = "aspect-video" }: { m: CaseMedia; title: string; className?: string; ratio?: string }) {
  return (
    <figure className={cn("min-w-0", className)}>
      {m.type === "image" ? (
        <img src={m.url} alt={m.alt || title} loading="lazy" decoding="async" className="h-auto w-full rounded-[4px] bg-muted/10" />
      ) : (
        <VideoPlayer type={m.type} url={m.url} poster={m.poster || null} title={m.alt || title} mode="controls" className={cn("rounded-[4px]", ratio)} />
      )}
      {m.caption && <figcaption className="text-caption mt-3 text-muted-foreground">{m.caption}</figcaption>}
    </figure>
  );
}

function Shell({ s, children, bleed }: { s: CaseSection; children: ReactNode; bleed?: boolean }) {
  const Tag = s.config.tone === "dark" ? DarkSection : Section;
  const label = s.title || s.eyebrow || DEFAULT_EYEBROW[s.type];
  return <Tag bleed={!!bleed} {...(label ? { "aria-label": label } : {})}>{children}</Tag>;
}

function Intro({ s, wide }: { s: CaseSection; wide?: boolean }) {
  const eyebrow = s.eyebrow || DEFAULT_EYEBROW[s.type];
  if (!eyebrow && !s.title && !s.body) return null;
  return (
    <div className={cn("grid gap-6 md:grid-cols-12 md:gap-10", wide && "mb-10 md:mb-14")}>
      <div className="md:col-span-4">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {s.title && <h2 className="text-h2 mt-4 text-foreground">{s.title}</h2>}
      </div>
      {s.body && <p className="text-body-lg whitespace-pre-line text-muted-foreground md:col-span-8 md:col-start-5">{s.body}</p>}
    </div>
  );
}

const width = (l: string) => (l === "contained" ? "mx-auto max-w-4xl" : l === "portrait" ? "mx-auto max-w-2xl" : "");

function BeforeAfter({ s, title }: { s: CaseSection; title: string }) {
  const [pos, setPos] = useState(50);
  const c = s.config;
  if (!c.before_url || !c.after_url) return null;
  return (
    <div className="relative mx-auto aspect-[4/3] max-w-5xl select-none overflow-hidden rounded-[4px] bg-muted/10">
      <img src={c.after_url} alt={c.after_alt || `${title} after`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <img src={c.before_url} alt={c.before_alt || `${title} before`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span aria-hidden className="absolute inset-y-0 w-px bg-accent" style={{ left: `${pos}%` }} />
      <span className="text-caption absolute left-3 top-3 rounded-[3px] bg-background/80 px-2 py-1">Before</span>
      <span className="text-caption absolute right-3 top-3 rounded-[3px] bg-background/80 px-2 py-1">After</span>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}

export function CreditsList({ credits }: { credits: Credit[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-3">
      {credits.map((c, i) => {
        const inner = (
          <span className="flex items-center gap-4">
            {c.photo && <img src={c.photo} alt="" loading="lazy" className="size-12 rounded-full object-cover" />}
            <span>
              <span className="text-caption block uppercase tracking-wider text-muted-foreground">{c.role}</span>
              <span className="text-body mt-1 block font-medium text-foreground">{c.name}</span>
            </span>
          </span>
        );
        return (
          <li key={i}>
            {c.profile ? <a href={c.profile} target="_blank" rel="noreferrer" className="hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">{inner}</a> : inner}
          </li>
        );
      })}
    </ul>
  );
}

export function FactsList({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((f, i) => (
        <div key={i}>
          <dt className="text-caption uppercase tracking-wider text-muted-foreground">{f.label}</dt>
          <dd className="text-body mt-2 text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionView({ s, cs }: { s: CaseSection; cs: NonNullable<CaseStudy> }) {
  const title = cs.project.title;
  const { layout, media } = s.config;
  const first = media[0];
  switch (s.type) {
    case "full_image":
    case "full_video": {
      if (!first) return null;
      const full = layout === "full";
      return (
        <Shell s={s} bleed={full}>
          {!full && <Intro s={s} wide />}
          <div className={cn(width(layout))}>
            <MediaFigure m={first} title={title} ratio={layout === "portrait" ? "aspect-[4/5]" : "aspect-video"} className={full ? "[&_img]:rounded-none [&>div]:rounded-none" : ""} />
          </div>
        </Shell>
      );
    }
    case "image_grid":
    case "two_column_media":
    case "gallery": {
      if (!media.length) return null;
      const cols = s.type === "two_column_media" || layout === "two-up" ? "md:grid-cols-2" : "md:grid-cols-3";
      return (
        <Shell s={s}>
          <Intro s={s} wide />
          {s.type === "gallery" ? (
            <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 [&>figure]:mb-6 [&>figure]:break-inside-avoid">
              {media.map((m, i) => <MediaFigure key={i} m={m} title={title} />)}
            </div>
          ) : (
            <div className={cn("grid grid-cols-1 gap-6 md:items-start", cols)}>
              {media.map((m, i) => <MediaFigure key={i} m={m} title={title} />)}
            </div>
          )}
        </Shell>
      );
    }
    case "text_media": {
      const right = layout === "text-right";
      return (
        <Shell s={s}>
          <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
            <div className={cn(right && "md:order-2")}>
              {(s.eyebrow) && <Eyebrow>{s.eyebrow}</Eyebrow>}
              {s.title && <h2 className="text-h2 mt-4 text-foreground">{s.title}</h2>}
              {s.body && <p className="text-body-lg mt-6 whitespace-pre-line text-muted-foreground">{s.body}</p>}
            </div>
            {first && <MediaFigure m={first} title={title} />}
          </div>
        </Shell>
      );
    }
    case "process":
      return (
        <Shell s={s}>
          <Intro s={s} wide />
          {s.config.items.length > 0 && (
            <ol className="grid gap-px overflow-hidden rounded-[4px] border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {s.config.items.map((it, i) => (
                <li key={i} className="bg-background p-6 md:p-8">
                  <span className="text-caption font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                  {it.label && <h3 className="text-h4 mt-3 text-foreground">{it.label}</h3>}
                  {it.value && <p className="text-small mt-2 whitespace-pre-line text-muted-foreground">{it.value}</p>}
                </li>
              ))}
            </ol>
          )}
        </Shell>
      );
    case "before_after":
      return <Shell s={s}><Intro s={s} wide /><BeforeAfter s={s} title={title} /></Shell>;
    case "quote": {
      if (!s.body) return null;
      const c = s.config;
      const who = [c.quote_role, c.quote_company].filter(Boolean).join(", ");
      return (
        <Shell s={s}>
          <figure className="mx-auto max-w-4xl">
            <Eyebrow>{s.eyebrow || DEFAULT_EYEBROW["quote"]}</Eyebrow>
            <blockquote className="text-h1 mt-6 whitespace-pre-line text-foreground"><span aria-hidden className="text-accent">“</span>{s.body}<span aria-hidden className="text-accent">”</span></blockquote>
            {(c.quote_name || who) && (
              <figcaption className="mt-8 flex items-center gap-4">
                {c.quote_avatar && <img src={c.quote_avatar} alt="" loading="lazy" className="size-12 rounded-full object-cover" />}
                <span>
                  {c.quote_name && <span className="text-body block font-medium text-foreground">{c.quote_name}</span>}
                  {who && <span className="text-caption block text-muted-foreground">{who}</span>}
                </span>
              </figcaption>
            )}
          </figure>
        </Shell>
      );
    }
    case "credits":
      if (!cs.credits.length) return null;
      return <Shell s={s}><Intro s={s} wide /><CreditsList credits={cs.credits} /></Shell>;
    case "key_facts": {
      const facts = s.config.items.length ? s.config.items : projectFacts(cs);
      if (!facts.length) return null;
      return <Shell s={s}><Intro s={s} wide /><FactsList facts={facts} /></Shell>;
    }
    default: {
      // rich_text, challenge, solution, result, custom
      if (!s.title && !s.body && !media.length) return null;
      return (
        <Shell s={s}>
          <Intro s={s} wide={media.length > 0} />
          {media.length > 0 && (
            <div className={cn("grid gap-6", layout === "three-up" ? "md:grid-cols-3" : layout === "two-up" || media.length > 1 ? "md:grid-cols-2" : "", width(layout))}>
              {media.map((m, i) => <MediaFigure key={i} m={m} title={title} />)}
            </div>
          )}
        </Shell>
      );
    }
  }
}

export function projectFacts(cs: NonNullable<CaseStudy>) {
  const p = cs.project;
  return [
    p.client && { label: "Client", value: p.client },
    p.industry && { label: "Industry", value: p.industry },
    p.services.length > 0 && { label: "Services", value: p.services.map((s) => s.name).join(", ") },
    p.timeline && { label: "Timeline", value: p.timeline },
    p.year && { label: "Year", value: String(p.year) },
  ].filter((x): x is { label: string; value: string } => !!x);
}

export function CaseSections({ cs }: { cs: NonNullable<CaseStudy> }) {
  return <>{cs.sections.map((s) => <SectionView key={s.id} s={s} cs={cs} />)}</>;
}
