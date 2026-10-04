import { createFileRoute } from "@tanstack/react-router";
import {
  Divider,
  DisplayHeading,
  Eyebrow,
  Marquee,
  MediaFrame,
  PageHero,
  Section,
  SectionHeader,
} from "@/components/layout/primitives";
import { MaskReveal, Reveal } from "@/components/motion/Reveal";
import { Button, TextLink } from "@/components/ui/brand-button";
import { SiteShell } from "@/components/layout/SiteShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Branta Tech — Creative. AI. Technology." },
      { name: "description", content: "Branta Tech is an AI-first creative and technology studio: AI film, design, software and automation." },
      { property: "og:title", content: "Branta Tech — Creative. AI. Technology." },
      { property: "og:description", content: "AI-first creative and technology studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const services = ["AI Film", "AI TVC", "AI Product Photography", "Motion Graphics", "VFX", "Branding", "UI/UX", "SaaS", "AI Agents", "AI Automation"];

const swatches = [
  { name: "Warm white", token: "bg-background", hex: "#F7F7F5" },
  { name: "Surface", token: "bg-surface", hex: "#FFFFFF" },
  { name: "Muted", token: "bg-muted", hex: "#EFEFEC" },
  { name: "Ink", token: "bg-ink", hex: "#080808" },
  { name: "Accent", token: "bg-accent", hex: "#FF5D00" },
];

const typeScale = [
  ["Display XL", "text-display-xl"],
  ["Display", "text-display"],
  ["H1", "text-h1"],
  ["H2", "text-h2"],
  ["H3", "text-h3"],
  ["H4", "text-h4"],
  ["Body Large", "text-body-lg"],
  ["Body", "text-body"],
  ["Small", "text-small"],
] as const;

function Index() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Design system · Phase 01"
        title={
          <>
            <MaskReveal>Creative.</MaskReveal> <MaskReveal delay={120}>AI.</MaskReveal>{" "}
            <MaskReveal delay={240}>Technology.</MaskReveal>
          </>
        }
        intro="Branta Tech is an AI-first creative and technology studio. This screen previews the foundation the full site will be built on."
      >
        <div className="flex flex-wrap gap-3">
          <Button arrow>Primary</Button>
          <Button variant="accent" arrow>Accent CTA</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </PageHero>

      <div className="border-y border-border py-6">
        <Marquee items={services.map((s) => <span key={s} className="text-h3">{s}</span>)} />
      </div>

      <Section tone="white">
        <SectionHeader eyebrow="Colour" title="A restrained palette, one sharp accent." intro="Orange is reserved for calls to action, indicators and emphasis." />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {swatches.map((s, i) => (
            <Reveal key={s.name} delay={i * 60}>
              <div className={`${s.token} aspect-[4/5] rounded-md border border-border`} />
              <p className="text-small mt-3 font-medium">{s.name}</p>
              <p className="text-caption text-muted-foreground">{s.hex}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="warm">
        <SectionHeader eyebrow="Typography" title="Geist, set editorially." />
        <div>
          {typeScale.map(([label, cls]) => (
            <div key={label}>
              <Divider />
              <div className="grid gap-2 py-6 md:grid-cols-12 md:items-baseline">
                <p className="text-eyebrow text-muted-foreground md:col-span-2">{label}</p>
                <p className={`${cls} truncate md:col-span-10`}>Cinematic work</p>
              </div>
            </div>
          ))}
          <Divider />
        </div>
      </Section>

      <Section tone="dark">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Eyebrow className="mb-6">Dark cinematic section</Eyebrow>
            <DisplayHeading size="display">Media leads. Words follow.</DisplayHeading>
            <p className="text-body-lg mt-8 max-w-lg text-muted-foreground">
              Real work, real footage and real product visuals will fill these frames in the next phase.
            </p>
            <TextLink href="#main" className="mt-8">Text link style</TextLink>
          </div>
          <div className="lg:col-span-5">
            <MediaFrame ratio="4/5" caption="MediaFrame · 4:5 · awaiting real footage">
              <div className="grid size-full place-items-center text-eyebrow text-muted-foreground">Media slot</div>
            </MediaFrame>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
