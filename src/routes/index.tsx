import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { HomeHero } from "@/components/home/Hero";
import { CapabilityExplorer } from "@/components/home/CapabilityExplorer";
import { siteChromeQuery } from "@/lib/navigation";
import { homeHeroQuery } from "@/lib/home-hero.functions";
import { capabilityExplorerQuery } from "@/lib/capability-explorer.functions";
import { heroFromSection } from "@/lib/hero";
import { capExplorerFrom } from "@/lib/capabilities";
import { featuredWorkQuery } from "@/lib/featured-work.functions";
import { FeaturedWork } from "@/components/home/FeaturedWork";
import { aiFilmQuery } from "@/lib/ai-film.functions";
import { AiFilmShowcase } from "@/components/home/AiFilmShowcase";
import { aiImageQuery } from "@/lib/ai-image.functions";
import { AiImageShowcase } from "@/components/home/AiImageShowcase";
import { webSoftwareQuery } from "@/lib/web-software.functions";
import { WebSoftwareShowcase } from "@/components/home/WebSoftwareShowcase";
import { automationQuery } from "@/lib/automation.functions";
import { AutomationShowcase } from "@/components/home/AutomationShowcase";
import { homeClosingQuery } from "@/lib/home-closing.functions";
import { ProcessSection, ClientLogos, InsightsTeaser, CareersTeaser, FinalCta } from "@/components/home/HomeClosing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Branta Tech — Creative. AI. Technology." },
      { name: "description", content: "AI films, product visuals, campaigns, digital products and automation, built by one integrated creative technology team." },
      { property: "og:title", content: "Branta Tech — Creative. AI. Technology." },
      { property: "og:description", content: "AI-first creative and technology studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery),
      context.queryClient.ensureQueryData(homeHeroQuery),
      context.queryClient.ensureQueryData(capabilityExplorerQuery),
      context.queryClient.ensureQueryData(featuredWorkQuery),
      context.queryClient.ensureQueryData(aiFilmQuery),
      context.queryClient.ensureQueryData(aiImageQuery),
      context.queryClient.ensureQueryData(webSoftwareQuery),
      context.queryClient.ensureQueryData(automationQuery),
      context.queryClient.ensureQueryData(homeClosingQuery),
    ]),
  errorComponent: () => <p className="p-8">Something went wrong loading this page.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeHeroQuery);
  const { data: cap } = useSuspenseQuery(capabilityExplorerQuery);
  const { data: work } = useSuspenseQuery(featuredWorkQuery);
  const { data: film } = useSuspenseQuery(aiFilmQuery);
  const { data: image } = useSuspenseQuery(aiImageQuery);
  const { data: web } = useSuspenseQuery(webSoftwareQuery);
  const { data: auto } = useSuspenseQuery(automationQuery);
  const { data: closing } = useSuspenseQuery(homeClosingQuery);
  const explorer = capExplorerFrom(cap.section, cap.services);
  return (
    <SiteShell>
      <HomeHero hero={heroFromSection(data)} />
      {explorer && <CapabilityExplorer content={explorer} />}
      {work && <FeaturedWork content={work} />}
      {film && <AiFilmShowcase content={film} />}
      {image && <AiImageShowcase content={image} />}
      {web && <WebSoftwareShowcase content={web} />}
      {auto && <AutomationShowcase content={auto} />}
      {closing.process && <ProcessSection content={closing.process} />}
      {closing.clients && <ClientLogos content={closing.clients} />}
      {closing.insights && <InsightsTeaser content={closing.insights} />}
      {closing.careers && <CareersTeaser content={closing.careers} />}
      {closing.finalCta && <FinalCta content={closing.finalCta} />}
    </SiteShell>
  );
}
