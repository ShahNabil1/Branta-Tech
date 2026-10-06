import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SmartLink } from "@/components/layout/SiteHeader";
import { Reveal } from "@/components/motion/Reveal";
import { WorkMediaView } from "@/components/work/PortfolioCard";
import { WorkMediaModal } from "@/components/work/WorkMediaModal";
import { cn } from "@/lib/utils";
import type { WorkCard } from "@/lib/work.functions";
import type { WorkShowcase } from "@/lib/work-showcase.functions";
const logoMark = "/favicon.png";

const isVideo = (c: WorkCard) => c.media?.type === "video" || c.media?.type === "vimeo";

/** Unique published projects with media: featured first, then homepage groups. */
function pickCards(work: WorkShowcase): WorkCard[] {
  if (!work) return [];
  const seen = new Set<string>();
  const out: WorkCard[] = [];
  for (const c of [...work.featured, ...work.groups.flatMap((g) => g.items)]) {
    if (!c.media || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/* Floating edge cards (desktop only so they never cover copy). */
const FLOATS = [
  "left-[1%] top-[14%] w-[8.5rem] -rotate-6 aspect-[4/5]",
  "left-[0%] top-[46%] w-[10.5rem] rotate-[-9deg] aspect-[4/3]",
  "right-[0%] top-[8%] w-[7.5rem] rotate-[8deg] aspect-[3/4]",
  "right-[4%] top-[62%] w-[8.5rem] rotate-[-5deg] aspect-[4/5]",
];

/* Bento geometry (lg): portrait | wide | tall(span 2) ; small | small | small */
const BENTO = [
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-2 lg:row-span-1",
  "lg:col-span-1 lg:row-span-2",
  "lg:col-span-1",
  "lg:col-span-1",
  "lg:col-span-1",
];

function Tile({ card, className, onVideo, sizes }: { card: WorkCard; className?: string; onVideo: (c: WorkCard) => void; sizes?: string }) {
  const inner = (
    <>
      <WorkMediaView media={card.media} title={card.title} playing={false} />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 text-left opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">
        <span className="text-small block font-medium text-white">{card.title}</span>
        {card.category && <span className="text-caption block text-white/75">{card.category.name}</span>}
      </span>
    </>
  );
  const cls = cn("group relative block cursor-pointer overflow-hidden rounded-2xl bg-[#EFEFEC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className);
  void sizes;
  if (isVideo(card))
    return <button type="button" aria-label={`Play ${card.title}`} onClick={() => onVideo(card)} className={cls}>{inner}</button>;
  return <Link to="/work/$slug" params={{ slug: card.slug }} className={cls}>{inner}</Link>;
}

export function EditorialHero({ work, bookingUrl = "/book-a-call" }: { work: WorkShowcase; bookingUrl?: string }) {
  const cards = pickCards(work);
  const bento = cards.slice(0, 6);
  const floats = (cards.length > 6 ? cards.slice(6) : cards).slice(0, 4);
  const [active, setActive] = useState<WorkCard | null>(null);
  const n = bento.length;

  return (
    <section className="atmo-hero relative isolate overflow-hidden pb-[var(--section-y)]">
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-8">
        {/* Floating cards */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
          {floats.map((c, i) => (
            <Reveal key={c.id} delay={300 + i * 90} className={cn("absolute", FLOATS[i])}>
              <div className={cn("relative overflow-hidden rounded-2xl border border-white bg-white shadow-[0_18px_40px_-18px_rgba(8,8,8,0.35)]", FLOATS[i]?.match(/aspect-\S+/)?.[0])}>
                <WorkMediaView media={c.media} title={c.title} alt="" playing={false} />
              </div>
            </Reveal>
          ))}
        </div>

        <div className="relative mx-auto flex max-w-[820px] flex-col items-center pt-20 text-center md:pt-28">
          <Reveal>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="text-caption rounded-full border border-black/10 bg-white/70 px-3 py-1.5 font-medium text-[#3a3330] backdrop-blur-sm">Creative. AI. Technology.</span>
              <Link to="/work" className="text-caption inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 font-medium text-[#3a3330] backdrop-blur-sm transition-colors hover:border-accent hover:text-accent">
                Explore What We Create <ArrowUpRight aria-hidden className="size-3" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-7 text-[clamp(2.4rem,6.2vw,4.9rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-[#080808]">
              Your next big idea deserves <span className="script-word text-[1.12em]">extraordinary</span> creation.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-body-lg mx-auto mt-6 max-w-[580px] text-[#55504c]">
              From AI-powered commercials to stunning product visuals and custom digital experiences, we bring ambitious brand ideas to life.
            </p>
          </Reveal>
          <Reveal delay={240} className="w-full">
            <div className="mx-auto mt-10 flex w-full max-w-[540px] items-center justify-between gap-3 rounded-full border border-black/10 bg-white p-2 pl-6 shadow-[inset_0_1px_2px_rgba(8,8,8,0.06),0_10px_30px_-18px_rgba(8,8,8,0.25)]">
              <span className="text-small md:text-body min-w-0 truncate whitespace-nowrap text-left text-[#7a726d]">Have a project in mind?</span>
              <SmartLink url={bookingUrl} className="text-small inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[#080808] px-5 py-3 font-medium text-white ring-2 ring-accent/70 ring-offset-2 transition-all duration-200 hover:bg-accent hover:ring-accent active:scale-[0.98]">
                Book a Call <span aria-hidden>→</span>
              </SmartLink>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <p className="text-small mt-6 text-[#55504c]">
              Already have a project in mind?{" "}
              <Link to="/work" className="whitespace-nowrap font-medium text-[#080808] underline decoration-black/25 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
                Explore Our Work ↗
              </Link>
            </p>
          </Reveal>
        </div>

        {n > 0 && (
          <Reveal delay={200} className="relative mx-auto mt-16 max-w-[1120px] md:mt-20">
            <div className="rounded-[28px] border border-black/[0.07] bg-white p-5 shadow-[0_30px_80px_-40px_rgba(8,8,8,0.25)] md:p-9">
              <div className="flex items-center gap-4">
                <img src={logoMark} alt="" width={56} height={56} className="size-12 shrink-0 rounded-full bg-[#080808] object-contain p-2 md:size-14" />
                <div className="min-w-0 text-left">
                  <h2 className="text-[1.25rem] font-semibold tracking-tight text-[#080808]">Made by Branta.</h2>
                  <p className="text-small text-[#6b6460]">Creative work that turns ambitious ideas into reality.</p>
                </div>
              </div>
              <div className={cn("mt-8 grid auto-rows-[160px] grid-cols-2 gap-3 md:auto-rows-[200px] md:gap-4", n >= 4 ? "lg:grid-cols-4" : n === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
                {bento.map((c, i) => (
                  <Reveal key={c.id} delay={260 + i * 70} className={cn(n === 6 ? BENTO[i] : "", n === 6 && i === 1 && "col-span-2")}>
                    <Tile card={c} onVideo={setActive} className="size-full" />
                  </Reveal>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link to="/work" className="text-small inline-flex items-center gap-1 font-medium text-[#080808] transition-colors hover:text-accent">
                  View all work <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        )}
      </div>
      <WorkMediaModal card={active} onClose={() => setActive(null)} />
    </section>
  );
}
