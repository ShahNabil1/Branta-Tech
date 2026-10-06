import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eyebrow, Section } from "@/components/layout/primitives";
import { siteChromeQuery } from "@/lib/navigation";
import { canonical, pageMeta } from "@/lib/seo";

const description = "How Branta Tech collects, uses and protects information shared through our website and services.";

export const Route = createFileRoute("/privacy")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({
    links: canonical("/privacy"),
    meta: pageMeta({ title: "Privacy Policy | Branta Tech", description, path: "/privacy" }),
  }),
  component: PrivacyPage,
});

const sections = [
  ["Information we collect", "We may collect information you submit through contact, booking, quotation, account, career application and chat forms. We may also receive basic technical information needed to operate and secure the website."],
  ["How we use information", "We use information to respond to enquiries, provide requested services, manage accounts and applications, improve our services, prevent misuse and meet legal obligations."],
  ["Sharing and storage", "We share information only with service providers and team members who need it to operate our services, or when required by law. We take reasonable measures to protect stored information."],
  ["Your choices", "You may ask to access, correct or delete personal information we hold about you, subject to applicable legal and operational requirements."],
] as const;

function PrivacyPage() {
  return (
    <SiteShell>
      <Section tone="dark" aria-labelledby="privacy-title" className="py-20 md:py-28">
        <Eyebrow>LEGAL</Eyebrow>
        <h1 id="privacy-title" className="text-h1 mt-6 max-w-[14ch]">Privacy Policy</h1>
        <p className="text-body-lg mt-6 max-w-2xl text-muted-foreground">{description}</p>
        <p className="text-caption mt-8 text-muted-foreground">Last updated: 6 October 2026</p>
      </Section>
      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <p className="text-eyebrow text-muted-foreground">YOUR INFORMATION</p>
          <div className="grid gap-10">
            {sections.map(([title, copy]) => (
              <section key={title} className="border-b border-border pb-10 last:border-0 last:pb-0">
                <h2 className="text-h3 text-foreground">{title}</h2>
                <p className="text-body mt-4 max-w-3xl text-muted-foreground">{copy}</p>
              </section>
            ))}
            <section>
              <h2 className="text-h3 text-foreground">Contact</h2>
              <p className="text-body mt-4 text-muted-foreground">Questions about this policy can be sent to <a className="font-medium text-foreground underline decoration-accent underline-offset-4" href="mailto:hello@brantatech.com">hello@brantatech.com</a>.</p>
            </section>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}