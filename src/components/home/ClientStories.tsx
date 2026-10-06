import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { BrantaVideo } from "@/components/media/BrantaVideo";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import type { ClientStories as Data, Story } from "@/lib/client-stories.functions";

function useAnimated() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const sync = () => setOn(mq.matches);
    sync(); mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return on;
}

const MASK = "[mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]";

export function ClientStories({ data }: { data: NonNullable<Data> }) {
  const animated = useAnimated();
  const [active, setActive] = useState<Story | null>(null);
  const head = useReveal<HTMLDivElement>();
  return (
    <Section tone="warm" bleed className="overflow-hidden" id="client-stories">
      <StoryModal story={active} onClose={() => setActive(null)} />
      <SiteContainer>
        <div ref={head} className="group/h max-w-2xl">
          <p className="text-eyebrow flex items-center gap-2 text-muted-foreground opacity-0 transition-opacity duration-700 group-data-[revealed=true]/h:opacity-100">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />{data.eyebrow}
          </p>
          <h2 className="text-display mt-4 whitespace-pre-line text-foreground translate-y-6 opacity-0 transition-all delay-150 duration-700 ease-out group-data-[revealed=true]/h:translate-y-0 group-data-[revealed=true]/h:opacity-100">{data.title}</h2>
          {data.body && <p className="text-body mt-4 text-muted-foreground opacity-0 transition-opacity delay-300 duration-700 group-data-[revealed=true]/h:opacity-100">{data.body}</p>}
        </div>
      </SiteContainer>

      {data.text.length > 0 && (
        <Row label="Client testimonials" items={data.text} animated={animated} from="right" duration={data.speed} paused={!!active}
          render={(s, dup) => <QuoteCard s={s} dup={dup} />} />
      )}

      {data.videos.length > 0 && (
        <>
          <SiteContainer>
            <div className={cn(data.text.length ? "mt-20" : "mt-12")}>
              <p className="text-eyebrow flex items-center gap-2 text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-accent" />{data.videoEyebrow}</p>
              {data.videoBody && <p className="text-body mt-3 text-muted-foreground">{data.videoBody}</p>}
            </div>
          </SiteContainer>
          <Row label="Video testimonials" items={data.videos} animated={animated} from="left" duration={data.speed * 0.9} paused={!!active}
            render={(s, dup) => <VideoCard s={s} dup={dup} onOpen={() => setActive(s)} />} />
        </>
      )}
    </Section>
  );
}

function Row({ label, items, animated, from, duration, paused, render }: {
  label: string; items: Story[]; animated: boolean; from: "left" | "right"; duration: number; paused: boolean;
  render: (s: Story, dup: boolean) => React.ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>(0.05);
  const reps = animated ? Math.max(1, Math.ceil(8 / items.length)) : 1;
  const base = Array.from({ length: reps }, () => items).flat();
  const track = animated ? [...base, ...base] : base;
  const entry = from === "right" ? "translate-x-10" : "-translate-x-10";
  return (
    <div ref={ref} className={cn("mt-10 opacity-0 transition-all duration-1000 ease-out data-[revealed=true]:translate-x-0 data-[revealed=true]:opacity-100", entry)}>
      {animated ? (
        <div className={cn("group/row overflow-x-clip py-8 -my-8", MASK)}>
          <ul role="list" aria-label={label}
            className={cn("flex w-max gap-6 pl-6 animate-marquee group-hover/row:[animation-play-state:paused] group-focus-within/row:[animation-play-state:paused]",
              paused && "[animation-play-state:paused]", from === "left" && "[animation-direction:reverse]")}
            style={{ ["--marquee-duration" as string]: `${Math.round(duration * Math.max(1, track.length / 10))}s` }}>
            {track.map((s, i) => <li key={i} className="shrink-0" aria-hidden={i >= items.length || undefined}>{render(s, i >= items.length)}</li>)}
          </ul>
        </div>
      ) : (
        <ul role="list" aria-label={label} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-4 [scrollbar-width:none]">
          {track.map((s, i) => <li key={i} className="shrink-0 snap-start">{render(s, false)}</li>)}
        </ul>
      )}
    </div>
  );
}

function Who({ s, light }: { s: Story; light?: boolean }) {
  return (
    <div className="text-small">
      <p className={cn("font-medium", light ? "text-[color:var(--media-ink)]" : "text-foreground")}>{s.name}</p>
      {(s.role || s.company) && <p className={light ? "text-[color:var(--media-ink)]/80" : "text-muted-foreground"}>{[s.role, s.company].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

function QuoteCard({ s, dup }: { s: Story; dup: boolean }) {
  return (
    <article className="group/card flex h-[520px] w-[85vw] max-w-[360px] flex-col overflow-hidden rounded-[14px] border border-border bg-background transition-transform duration-500 ease-out hover:scale-[1.03] motion-reduce:hover:scale-100 md:w-[360px]">
      <div className="relative h-[46%] shrink-0 overflow-hidden bg-muted">
        {s.photo ? (
          <img src={s.photo} alt={s.name} loading="lazy" decoding="async" sizes="(max-width: 429px) 85vw, 360px" className="h-full w-full object-cover object-top transition-transform duration-700 group-hover/card:scale-[1.04]" />
        ) : (
          <div className="flex h-full items-center justify-center text-display text-muted-foreground">{s.name.charAt(0)}</div>
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="flex flex-1 flex-col px-6 pb-6 pt-2">
        <span aria-hidden className="font-serif text-5xl leading-none text-accent">“</span>
        <blockquote className="text-body-lg mt-1 line-clamp-6 text-foreground">{s.quote}</blockquote>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <Who s={s} />
            {s.service && <p className="text-caption mt-1 uppercase tracking-wide text-accent">{s.service}</p>}
          </div>
          {s.projectSlug && (
            <Link to="/work/$slug" params={{ slug: s.projectSlug }} tabIndex={dup ? -1 : undefined}
              className="text-caption shrink-0 text-muted-foreground underline-offset-4 hover:text-accent hover:underline">View Project →</Link>
          )}
        </div>
      </div>
    </article>
  );
}

function VideoCard({ s, dup, onOpen }: { s: Story; dup: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(t);
      if (e?.isIntersecting) setNear(true); else t = setTimeout(() => setNear(false), 3000);
    }, { rootMargin: "100px 60px" });
    io.observe(el);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
  const v = s.video!;
  return (
    <button ref={ref} type="button" onClick={onOpen} tabIndex={dup ? -1 : undefined}
      aria-label={`Play video testimonial from ${s.name}${s.company ? `, ${s.company}` : ""}`}
      className="group/card relative block aspect-[9/16] w-[68vw] max-w-[260px] overflow-hidden rounded-[14px] bg-muted text-left transition-transform duration-500 ease-out hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-accent motion-reduce:hover:scale-100 md:w-[250px]">
      <BrantaVideo kind={v.kind} url={v.url} poster={v.poster} alt={s.name} priority="lazy" autoplay loop cover active={near} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[color:var(--media-scrim)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
        <Who s={s} light />
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover/card:scale-110"><Play className="size-4 fill-current" aria-hidden /></span>
      </div>
    </button>
  );
}

/** Portrait popup: same look as the Work modal, keeps 9:16, starts muted, one player only while open. */
function StoryModal({ story, onClose }: { story: Story | null; onClose: () => void }) {
  const v = story?.video;
  return (
    <DialogPrimitive.Root open={!!story} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dark fixed inset-0 z-50 bg-background/85 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        {story && v && (
          <DialogPrimitive.Content aria-describedby={undefined}
            className="dark fixed left-1/2 top-1/2 z-50 flex max-h-[94vh] w-[calc(100vw-1.5rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-hidden rounded-[14px] border border-border bg-background p-3 text-foreground outline-none md:flex-row md:items-stretch md:gap-6 md:p-6 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
            <div className="relative aspect-[9/16] h-[min(78vh,640px)] max-w-full overflow-hidden rounded-[10px] bg-muted/10">
              <BrantaVideo key={story.id} kind={v.kind} url={v.url} poster={v.poster} alt={story.name} priority="critical" autoplay loop sound playButton active />
            </div>
            <div className="flex w-full items-center justify-between gap-4 px-2 pt-3 md:flex-col md:items-start md:px-0 md:pt-2">
              <div className="min-w-0">
                <p className="text-caption flex items-center gap-2 uppercase tracking-wide text-muted-foreground"><span aria-hidden className="size-1.5 rounded-full bg-accent" />Video story</p>
                <DialogPrimitive.Title className="text-h4 mt-1 text-foreground">{story.name}</DialogPrimitive.Title>
                {(story.role || story.company) && <p className="text-small text-muted-foreground">{[story.role, story.company].filter(Boolean).join(" · ")}</p>}
                {story.projectSlug && (
                  <Link to="/work/$slug" params={{ slug: story.projectSlug }} onClick={onClose} className="text-small mt-3 hidden font-medium underline decoration-accent underline-offset-8 hover:text-accent md:inline-block">View Project →</Link>
                )}
              </div>
              <DialogPrimitive.Close aria-label="Close video"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground md:mt-auto">
                <X className="size-5" aria-hidden />
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
