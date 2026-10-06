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

function SlideBody({ s, work, live, open }: { s: HeroSlide; work: WorkShowcase; live: boolean; open: (c: WorkCard) => void }) {
  const cards = groupCards(work, s.work_group);
  const m = s.media ? toWorkMedia(s.media, s.title) : cards[0]?.media ?? null;
  const asCard = (): WorkCard => (s.media ? { id: s.id, slug: "", title: s.title.replace(/\n/g, " "), client: null, year: null, services: [], category: s.badge ? { slug: "", name: s.badge } : null, media: m } : cards[0]!);
  const openMedia = m && m.type !== "image" ? () => open(asCard()) : undefined;

  if (s.layout === "video" && m)
    return (
      <div className="relative h-full min-h-[inherit]">
        <Media m={m} alt={s.title} live={live} onOpen={openMedia} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 grid justify-items-start gap-4 p-6 text-white md:p-12 [&_a]:pointer-events-auto">
          <Badge s={s} light /><Title s={s} className="max-w-[16ch] text-white" />
          {s.body && <p className="text-body max-w-[46ch] text-white/80">{s.body}</p>}
          <div><Cta s={s} light /></div>
        </div>
      </div>
    );

  if (s.layout === "intro")
    return (
      <div className="flex h-full flex-col items-center px-5 py-12 text-center md:px-12 md:py-16">
        <Badge s={s} /><Title s={s} className="mt-5 max-w-[18ch] text-[#080808]" />
        {s.body && <p className="text-body mt-4 max-w-[52ch] text-[#55504c]">{s.body}</p>}
        <div className="mt-7"><Cta s={s} /></div>
        {cards.length > 0 && (
          <div className="mt-10 grid w-full max-w-[880px] grid-cols-3 gap-2 md:gap-4">
            {cards.slice(0, 3).map((c) => (
              <button key={c.id} type="button" onClick={() => open(c)} className="group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl bg-[#EFEFEC] text-left shadow-[0_18px_40px_-24px_rgba(8,8,8,0.5)] transition-transform duration-300 hover:-translate-y-1 md:aspect-[4/3.4]">
                <WorkMediaView media={c.media} title={c.title} playing={false} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8 md:p-3.5">
                  <span className="text-caption line-clamp-1 block font-medium text-white md:text-small">{c.title}</span>
                  <span className="text-caption hidden text-white/75 md:block">View project →</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );

  if (s.layout === "web")
    return (
      <div className="flex h-full flex-col items-center px-5 pt-12 text-center md:px-12 md:pt-16">
        <Badge s={s} /><Title s={s} className="mt-5 max-w-[18ch] text-[#080808]" />
        {s.body && <p className="text-body mt-4 max-w-[52ch] text-[#55504c]">{s.body}</p>}
        <div className="mt-7"><Cta s={s} /></div>
        <div className="mt-10 w-full max-w-[900px] overflow-hidden rounded-t-2xl border border-b-0 border-black/10 bg-white shadow-[0_-10px_50px_-30px_rgba(8,8,8,0.45)]">
          <div className="flex items-center gap-1.5 border-b border-black/5 px-4 py-2.5">
            {[0, 1, 2].map((i) => <span key={i} aria-hidden className="size-2.5 rounded-full bg-black/10" />)}
            <span className="text-caption mx-auto rounded-full bg-black/[0.04] px-6 py-0.5 text-[#7a726d]">brantatech.com</span>
          </div>
          {m ? <Media m={m} alt={s.title} live={live} onOpen={openMedia} className="aspect-[16/7]" /> : (
            <div className="grid h-[180px] grid-cols-[1fr_2fr] gap-3 bg-[#FAFAF8] p-4 md:h-[260px]">
              <div className="grid content-start gap-2">{[70, 50, 60, 40].map((w) => <span key={w} className="h-2.5 rounded-full bg-black/[0.06]" style={{ width: `${w}%` }} />)}</div>
              <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <span key={i} className={cn("rounded-xl", i === 1 ? "bg-accent/20" : "bg-black/[0.05]")} />)}</div>
            </div>
          )}
        </div>
      </div>
    );

  if (s.layout === "brand")
    return (
      <div className="grid h-full items-center gap-10 px-6 py-12 md:grid-cols-[1.1fr_1fr] md:px-14">
        <div className="grid justify-items-start gap-5">
          <Badge s={s} /><Title s={s} className="text-[#080808]" />
          {s.body && <p className="text-body max-w-[42ch] text-[#55504c]">{s.body}</p>}
          <Cta s={s} />
        </div>
        <div className="relative mx-auto aspect-[1.586] w-full max-w-[420px] [perspective:1200px]">
          <div className="brand-card absolute inset-0 flex rotate-[-8deg] flex-col justify-between rounded-[22px] p-6 text-white transition-transform duration-700 hover:rotate-[-3deg] hover:scale-[1.02] md:p-8">
            <div className="flex items-center justify-between"><img src={logo} alt="" className="size-9 rounded-full bg-black/80 p-1.5" /><span className="text-caption tracking-[0.3em] text-white/80">BRANTA</span></div>
            <div><p className="font-mono text-[clamp(0.9rem,2vw,1.15rem)] tracking-[0.22em] text-white/90">CREATE · AI · BUILD</p><p className="text-caption mt-2 text-white/70">The only card that works like Branta.</p></div>
          </div>
        </div>
      </div>
    );

  // product / commercial: split
  const cine = s.layout === "commercial";
  return (
    <div className={cn("grid h-full items-center gap-8 p-6 md:grid-cols-2 md:gap-12 md:p-12", cine && "md:grid-cols-[1fr_1.35fr]")}>
      <div className="grid justify-items-start gap-5">
        <Badge s={s} /><Title s={s} className="text-[#080808]" />
        {s.body && <p className="text-body max-w-[42ch] text-[#55504c]">{s.body}</p>}
        <Cta s={s} />
      </div>
      {m ? (
        <div className="relative">
          <Media m={m} alt={s.title} live={live} onOpen={openMedia} className={cn("rounded-[24px] shadow-[0_30px_60px_-30px_rgba(8,8,8,0.55)]", cine ? "aspect-video" : "aspect-[4/3.6]")} />
          {!cine && cards[1]?.media && (
            <div className="absolute -bottom-5 -left-5 hidden w-[38%] rotate-[-6deg] overflow-hidden rounded-2xl border-4 border-white shadow-xl md:block">
              <div className="relative aspect-square"><WorkMediaView media={cards[1].media} title={cards[1].title} alt="" playing={false} /></div>
            </div>
          )}
        </div>
      ) : <div aria-hidden className="hidden aspect-[4/3] rounded-[24px] bg-gradient-to-br from-[#FFE3D1] via-[#FBE4EE] to-[#E7E3FA] md:block" />}
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
  const dark = s.layout === "video";

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
        <div className={cn("glossy-card relative min-h-[520px] overflow-hidden rounded-[28px] md:min-h-[640px] md:rounded-[40px]", dark && "bg-[#0B0B0B]")}>
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
