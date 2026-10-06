import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { SmartLink } from "@/components/layout/SiteHeader";
import { BrantaVideo } from "@/components/media/BrantaVideo";
import { WorkMediaView } from "@/components/work/PortfolioCard";
import { WorkMediaModal } from "@/components/work/WorkMediaModal";
import { cn } from "@/lib/utils";
import type { HeroSlide, SlideMedia, SliderConfig } from "@/lib/hero-slides";
import type { WorkCard } from "@/lib/work.functions";
import type { WorkShowcase } from "@/lib/work-showcase.functions";

const logo = "/favicon.png";

function groupCards(work: WorkShowcase, key: string): WorkCard[] {
  if (!work) return [];
  if (!key) return [];
  const g = (work.groups.find((x) => x.key === key)?.items ?? []).filter((c) => c.media);
  return g.length ? g : work.featured.filter((c) => c.media);
}
const toWorkMedia = (m: SlideMedia, alt: string) => ({ type: m.type, url: m.url, poster: m.poster || null, alt, orientation: "landscape" }) as WorkCard["media"];

function Cta({ s, light }: { s: HeroSlide; light?: boolean }) {
  if (!s.cta_label || !s.cta_url) return null;
  return (
    <SmartLink url={s.cta_url} className={cn("text-small inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-3 font-medium shadow-[0_10px_24px_-12px_rgba(8,8,8,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-white active:translate-y-0",
      light ? "bg-white text-[#080808]" : "bg-[#080808] text-white")}>
      {s.cta_label}<ArrowRight aria-hidden className="size-4" />
    </SmartLink>
  );
}
function Badge({ s, light }: { s: HeroSlide; light?: boolean }) {
  if (!s.badge) return null;
  return <span className={cn("text-caption inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium backdrop-blur-sm", light ? "border-white/25 bg-white/10 text-white" : "border-black/10 bg-white/70 text-[#3a3330]")}><span aria-hidden className="size-1.5 rounded-full bg-accent" />{s.badge}</span>;
}
function Title({ s, className }: { s: HeroSlide; className?: string }) {
  return <h2 className={cn("whitespace-pre-line text-[clamp(2rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.035em]", className)}>{s.title}</h2>;
}

/** Media frame: image, MP4 or Vimeo (muted background loop via BrantaVideo; click opens the shared modal). */
function Media({ m, alt, live, onOpen, className }: { m: WorkCard["media"]; alt: string; live: boolean; onOpen?: (() => void) | undefined; className?: string }) {
  if (!m) return null;
  const video = m.type !== "image";
  return (
    <div className={cn("group relative overflow-hidden bg-[#EFEFEC]", className)}>
      {video && live ? <BrantaVideo kind={m.type as "vimeo" | "video"} url={m.url} poster={m.poster} alt="" priority="high" autoplay loop cover /> : <WorkMediaView media={m} title={alt} playing={false} />}
      {video && onOpen && (
        <button type="button" onClick={onOpen} aria-label={`Play ${alt} with sound`} className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent">
          <span className="text-caption absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 font-medium text-[#080808] opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Play aria-hidden className="size-3 fill-current" />Watch</span>
        </button>
      )}
    </div>
  );
}

function Thumb({ c, className }: { c: WorkCard | undefined; className?: string }) {
  return <div className={cn("relative overflow-hidden bg-[#EFEFEC]", className)}>{c && <WorkMediaView media={c.media} title={c.title} alt="" playing={false} />}</div>;
}
const Desc = ({ s, className }: { s: HeroSlide; className?: string }) => (s.body ? <p className={cn("text-small md:text-body text-[#5d5753]", className)}>{s.body}</p> : null);

function SlideBody({ s, work, live, open }: { s: HeroSlide; work: WorkShowcase; live: boolean; open: (c: WorkCard) => void }) {
  const cards = groupCards(work, s.work_group);
  const m = s.media ? toWorkMedia(s.media, s.title) : cards[0]?.media ?? null;
  const asCard = (): WorkCard => (s.media ? { id: s.id, slug: "", title: s.title.replace(/\n/g, " "), client: null, year: null, services: [], category: s.badge ? { slug: "", name: s.badge } : null, media: m } : cards[0]!);
  const openMedia = m && m.type !== "image" ? () => open(asCard()) : undefined;

  /* 1 — centered serif + three equal destination-style cards */
  if (s.layout === "intro") {
    const tones = ["from-[#3E4FA8] to-[#7C8BD8]", "from-[#F08A5D] to-[#F7B58F]", "from-[#6E9C8A] to-[#A9C9B5]"];
    return (
      <div className="flex h-full flex-col items-center px-5 pt-12 pb-8 text-center md:px-12 md:pt-16">
        <Title s={s} className="serif-display max-w-[16ch] text-[clamp(2.1rem,4.6vw,3.8rem)] font-normal leading-[1.05] tracking-[-0.01em] text-[#141414]" />
        <Desc s={s} className="mt-4 max-w-[44ch]" />
        <div className="mt-6"><Cta s={s} /></div>
        <div className="mt-10 grid w-full max-w-[860px] grid-cols-3 gap-2.5 md:gap-5">
          {[0, 1, 2].map((k) => { const c = cards[k]; return (
            <button key={k} type="button" disabled={!c} onClick={() => c && open(c)} className={cn("group relative aspect-[4/4.6] cursor-pointer overflow-hidden rounded-xl bg-gradient-to-b text-center shadow-[0_14px_30px_-20px_rgba(8,8,8,0.5)] transition-transform duration-300 hover:-translate-y-1 md:rounded-2xl", tones[k])}>
              {c && <WorkMediaView media={c.media} title={c.title} alt="" playing={false} />}
              <span className="absolute inset-x-0 top-0 grid justify-items-center gap-1.5 bg-gradient-to-b from-black/45 to-transparent px-2 pt-3 pb-8">
                <span className="text-[0.6rem] rounded-full bg-accent px-2 py-0.5 font-medium text-white md:text-caption">{c?.category?.name ?? "Motion Ad"}</span>
                <span className="serif-display line-clamp-2 text-[0.8rem] leading-tight text-white md:text-lg">{c?.title}</span>
              </span>
              <span className="text-[0.6rem] absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 font-medium text-[#141414] md:text-caption">View Project</span>
            </button>
          ); })}
        </div>
      </div>
    );
  }

  /* 2 — centered serif over orange/lavender glow + large media window bleeding off the bottom */
  if (s.layout === "video")
    return (
      <div className="flex h-full flex-col items-center px-4 pt-12 text-center md:px-10 md:pt-16">
        <Title s={s} className="serif-display max-w-[18ch] text-[clamp(2.1rem,4.6vw,3.8rem)] font-normal leading-[1.05] tracking-[-0.01em] text-[#141414]" />
        <Desc s={s} className="mt-4 max-w-[46ch]" />
        <div className="mt-6"><Cta s={s} /></div>
        {m && <div className="mt-10 w-full max-w-[920px] flex-1 overflow-hidden rounded-t-[18px] border border-b-0 border-white/80 bg-white p-1.5 pb-0 shadow-[0_-20px_60px_-30px_rgba(8,8,8,0.35)]">
          <Media m={m} alt={s.title} live={live} onOpen={openMedia} className="aspect-video rounded-t-[13px]" />
        </div>}
      </div>
    );

  /* 3 — big bold left headline, glowing visual right with floating chips */
  if (s.layout === "product")
    return (
      <div className="grid h-full items-center gap-6 p-6 md:grid-cols-[1fr_1.1fr] md:p-14">
        <div className="grid justify-items-start gap-5">
          {s.badge && <span className="text-caption inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-2 py-1 font-medium text-[#3a3330] shadow-sm"><img src={logo} alt="" className="size-4 rounded-sm" />{s.badge}</span>}
          <Title s={s} className="text-[clamp(2.3rem,5vw,4.2rem)] font-bold leading-[1] tracking-[-0.04em] text-[#141414]" />
          <Desc s={s} className="max-w-[34ch]" />
          <div className="flex items-center gap-4"><Cta s={s} /><span className="text-caption text-[#7a726d]">Studio-grade · AI</span></div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[460px]">
          <div aria-hidden className="absolute inset-[8%] rounded-full bg-white/70 blur-3xl" />
          <Thumb c={cards[0]} className="absolute inset-[6%] rounded-[36px] [mask-image:radial-gradient(75%_75%_at_50%_50%,#000_60%,transparent_100%)]" />
          {cards[0] && <div className="absolute bottom-[14%] -left-2 hidden items-center gap-2 rounded-xl bg-white/90 p-2 pr-4 shadow-lg backdrop-blur md:flex">
            <Thumb c={cards[1] ?? cards[0]} className="size-9 rounded-lg" /><div className="text-left"><p className="text-caption font-medium text-[#141414]">{cards[0].title}</p><p className="text-[0.65rem] text-[#7a726d]">{cards[0].category?.name}</p></div>
          </div>}
        </div>
      </div>
    );

  /* 4 — white split: headline left, big rounded accent visual right with overlapping panels */
  if (s.layout === "commercial")
    return (
      <div className="grid h-full items-center gap-8 p-6 md:grid-cols-2 md:p-14">
        <div className="grid justify-items-start gap-5">
          <Title s={s} className="text-[clamp(2.1rem,4.4vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.035em] text-[#141414]" />
          <Desc s={s} className="max-w-[40ch]" />
          {s.cta_label && <SmartLink url={s.cta_url} className="text-small inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-[#E95200]">{s.cta_label}<span className="grid size-5 place-items-center rounded-full bg-white/25"><ArrowRight className="size-3" /></span></SmartLink>}
          <p className="text-caption mt-4 text-[#7a726d]">Trusted by growing brands across Bangladesh</p>
        </div>
        <div className="relative pb-6 md:pr-6">
          <div className="relative aspect-[4/3.3] overflow-hidden rounded-[22px] bg-[#1F1A17]">
            {m ? <Media m={m} alt={s.title} live={live} onOpen={openMedia} className="absolute inset-0" /> : null}
          </div>
          {cards.slice(0, 2).map((c, k) => (
            <button key={c.id} type="button" onClick={() => open(c)} className={cn("absolute hidden w-[46%] cursor-pointer items-center gap-2 rounded-xl border border-black/5 bg-white p-2 text-left shadow-[0_20px_40px_-20px_rgba(8,8,8,0.45)] transition-transform hover:-translate-y-0.5 sm:flex", k === 0 ? "-left-6 top-[42%]" : "-right-2 bottom-0")}>
              <Thumb c={c} className="size-10 shrink-0 rounded-lg" />
              <span className="min-w-0"><span className="text-caption block truncate font-medium text-[#141414]">{c.title}</span><span className="block truncate text-[0.65rem] text-accent">{c.category?.name ?? "AI Commercial"}</span></span>
            </button>
          ))}
        </div>
      </div>
    );

  /* 5 — centered product showcase with three layered device mockups and side cards */
  if (s.layout === "web") {
    const dev = (c: WorkCard | undefined, cls: string) => (
      <div className={cn("overflow-hidden rounded-[22px] border-[5px] border-[#141414] bg-[#141414] shadow-[0_30px_50px_-25px_rgba(8,8,8,0.6)]", cls)}>
        <div className="relative size-full overflow-hidden rounded-[17px] bg-white">{c ? <WorkMediaView media={c.media} title={c.title} alt="" playing={false} /> : <div className="grid h-full content-start gap-2 p-3">{[80, 55, 70, 40].map((w) => <span key={w} className="h-2 rounded-full bg-black/[0.07]" style={{ width: `${w}%` }} />)}<span className="mt-2 h-16 rounded-xl bg-accent/15" /></div>}</div>
      </div>
    );
    return (
      <div className="relative flex h-full flex-col items-center overflow-hidden px-5 pt-12 text-center md:px-12 md:pt-14">
        {s.badge && <span className="text-caption inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-1 py-1 pr-3 font-medium text-[#3a3330]"><span className="rounded-full bg-accent px-2 py-0.5 text-white">New</span>{s.badge}</span>}
        <Title s={s} className="mt-4 max-w-[20ch] text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.035em] text-[#141414]" />
        <Desc s={s} className="mt-3 max-w-[48ch]" />
        <div className="mt-6 flex gap-2"><Cta s={s} /><SmartLink url="/contact" className="text-small inline-flex items-center rounded-full border border-black/10 bg-white px-5 py-3 font-medium text-[#141414] hover:border-accent hover:text-accent">Contact</SmartLink></div>
        <div className="mt-10 flex items-end justify-center gap-3 md:gap-6">
          {dev(cards[1], "hidden h-[220px] w-[120px] translate-y-6 rotate-[-4deg] sm:block md:h-[300px] md:w-[150px]")}
          {dev(cards[0], "h-[260px] w-[140px] md:h-[350px] md:w-[175px]")}
          {dev(cards[2], "hidden h-[220px] w-[120px] translate-y-6 rotate-[4deg] sm:block md:h-[300px] md:w-[150px]")}
        </div>
        <div aria-hidden className="pointer-events-none absolute left-6 top-24 hidden w-44 rotate-[-6deg] rounded-xl border border-black/5 bg-white p-3 text-left shadow-lg lg:block"><p className="text-caption font-medium text-[#141414]">Websites</p><p className="text-[0.65rem] text-[#7a726d]">Fast, SEO-ready, built to convert</p></div>
        <div aria-hidden className="pointer-events-none absolute right-6 top-40 hidden w-44 rotate-[5deg] rounded-xl border border-black/5 bg-white p-3 text-left shadow-lg lg:block"><p className="text-caption font-medium text-[#141414]">Software & SaaS</p><p className="text-[0.65rem] text-[#7a726d]">Custom systems for your business</p></div>
      </div>
    );
  }

  /* 6 — editorial light headline left, tall glossy metal card right */
  return (
    <div className="relative grid h-full items-center gap-10 overflow-hidden p-6 md:grid-cols-[1.15fr_1fr] md:p-14">
      <span aria-hidden className="pointer-events-none absolute -bottom-6 left-4 select-none text-[clamp(5rem,14vw,11rem)] font-semibold leading-none tracking-[-0.06em] text-[#141414]/[0.04]">branta</span>
      <div className="relative grid justify-items-start gap-5">
        <Title s={s} className="text-[clamp(2.1rem,4.6vw,3.8rem)] font-normal leading-[1.05] tracking-[-0.04em] text-[#3a2b24] [&]:font-light" />
        <Desc s={s} className="max-w-[38ch]" />
        <div className="flex w-full max-w-[380px] items-center gap-2 rounded-full border border-black/10 bg-white/80 p-1 pl-4 backdrop-blur">
          <span className="text-small min-w-0 flex-1 truncate text-left text-[#9a908a]">Tell us about your project</span>
          {s.cta_label && <SmartLink url={s.cta_url} className="text-small shrink-0 cursor-pointer rounded-full bg-[#8A3B1E] px-4 py-2 font-medium text-white transition-colors hover:bg-accent">{s.cta_label}</SmartLink>}
        </div>
        <div className="mt-4 flex gap-8 text-left"><div><p className="text-h4 font-semibold text-[#3a2b24]">100+</p><p className="text-caption text-[#7a726d]">Projects delivered</p></div><div><p className="text-h4 font-semibold text-[#3a2b24]">AI-first</p><p className="text-caption text-[#7a726d]">Creative studio</p></div></div>
      </div>
      <div className="relative mx-auto h-[300px] w-[200px] md:h-[400px] md:w-[260px]">
        <div className="metal-card absolute inset-0 rotate-[8deg] rounded-[26px] p-6 transition-transform duration-700 hover:rotate-[4deg]">
          <div className="flex items-center justify-between"><img src={logo} alt="" className="size-8 rounded-full bg-[#141414] p-1" /><span className="text-[0.6rem] tracking-[0.3em] text-[#555]">BRANTA</span></div>
          <span className="absolute bottom-6 left-6 text-[0.7rem] font-medium tracking-[0.2em] text-[#444]">CREATE · AI · BUILD</span>
        </div>
        <span className="text-caption absolute -left-10 top-10 hidden items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[#3a2b24] shadow md:inline-flex"><span className="size-1.5 rounded-full bg-accent" />Creative · AI · Tech</span>
      </div>
    </div>
  );
}

export function HeroSlider({ slider, work }: { slider: SliderConfig; work: WorkShowcase }) {
  const slides = slider.slides;
  const n = slides.length;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [modal, setModal] = useState<WorkCard | null>(null);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const go = useCallback((d: number) => { setDir(d); setI((x) => (x + d + n) % n); }, [n]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!slider.autoplay || paused || !visible || modal || reduced || n < 2) return;
    const t = window.setTimeout(() => go(1), slider.interval * 1000);
    return () => window.clearTimeout(t);
  }, [i, paused, visible, modal, reduced, n, slider.autoplay, slider.interval, go]);

  if (!n) return null;
  const s = slides[i]!;

  return (
    <section ref={ref} aria-roledescription="carousel" aria-label="Branta highlights"
      className="atmo-hero relative isolate overflow-hidden px-3 pt-8 pb-[var(--section-y)] md:px-6 md:pt-12"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}>
      <div className="relative mx-auto max-w-[1240px]">
        {/* Neighbour peeks */}
        {n > 1 && <>
          <div aria-hidden className="glossy-card absolute inset-y-8 -left-[3.2%] hidden w-[3%] rounded-r-[28px] opacity-70 xl:block" />
          <div aria-hidden className="glossy-card absolute inset-y-8 -right-[3.2%] hidden w-[3%] rounded-l-[28px] opacity-70 xl:block" />
        </>}
        <div className={cn("glossy-card relative min-h-[560px] overflow-hidden rounded-[28px] md:h-[660px] md:min-h-0 md:rounded-[40px]", `slide-bg-${s.layout}`)}>
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div key={s.id + i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}
              custom={dir} className="relative h-full min-h-[inherit]"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              drag={n > 1 && !reduced ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
              onDragEnd={(_, info) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}>
              <SlideBody s={s} work={work} live={visible && !modal} open={setModal} />
            </motion.div>
          </AnimatePresence>
        </div>

        {n > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button type="button" aria-label="Previous slide" onClick={() => go(-1)} className="grid size-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white/80 text-[#080808] backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"><ArrowLeft className="size-4" /></button>
            <div className="flex items-center gap-2">
              {slides.map((x, j) => (
                <button key={x.id} type="button" aria-label={`Go to slide ${j + 1}`} aria-current={j === i}
                  onClick={() => { setDir(j > i ? 1 : -1); setI(j); }}
                  className={cn("h-2 cursor-pointer rounded-full transition-all duration-300", j === i ? "w-7 bg-accent" : "w-2 bg-black/20 hover:bg-black/40")} />
              ))}
            </div>
            <button type="button" aria-label="Next slide" onClick={() => go(1)} className="grid size-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white/80 text-[#080808] backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"><ArrowRight className="size-4" /></button>
          </div>
        )}
      </div>
      <WorkMediaModal card={modal} onClose={() => setModal(null)} />
    </section>
  );
}
