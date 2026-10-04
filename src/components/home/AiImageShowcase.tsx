import { useState } from "react";
import { Eyebrow, Section, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import type { AiImage } from "@/lib/ai-image.functions";
import type { BeforeAfter, ImageItem } from "@/lib/ai-image";
import { cn } from "@/lib/utils";

/** Grid placement per size: large dominant, medium pair, tall portrait, wide campaign. Mobile: large full, mediums paired, others full. */
const PLACE: Record<ImageItem["size_variant"], string> = {
  large: "col-span-2 md:col-span-7 md:row-span-2 aspect-[4/5] md:aspect-auto md:min-h-[640px]",
  medium: "col-span-1 md:col-span-5 aspect-[4/5] md:aspect-[4/3]",
  portrait: "col-span-2 md:col-span-4 aspect-[4/5] md:aspect-[3/4]",
  wide: "col-span-2 md:col-span-8 aspect-[16/9]",
};

function Tile({ item, eager }: { item: ImageItem; eager: boolean }) {
  return (
    <figure className={cn("group relative overflow-hidden rounded-[4px] bg-muted", PLACE[item.size_variant])}>
      <img src={item.url} alt={item.alt} loading={eager ? "eager" : "lazy"} decoding="async" sizes="(min-width: 768px) 50vw, 100vw"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      {item.label && (
        <figcaption className="text-caption absolute bottom-3 left-3 rounded-[3px] bg-background/85 px-2 py-1 font-medium text-foreground backdrop-blur-sm">
          {item.label}
        </figcaption>
      )}
    </figure>
  );
}

function Compare({ pair }: { pair: NonNullable<BeforeAfter> }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative col-span-2 aspect-[16/9] overflow-hidden rounded-[4px] bg-muted md:col-span-12">
      <img src={pair.after_url} alt={`${pair.alt} — Branta output`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={pair.before_url} alt={`${pair.alt} — original`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-background" style={{ left: `${pos}%` }} />
      <span className="text-caption absolute left-3 top-3 rounded-[3px] bg-background/85 px-2 py-1">Original</span>
      <span className="text-caption absolute right-3 top-3 rounded-[3px] bg-background/85 px-2 py-1">Branta Output</span>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Compare original and Branta output"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}

export function AiImageShowcase({ content }: { content: NonNullable<AiImage> }) {
  if (!content.items.length && !content.pair) return null;
  const lines = content.title.split("\n");
  return (
    <Section aria-labelledby="ai-image-title">
      <SiteContainer>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h2 id="ai-image-title" className="text-display mt-4 text-foreground">
              {lines.map((l, i) => <span key={i} className="block">{l}</span>)}
            </h2>
          </div>
          <div className="md:col-span-5 md:pb-2">
            {content.body && <p className="text-body-lg max-w-md text-muted-foreground">{content.body}</p>}
            <div className="mt-6"><HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="secondary" /></div>
          </div>
        </div>
        <div className="mt-12 grid grid-flow-dense grid-cols-2 gap-3 md:mt-16 md:grid-cols-12 md:gap-5">
          {content.items.map((m, i) => <Tile key={`${m.url}-${i}`} item={m} eager={false} />)}
          {content.pair && <Compare pair={content.pair} />}
        </div>
      </SiteContainer>
    </Section>
  );
}
