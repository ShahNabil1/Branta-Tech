import { canonical } from "@/lib/seo";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { VideoPlayer } from "@/components/work/VideoPlayer";
import { CaseSections, CreditsList, FactsList, MediaFigure, projectFacts } from "@/components/work/CaseSections";
import { WorkMediaView, PortfolioCard, PORTFOLIO_GRID } from "@/components/work/PortfolioCard";
import { useState } from "react";
import { siteChromeQuery } from "@/lib/navigation";
import { caseStudyQuery, type CaseStudy } from "@/lib/work.functions";
import { buttonVariants } from "@/components/ui/brand-button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ context, params }) => {
    const [, cs] = await Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery),
      context.queryClient.ensureQueryData(caseStudyQuery(params.slug)),
    ]);
    if (!cs) throw notFound();
    return { seo: seoOf(cs) };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Project not found — Branta Tech" }, { name: "robots", content: "noindex" }] };
    const s = loaderData.seo;
    return {
      links: canonical(`/work/${params.slug}`, s.canonical),
      meta: [
        { title: s.title },
        ...(s.description ? [{ name: "description", content: s.description }, { property: "og:description", content: s.description }] : []),
        { property: "og:title", content: s.title },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(s.image ? [{ property: "og:image", content: s.image }, { name: "twitter:image", content: s.image }] : []),
        ...(s.noindex ? [{ name: "robots", content: "noindex" }] : []),
      ],
    };
  },
  errorComponent: () => <p className="p-8">Something went wrong loading this project.</p>,
  notFoundComponent: NotFoundProject,
  component: CaseStudyPage,
});

function seoOf(cs: NonNullable<CaseStudy>) {
  const p = cs.project;
  const img = p.seo.ogImage ?? (p.media?.type === "image" ? p.media.url : p.media?.poster) ?? null;
  return {
    title: p.seo.title || `${p.title} | Branta Tech`,
    description: p.seo.description || p.intro || null,
    canonical: p.seo.canonical,
    image: img && /^https:\/\//.test(img) ? img : null,
    noindex: p.seo.noindex,
  };
}

function NotFoundProject() {
  return (
    <SiteShell>
      <DarkSection>
        <Eyebrow>WORK</Eyebrow>
        <h1 className="text-display mt-4 text-foreground">This project isn't available.</h1>
        <Link to="/work" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-8")}>All work →</Link>
      </DarkSection>
    </SiteShell>
  );
}

function Hero({ cs }: { cs: NonNullable<CaseStudy> }) {
  const p = cs.project;
  const m = p.media;
  const tags = [p.category?.name, ...p.services.map((s) => s.name)].filter(Boolean).slice(0, 4);
  return (
    <DarkSection aria-labelledby="case-title" className="pb-0">
      <Link to="/work" className="text-caption text-muted-foreground hover:text-foreground">← All work</Link>
      <div className="mt-10 grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          {p.client && <Eyebrow>{p.client}</Eyebrow>}
          <h1 id="case-title" className="text-display-xl mt-4 text-foreground">{p.title}</h1>
        </div>
        <div className="md:col-span-4">
          {p.intro && <p className="text-body-lg text-muted-foreground">{p.intro}</p>}
          {tags.length > 0 && <p className="text-caption mt-4 uppercase tracking-wider text-muted-foreground">{tags.join(" · ")}</p>}
        </div>
      </div>
      {m && (
        <div className="mt-12 md:mt-16">
          {m.type === "image" ? (
            <img src={m.url} alt={m.alt} fetchPriority="high" decoding="async" className="aspect-[16/9] w-full rounded-[6px] bg-muted/10 object-cover" />
          ) : (
            <VideoPlayer type={m.type} url={m.url} poster={m.poster} title={p.title} mode="controls" className="aspect-video rounded-[6px]" />
          )}
        </div>
      )}
      <div className="h-[var(--section-y)]" />
    </DarkSection>
  );
}

/** Used only when no builder sections exist yet: the older single-template text fields + project media. */
function LegacyBody({ cs }: { cs: NonNullable<CaseStudy> }) {
  const p = cs.project;
  const blocks = [["OVERVIEW", p.overview], ["THE CHALLENGE", p.challenge], ["APPROACH", p.approach], ["EXECUTION", p.execution], ["RESULT", p.result]]
    .filter((b): b is [string, string] => !!b[1]);
  const gallery = cs.gallery.filter((g) => g.url !== p.media?.url);
  if (!blocks.length && !gallery.length) return null;
  return (
    <Section>
      <div className="grid gap-16">
        {blocks.map(([label, text]) => (
          <div key={label} className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-4"><Eyebrow>{label}</Eyebrow></div>
            <p className="text-body-lg whitespace-pre-line text-muted-foreground md:col-span-8">{text}</p>
          </div>
        ))}
        {gallery.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {gallery.map((g, i) => (
              <MediaFigure key={i} m={{ type: g.type, url: g.url, poster: g.poster ?? "", alt: g.alt, caption: "" }} title={p.title} className={i % 3 === 0 ? "md:col-span-2" : ""} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function CaseStudyPage() {
  const [relPlaying, setRelPlaying] = useState<string | null>(null);
  const { slug } = Route.useParams();
  const { data: cs } = useSuspenseQuery(caseStudyQuery(slug));
  if (!cs) return <NotFoundProject />;
  const facts = projectFacts(cs);
  const hasFacts = cs.sections.some((s) => s.type === "key_facts");
  const hasCredits = cs.sections.some((s) => s.type === "credits");

  return (
    <SiteShell>
      <Hero cs={cs} />
      {!hasFacts && facts.length > 0 && <Section className="py-12 md:py-16" aria-label="Project details"><FactsList facts={facts} /></Section>}
      {cs.sections.length ? <CaseSections cs={cs} /> : <LegacyBody cs={cs} />}
      {!hasCredits && cs.credits.length > 0 && (
        <Section aria-labelledby="credits-title">
          <Eyebrow id="credits-title">CREDITS</Eyebrow>
          <div className="mt-6"><CreditsList credits={cs.credits} /></div>
        </Section>
      )}

      <DarkSection aria-label="More work">
        {cs.next && (
          <Link to="/work/$slug" params={{ slug: cs.next.slug }} className="group block border-b border-border pb-10 focus-visible:outline-2 focus-visible:outline-accent">
            <Eyebrow>NEXT PROJECT</Eyebrow>
            <p className="text-h2 mt-3 text-foreground transition-colors group-hover:text-accent">{cs.next.title} <span aria-hidden>→</span></p>
          </Link>
        )}
        {cs.related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-h3 text-foreground">Related work</h2>
            <ul className={cn("mt-8", PORTFOLIO_GRID)}>
              {cs.related.map((r) => (
                <li key={r.id} className="min-w-0">
                  <PortfolioCard slug={r.slug} title={r.title} label={r.category?.name ?? r.services[0]?.name} client={r.client} media={r.media}
                    playing={relPlaying === r.id} onPreview={(on) => setRelPlaying(on ? r.id : null)} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link to="/work" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-12")}>All work →</Link>
      </DarkSection>
    </SiteShell>
  );
}
