import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { SiteContainer } from "@/components/layout/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { HeroAction } from "@/components/home/Hero";
import { vimeoId } from "@/lib/hero";
import type { CapExplorerContent } from "@/lib/capabilities";

type Item = CapExplorerContent["items"][number];

/* ---------- media layers ---------- */

function ImageLayer({ item, active }: { item: Item; active: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={item.media.url}
      alt={active ? item.media.alt : ""}
      aria-hidden={!active}
      decoding="async"
      loading={active ? "eager" : "lazy"}
      onLoad={() => setLoaded(true)}
      ref={(el) => { if (el?.complete && el.naturalWidth) setLoaded(true); }}
      className={cn(
        "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-[450ms] ease-[var(--ease-out-expo)]",
        active && loaded ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
      )}
    />
  );
}

function VimeoLayer({ item, active }: { item: Item; active: boolean }) {
  const id = vimeoId(item.media.url);
  const frame = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [allow, setAllow] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setAllow(!reduced && !save);
  }, []);
  useEffect(() => {
    if (!active) { setPlaying(false); return; }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com" || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string } = {};
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === "ready") {
        for (const v of ["play", "timeupdate"]) frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: v }), "https://player.vimeo.com");
      }
      if (d.event === "play" || d.event === "timeupdate" || d.event === "playProgress") setPlaying(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [active]);
  return (
    <div aria-hidden={!active} className={cn("absolute inset-0 transition-[opacity,transform] duration-[450ms] ease-[var(--ease-out-expo)]", active ? "scale-100 opacity-100" : "scale-[1.03] opacity-0")}>
      {item.media.poster_url && <img src={item.media.poster_url} alt={item.media.alt} decoding="async" className="absolute inset-0 size-full object-cover" />}
      {/* Only the active film mounts its player; switching away unmounts it (stops playback). */}
      {active && allow && id && (
        <iframe
          ref={frame}
          title={item.media.alt || `${item.label} film`}
          tabIndex={-1}
          src={`https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1`}
          allow="autoplay; fullscreen; picture-in-picture"
          className={cn("pointer-events-none absolute inset-0 size-full border-0 transition-opacity duration-700", playing ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}

function VideoLayer({ item, active }: { item: Item; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) void v.play().catch(() => {});
    else v.pause();
  }, [active]);
  return (
    <video
      ref={ref}
      src={item.media.url}
      poster={item.media.poster_url || undefined}
      muted loop playsInline preload={active ? "auto" : "none"}
      aria-hidden={!active}
      aria-label={item.media.alt || undefined}
      className={cn("absolute inset-0 size-full object-cover transition-[opacity,transform] duration-[450ms] ease-[var(--ease-out-expo)]", active ? "scale-100 opacity-100" : "scale-[1.03] opacity-0")}
    />
  );
}

const FLOW = ["Trigger", "AI agent", "CRM", "Notify team"];

function WorkflowLayer({ item, active }: { item: Item; active: boolean }) {
  return (
    <div aria-hidden={!active} className={cn("absolute inset-0 grid place-items-center bg-surface transition-opacity duration-[450ms]", active ? "opacity-100" : "opacity-0")}>
      <svg viewBox="0 0 640 360" role="img" aria-label={item.media.alt || "Automation workflow diagram"} className="h-auto w-[88%] max-w-[560px]">
        {FLOW.slice(0, -1).map((_, i) => (
          <line key={i} x1={80 + i * 160 + 52} y1={180} x2={80 + (i + 1) * 160 - 52} y2={180} className="cap-flow stroke-foreground/40" strokeWidth={1.5} />
        ))}
        <path d="M 240 140 C 240 80, 400 80, 400 140" fill="none" className="cap-flow stroke-foreground/20" strokeWidth={1.2} />
        {FLOW.map((label, i) => (
          <g key={label} transform={`translate(${80 + i * 160} 180)`}>
            <rect x={-52} y={-26} width={104} height={52} rx={6} className={cn("fill-background stroke-border", i === 1 && "stroke-accent")} strokeWidth={1.2} />
            <circle cx={-38} cy={-12} r={3} className={cn("cap-pulse", i === 1 ? "fill-accent" : "fill-foreground/50")} style={{ animationDelay: `${i * 400}ms` }} />
            <text textAnchor="middle" y={5} className="fill-foreground text-[15px] font-medium">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function EmptyMedia({ item, active }: { item: Item; active: boolean }) {
  return (
    <div aria-hidden className={cn("absolute inset-0 flex flex-col justify-between bg-muted p-6 transition-opacity duration-[450ms] md:p-8", active ? "opacity-100" : "opacity-0")}>
      <span className="text-eyebrow text-muted-foreground">{item.label}</span>
      <span className="text-display font-medium leading-none tracking-tight text-foreground/10">{item.label}</span>
    </div>
  );
}

function MediaLayer({ item, active }: { item: Item; active: boolean }) {
  const m = item.media;
  if (m.type === "workflow") return <WorkflowLayer item={item} active={active} />;
  if (m.type === "vimeo" && vimeoId(m.url)) return <VimeoLayer item={item} active={active} />;
  if (m.type === "video" && m.url) return <VideoLayer item={item} active={active} />;
  if (m.type === "image" && m.url) return <ImageLayer item={item} active={active} />;
  return <EmptyMedia item={item} active={active} />;
}

/* ---------- section ---------- */

export function CapabilityExplorer({ content }: { content: CapExplorerContent }) {
  const { items } = content;
  const [activeKey, setActiveKey] = useState(content.default_key);
  // Media is mounted once a capability has been visited, so earlier layers can cross-fade without reloading.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([content.default_key]));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, items.findIndex((i) => i.key === activeKey));
  const active = items[idx]!;

  function select(i: number, focus = false) {
    const it = items[i];
    if (!it) return;
    setActiveKey(it.key);
    setVisited((v) => (v.has(it.key) ? v : new Set(v).add(it.key)));
    const btn = tabs.current[i];
    if (focus) btn?.focus({ preventScroll: true });
    // Keep the active mobile tab in view without moving the page.
    const s = strip.current;
    if (s && btn && s.scrollWidth > s.clientWidth) {
      const left = btn.offsetLeft - s.clientWidth / 2 + btn.offsetWidth / 2;
      s.scrollTo({ left, behavior: "smooth" });
    }
  }

  function onKey(e: KeyboardEvent) {
    const n = items.length;
    const map: Record<string, number> = { ArrowDown: idx + 1, ArrowRight: idx + 1, ArrowUp: idx - 1, ArrowLeft: idx - 1, Home: 0, End: n - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    select((map[e.key]! + n) % n, true);
  }

  const panelId = "cap-panel";

  return (
    <section aria-labelledby="cap-title" className="relative bg-background py-[var(--section-y)] text-foreground">
      <SiteContainer wide>
        <div className="mb-10 grid gap-4 md:mb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div>
            {content.eyebrow && (
              <Reveal>
                <p className="text-eyebrow mb-5 flex items-center gap-2 text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                  {content.eyebrow}
                </p>
              </Reveal>
            )}
            <Reveal delay={80}><h2 id="cap-title" className="text-h1 max-w-[16ch]">{content.title}</h2></Reveal>
          </div>
          {content.body && <Reveal delay={160}><p className="text-body-lg max-w-[30rem] text-muted-foreground lg:justify-self-end">{content.body}</p></Reveal>}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(220px,0.8fr)_2.2fr] lg:gap-14">
          {/* Selector: horizontal scroll on small screens, vertical list on desktop */}
          <div
            ref={strip}
            role="tablist"
            aria-label="Capabilities"
            aria-orientation="vertical"
            onKeyDown={onKey}
            className="no-scrollbar -mx-[var(--gutter,1.25rem)] flex snap-x gap-2 overflow-x-auto px-[var(--gutter,1.25rem)] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-border lg:px-0"
          >
            {items.map((it, i) => {
              const on = i === idx;
              return (
                <button
                  key={it.key}
                  ref={(el) => { tabs.current[i] = el; }}
                  role="tab"
                  id={`cap-tab-${it.key}`}
                  aria-selected={on}
                  aria-controls={panelId}
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(i)}
                  className={cn(
                    "group relative shrink-0 snap-start rounded-full border px-4 py-2.5 text-small font-medium transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    "lg:flex lg:items-center lg:justify-between lg:rounded-none lg:border-0 lg:border-b lg:border-border lg:px-0 lg:py-4 lg:text-left",
                    on ? "border-foreground bg-foreground text-background lg:bg-transparent lg:text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="lg:text-h3 lg:font-medium lg:tracking-tight">{it.label}</span>
                  <span aria-hidden className={cn("text-caption hidden font-mono transition-opacity lg:inline", on ? "text-accent" : "opacity-40")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className={cn("absolute bottom-[-1px] left-0 hidden h-px bg-accent transition-[width] duration-[450ms] ease-[var(--ease-out-expo)] lg:block", on ? "w-full" : "w-0")} />
                </button>
              );
            })}
          </div>

          {/* Panel */}
          <div id={panelId} role="tabpanel" aria-labelledby={`cap-tab-${active.key}`} className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] xl:gap-10">
            <div key={active.key} className="flex min-w-0 flex-col xl:order-1 xl:py-2">
              <h3 className="text-h2 overflow-hidden pb-1"><span className="cap-mask block">{active.headline}</span></h3>
              {active.description && (
                <p className="cap-in text-body mt-4 max-w-[34rem] text-muted-foreground" style={{ "--cap-delay": "60ms" } as CSSProperties}>{active.description}</p>
              )}
              {active.related.length > 0 && (
                <ul aria-label={`${active.label} services`} className="cap-in mt-6 flex flex-wrap gap-2" style={{ "--cap-delay": "120ms" } as CSSProperties}>
                  {active.related.map((r) => (
                    <li key={r} className="text-caption rounded-full border border-border bg-surface px-3 py-1.5 text-foreground/80">{r}</li>
                  ))}
                </ul>
              )}
              {active.cta_label && (
                <div className="cap-in mt-8 xl:mt-auto xl:pt-8" style={{ "--cap-delay": "180ms" } as CSSProperties}>
                  <HeroAction label={active.cta_label} url={active.cta_url} variant="primary" />
                </div>
              )}
            </div>

            <div className="relative order-first min-w-0 overflow-hidden rounded-md bg-muted xl:order-2" style={{ aspectRatio: "4/3" }}>
              {items.map((it) => (visited.has(it.key) ? <MediaLayer key={it.key} item={it} active={it.key === active.key} /> : null))}
            </div>
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}
