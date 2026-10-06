import { absoluteUrl, canonical, jsonLd, pageMeta } from "@/lib/seo";
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
import { workShowcaseQuery } from "@/lib/work-showcase.functions";
import { WorkShowcase } from "@/components/home/WorkShowcase";
import { ClientStories } from "@/components/home/ClientStories";
import { clientStoriesQuery } from "@/lib/client-stories.functions";
import { RecognitionSection } from "@/components/home/RecognitionSection";
import { recognitionQuery } from "@/lib/recognition.functions";
import { TrustProof } from "@/components/home/TrustProof";
import { BookCallCta, PricingSection, ServicesSnapshot } from "@/components/home/HomeEngage";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [chrome] = await Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery),
      context.queryClient.ensureQueryData(homeHeroQuery),
      context.queryClient.ensureQueryData(capabilityExplorerQuery),
      context.queryClient.ensureQueryData(homeClosingQuery),
      context.queryClient.ensureQueryData(workShowcaseQuery),
      context.queryClient.ensureQueryData(clientStoriesQuery),
      context.queryClient.ensureQueryData(recognitionQuery),
    ]);
    return { chrome };
  },
  head: ({ loaderData }) => {
    const chrome = loaderData?.chrome;
    const sameAs = chrome?.social ? Object.values(chrome.social).filter((url): url is string => typeof url === "string" && /^https:\/\//.test(url)) : [];
    const logo = chrome?.brand?.logo_url && /^https:\/\//.test(chrome.brand.logo_url) ? chrome.brand.logo_url : absoluteUrl("/favicon.png");
    const organization: Record<string, unknown> = {
      "@context": "https://schema.org", "@type": "Organization", "@id": `${absoluteUrl("/")}#organization`,
      name: chrome?.company?.company_name || "Branta Tech", url: absoluteUrl("/"), logo,
      description: chrome?.company?.short_description || "AI-first creative and technology studio.",
      ...(chrome?.contact?.email ? { email: chrome.contact.email } : {}),
      ...(chrome?.contact?.phone ? { telephone: chrome.contact.phone } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    };
    return {
      links: canonical("/"),
      meta: pageMeta({ title: "Branta Tech — Creative. AI. Technology.", description: "AI films, product visuals, campaigns, digital products and automation, built by one integrated creative technology team.", path: "/" }),
      scripts: [jsonLd([organization, { "@context": "https://schema.org", "@type": "WebSite", "@id": `${absoluteUrl("/")}#website`, name: "Branta Tech", url: absoluteUrl("/"), publisher: { "@id": `${absoluteUrl("/")}#organization` } }])],
    };
  },
  errorComponent: () => <p className="p-8">Something went wrong loading this page.</p>,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeHeroQuery);
  const { data: cap } = useSuspenseQuery(capabilityExplorerQuery);
  const { data: closing } = useSuspenseQuery(homeClosingQuery);
  const { data: work } = useSuspenseQuery(workShowcaseQuery);
  const { data: stories } = useSuspenseQuery(clientStoriesQuery);
  const { data: recognition } = useSuspenseQuery(recognitionQuery);
  const explorer = capExplorerFrom(cap.section, cap.services);
  return (
    <SiteShell>
      <HomeHero hero={heroFromSection(data)} />
      {closing.trust && <TrustProof content={closing.trust} />}
      {explorer && <CapabilityExplorer content={explorer} />}
      {work && <WorkShowcase data={work} />}
      {stories && <ClientStories data={stories} />}
      {recognition && <RecognitionSection data={recognition} />}
      {closing.services && <ServicesSnapshot content={closing.services} />}
      {closing.pricing && <PricingSection content={closing.pricing} />}
      {closing.bookCall && <BookCallCta content={closing.bookCall} />}
    </SiteShell>
  );
}
