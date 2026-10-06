import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { siteChromeQuery } from "@/lib/navigation";
import { canonical, pageMeta } from "@/lib/seo";

const description = "Terms governing access to the Branta Tech website, enquiries, estimates and service discussions.";

export const Route = createFileRoute("/terms")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({
    links: canonical("/terms"),
    meta: pageMeta({ title: "Terms & Conditions | Branta Tech", description }),
  }),
  component: TermsPage,
});

const sections = [
  ["Using this website", "You may use this website for lawful purposes and genuine enquiries. You must not interfere with its operation, security or availability."],
  ["Estimates and proposals", "Website estimates are indicative and may change after we review your requirements. A project begins only after both parties agree to the final scope, price, timeline and applicable terms."],
  ["Intellectual property", "The Branta Tech name, website design and published work remain protected by applicable intellectual-property laws. Client deliverables are governed by the agreement for that project."],
  ["Third-party services", "The website may link to or rely on third-party services. Their availability, content and privacy practices are governed by their own terms."],
  ["Changes", "We may update these terms when our website or services change. The latest version will appear on this page with its update date."],
] as const;

function TermsPage() {
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="terms-title" className="py-20 md:py-28">
        <Eyebrow>LEGAL</Eyebrow>
        <h1 id="terms-title" className="text-h1 mt-6 max-w-[16ch]">Terms & Conditions</h1>
        <p className="text-body-lg mt-6 max-w-2xl text-muted-foreground">{description}</p>
        <p className="text-caption mt-8 text-muted-foreground">Last updated: 6 October 2026</p>
      </Section>
      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <p className="text-eyebrow text-muted-foreground">TERMS OF USE</p>
          <div className="grid gap-10">
            {sections.map(([title, copy]) => (
              <section key={title} className="border-b border-border pb-10 last:border-0 last:pb-0">
                <h2 className="text-h3 text-foreground">{title}</h2>
                <p className="text-body mt-4 max-w-3xl text-muted-foreground">{copy}</p>
              </section>
            ))}
            <section>
              <h2 className="text-h3 text-foreground">Contact</h2>
              <p className="text-body mt-4 text-muted-foreground">Questions about these terms can be sent to <a className="font-medium text-foreground underline decoration-accent underline-offset-4" href="mailto:hello@brantatech.com">hello@brantatech.com</a>.</p>
            </section>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}