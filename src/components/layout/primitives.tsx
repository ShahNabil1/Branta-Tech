import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------- Container ---------- */
export function SiteContainer({
  className,
  wide,
  ...props
}: ComponentPropsWithoutRef<"div"> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-[var(--gutter)]",
        wide ? "max-w-[var(--page-max)]" : "max-w-[calc(var(--content-max)+2*var(--gutter))]",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Section ---------- */
type Tone = "warm" | "white" | "muted" | "dark";
const toneClass: Record<Tone, string> = {
  warm: "bg-background text-foreground",
  white: "bg-surface text-foreground",
  muted: "bg-muted text-foreground",
  dark: "dark bg-background text-foreground",
};

export function Section({
  tone = "warm",
  bleed,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section"> & { tone?: Tone; bleed?: boolean }) {
  return (
    <section className={cn("py-[var(--section-y)]", toneClass[tone], className)} {...props}>
      {bleed ? children : <SiteContainer>{children}</SiteContainer>}
    </section>
  );
}

export function DarkSection(props: Omit<ComponentPropsWithoutRef<typeof Section>, "tone">) {
  return <Section tone="dark" {...props} />;
}

/* ---------- Type ---------- */
export function Eyebrow({ className, children, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p className={cn("text-eyebrow flex items-center gap-2 text-muted-foreground", className)} {...props}>
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      {children}
    </p>
  );
}

type HeadingSize = "display-xl" | "display" | "h1" | "h2" | "h3";
const headingClass: Record<HeadingSize, string> = {
  "display-xl": "text-display-xl",
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
};

export function DisplayHeading({
  as: Tag = "h2",
  size = "display",
  className,
  children,
}: {
  as?: ElementType;
  size?: HeadingSize;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn(headingClass[size], className)}>{children}</Tag>;
}

export function SectionHeader({
  eyebrow,
  title,
  intro,
  aside,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-12 grid gap-6 md:mb-20 lg:grid-cols-12 lg:items-end", className)}>
      <div className="lg:col-span-8">
        {eyebrow && <Eyebrow className="mb-6">{eyebrow}</Eyebrow>}
        <DisplayHeading size="h1">{title}</DisplayHeading>
      </div>
      {(intro || aside) && (
        <div className="text-body-lg text-muted-foreground lg:col-span-4">{intro ?? aside}</div>
      )}
    </header>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="pt-32 pb-[var(--section-y)] md:pt-44">
      <SiteContainer>
        {eyebrow && <Eyebrow className="mb-8">{eyebrow}</Eyebrow>}
        <DisplayHeading as="h1" size="display-xl" className="max-w-[14ch]">
          {title}
        </DisplayHeading>
        {intro && <p className="text-body-lg mt-8 max-w-xl text-muted-foreground">{intro}</p>}
        {children && <div className="mt-10">{children}</div>}
      </SiteContainer>
    </section>
  );
}

/* ---------- Media ---------- */
export function MediaFrame({
  ratio = "16/9",
  caption,
  className,
  children,
}: {
  ratio?: string;
  caption?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn("media-zoom", className)}>
      <div
        className="relative overflow-hidden rounded-md bg-muted [&>img]:size-full [&>img]:object-cover [&>video]:size-full [&>video]:object-cover"
        style={{ aspectRatio: ratio }}
      >
        {children}
      </div>
      {caption && <figcaption className="text-caption mt-3 text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/* ---------- Divider ---------- */
export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

/* ---------- Marquee ---------- */
export function Marquee({
  items,
  duration = 40,
  className,
}: {
  items: ReactNode[];
  duration?: number;
  className?: string;
}) {
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center gap-12 pr-12">
      {items.map((item, i) => (
        <li key={i} className="flex shrink-0 items-center gap-12">
          {item}
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className="animate-marquee flex w-max hover:[animation-play-state:paused]"
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        {row()}
        {row(true)}
      </div>
    </div>
  );
}
