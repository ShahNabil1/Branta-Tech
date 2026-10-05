import { canonical } from "@/lib/seo";
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
import { homeClosingQuery } from "@/lib/home-closing.functions";
import { TrustProof } from "@/components/home/TrustProof";

export const Route = createFileRoute("/")({
  head: () => ({ links: canonical("/"),
    meta: [
      { title: "Branta Tech — Creative. AI. Technology." },
      { name: "description", content: "AI films, product visuals, campaigns, digital products and automation, built by one integrated creative technology team." },
      { property: "og:title", content: "Branta Tech — Creative. AI. Technology." },
      { property: "og:description", content: "AI-first creative and technology studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify([
        { "@context": "https://schema.org", "@type": "Organization", name: "Branta Tech", url: "https://brantatech.com/" },
        { "@context": "https://schema.org", "@type": "WebSite", name: "Branta Tech", url: "https://brantatech.com/" },
      ]),
    }],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery),
      context.queryClient.ensureQueryData(homeHeroQuery),
      context.queryClient.ensureQueryData(capabilityExplorerQuery),
      context.queryClient.ensureQueryData(homeClosingQuery),
    ]),
  errorComponent: () => <p className="p-8">Something went wrong loading this page.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeHeroQuery);
  const { data: cap } = useSuspenseQuery(capabilityExplorerQuery);
  const { data: closing } = useSuspenseQuery(homeClosingQuery);
  const explorer = capExplorerFrom(cap.section, cap.services);
  return (
    <SiteShell>
      <HomeHero hero={heroFromSection(data)} />
      {closing.trust && <TrustProof content={closing.trust} />}
      {explorer && <CapabilityExplorer content={explorer} />}
    </SiteShell>
  );
}
