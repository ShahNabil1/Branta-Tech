import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { ServiceMediaView } from "@/components/services/ServiceBlocks";
import { HeroAction } from "@/components/home/Hero";
import { siteChromeQuery } from "@/lib/navigation";
import { aiStudioQuery, type StudioEntry } from "@/lib/services.functions";
import { cn } from "@/lib/utils";

const TITLE = "AI Studio | Branta Tech";
const DESC = "Visual experiments, prototypes and AI-native ideas from the Branta team.";

export const Route = createFileRoute("/ai-studio")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(aiStudioQuery)]),
  errorComponent: () => <p className="p-8">Something went wrong loading AI Studio.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: AiStudioPage,
});

const FUTURE = ["AI experiments", "Visual tests", "Character studies", "Prototype videos", "Image experiments", "Creative R&D"];

/** Asymmetric rhythm: spans cycle so the grid never reads as a uniform card wall. */
const SPANS = ["md:col-span-7", "md:col-span-5 md:mt-24", "md:col-span-4", "md:col-span-8", "md:col-span-5 md:col-start-2", "md:col-span-6 md:-mt-16"];
const RATIO: Record<string, string> = { square: "aspect-square", portrait: "aspect-[4/5]", landscape: "aspect-[4/3]", wide: "aspect-[16/9]", auto: "aspect-[4/3]" };

function AiStudioPage() {
  const { data } = useSuspenseQuery(aiStudioQuery);
  return (
    <SiteShell>
      <DarkSection aria-labelledby="studio-title">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Eyebrow>{data.eyebrow}</Eyebrow>
            <h1 id="studio-title" className="text-display-xl mt-6 text-foreground">{data.title}</h1>
          </div>
          <p className="text-body-lg text-muted-foreground md:col-span-4">{data.body}</p>
        </div>
      </DarkSection>

      {data.entries.length > 0 ? (
        <Section tone="dark" aria-label="Experiments" className="pt-0">
          <ul className="grid gap-x-6 gap-y-16 md:grid-cols-12">
            {data.entries.map((e, i) => <Entry key={e.id} e={e} span={SPANS[i % SPANS.length]!} />)}
          </ul>
        </Section>
      ) : (
        <Section tone="warm" aria-labelledby="studio-empty">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="text-caption font-mono text-accent">LAB · 00</p>
              <h2 id="studio-empty" className="text-h2 mt-4 text-foreground">The first experiments are in progress.</h2>
              <p className="text-body mt-6 max-w-md text-muted-foreground">New explorations from the Branta team will appear here as they're ready to share.</p>
            </div>
            <ul aria-label="What will appear here" className="grid grid-cols-2 border-l border-t border-border md:col-span-7 md:grid-cols-3">
              {FUTURE.map((f, i) => (
                <li key={f} className={cn("flex aspect-square flex-col justify-between border-b border-r border-border p-4 sm:p-5", i % 3 === 1 && "bg-muted")}>
                  <span aria-hidden className="text-caption font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-small font-medium text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </SiteShell>
  );
}

function Entry({ e, span }: { e: StudioEntry; span: string }) {
  return (
    <li className={cn("min-w-0", span)}>
      {e.media && <ServiceMediaView media={e.media} title={e.title || "Experiment"} className={RATIO[e.ratio] ?? "aspect-[4/3]"} />}
      <div className="mt-5 max-w-lg">
        {e.kind && <p className="text-caption font-mono uppercase tracking-wider text-accent">{e.kind}</p>}
        {e.title && <h2 className="text-h3 mt-2 text-foreground">{e.title}</h2>}
        {e.body && <p className="text-small mt-3 whitespace-pre-line text-muted-foreground">{e.body}</p>}
        {e.ctaLabel && e.ctaUrl && <div className="mt-5"><HeroAction label={e.ctaLabel} url={e.ctaUrl} variant="secondary" /></div>}
      </div>
    </li>
  );
}
