import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { DarkSection, Eyebrow, Section } from "@/components/layout/primitives";
import { NumberedList, RelatedWork, ServiceMediaView } from "@/components/services/ServiceBlocks";
import { HeroAction } from "@/components/home/Hero";
import { siteChromeQuery } from "@/lib/navigation";
import { servicePageQuery, type ServicePage } from "@/lib/services.functions";
import { buttonVariants } from "@/components/ui/brand-button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ context, params }) => {
    if (!/^[a-z0-9-]{1,120}$/.test(params.slug)) throw notFound();
    const [, page] = await Promise.all([
      context.queryClient.ensureQueryData(siteChromeQuery),
      context.queryClient.ensureQueryData(servicePageQuery(params.slug)),
    ]);
    if (!page) throw notFound();
    return { seo: seoOf(page) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Service not found | Branta Tech" }, { name: "robots", content: "noindex" }] };
    const s = loaderData.seo;
    return {
      meta: [
        { title: s.title },
        ...(s.description ? [{ name: "description", content: s.description }, { property: "og:description", content: s.description }] : []),
        { property: "og:title", content: s.title },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(s.image ? [{ property: "og:image", content: s.image }, { name: "twitter:image", content: s.image }] : []),
        ...(s.noindex ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: s.canonical ? [{ rel: "canonical", href: s.canonical }] : [],
    };
  },
  errorComponent: () => <p className="p-8">Something went wrong loading this service.</p>,
  notFoundComponent: NotFoundService,
  component: ServiceRoute,
});

function seoOf(p: NonNullable<ServicePage>) {
  const https = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : null);
  if (p.kind === "group") {
    const m = p.group.media;
    return { title: `${p.group.name} | Branta Tech`, description: p.group.short || p.group.description || null, canonical: null, image: https(m?.type === "image" ? m.url : m?.poster), noindex: false };
  }
  const s = p.service;
  const m = s.media;
  return {
    title: p.seo.title || `${s.name} | Branta Tech`,
    description: p.seo.description || s.short || null,
    canonical: p.seo.canonical,
    image: https(p.seo.ogImage) ?? https(m?.type === "image" ? m.url : m?.poster),
    noindex: p.seo.noindex,
  };
}

function NotFoundService() {
  return (
    <SiteShell>
      <DarkSection>
        <Eyebrow>SERVICES</Eyebrow>
        <h1 className="text-display mt-4 text-foreground">This service isn't available.</h1>
        <Link to="/services" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-8")}>All services →</Link>
      </DarkSection>
    </SiteShell>
  );
}

function ServiceRoute() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(servicePageQuery(slug));
  if (!data) return <NotFoundService />;
  return data.kind === "group" ? <GroupPage p={data} /> : <ServiceDetail p={data} />;
}

function Breadcrumb({ group }: { group?: { slug: string; name: string } | null }) {
  return (
    <nav aria-label="Breadcrumb" className="text-caption text-muted-foreground">
      <Link to="/services" className="hover:text-foreground">Services</Link>
      {group && (<><span aria-hidden className="mx-2">/</span><Link to="/services/$slug" params={{ slug: group.slug }} className="hover:text-foreground">{group.name}</Link></>)}
    </nav>
  );
}

function ServiceDetail({ p }: { p: Extract<NonNullable<ServicePage>, { kind: "service" }> }) {
  const s = p.service;
  const c = s.config;
  const eyebrow = c.eyebrow || p.group?.name?.toUpperCase() || "SERVICE";
  const ctaLabel = c.cta.label || "Start a Project";
  const ctaUrl = c.cta.url || "/start-a-project";
  return (
    <SiteShell>
      <DarkSection aria-labelledby="svc-title" className={s.media ? "pb-0" : undefined}>
        <Breadcrumb group={p.group} />
        <div className="mt-10 grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 id="svc-title" className="text-display-xl mt-4 text-foreground">{s.name}</h1>
          </div>
          {s.short && <p className="text-body-lg text-muted-foreground md:col-span-4">{s.short}</p>}
        </div>
        {s.media && (
          <div className="mt-12 md:mt-16">
            <ServiceMediaView media={s.media} title={s.name} priority className="aspect-video" />
          </div>
        )}
      </DarkSection>

      {(s.description || c.supporting) && (
        <Section aria-labelledby="svc-about">
          <div className="grid gap-8 md:grid-cols-12">
            <h2 id="svc-about" className="text-h2 text-foreground md:col-span-5">{c.intro_heading || `What ${s.name} is`}</h2>
            <div className="md:col-span-7">
              {s.description && <p className="text-body-lg whitespace-pre-line text-foreground">{s.description}</p>}
              {c.supporting && <p className="text-body mt-6 whitespace-pre-line text-muted-foreground">{c.supporting}</p>}
            </div>
          </div>
        </Section>
      )}

      {c.deliverables.length > 0 && (
        <Section tone="white" aria-labelledby="svc-create">
          <h2 id="svc-create" className="text-h2 mb-10 text-foreground">{c.deliverables_heading || "What we create"}</h2>
          <NumberedList items={c.deliverables} />
        </Section>
      )}

      {p.work.length > 0 && <Section aria-label="Selected work"><RelatedWork items={p.work} /></Section>}

      {c.process.length > 0 && (
        <DarkSection aria-labelledby="svc-process">
          <h2 id="svc-process" className="text-h2 mb-10 text-foreground">{c.process_heading || "How it works"}</h2>
          <NumberedList items={c.process} ordered />
        </DarkSection>
      )}

      {p.related.length > 0 && (
        <Section tone="muted" aria-labelledby="svc-related">
          <h2 id="svc-related" className="text-h3 text-foreground">Related capabilities</h2>
          <ul className="mt-8 flex flex-wrap gap-3">
            {p.related.map((r) => (
              <li key={r.slug}>
                <Link to="/services/$slug" params={{ slug: r.slug }} className={buttonVariants({ variant: "secondary", size: "md" })}>{r.name}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <DarkSection aria-labelledby="svc-cta">
        <div className="max-w-3xl">
          <span aria-hidden className="block h-px w-12 bg-accent" />
          <h2 id="svc-cta" className="text-display mt-8 text-foreground">{c.cta.heading || "Have an Idea? Bring It."}</h2>
          {c.cta.body && <p className="text-body-lg mt-6 text-muted-foreground">{c.cta.body}</p>}
          <div className="mt-10"><HeroAction label={ctaLabel} url={ctaUrl} variant="primary" /></div>
        </div>
      </DarkSection>
    </SiteShell>
  );
}

function GroupPage({ p }: { p: Extract<NonNullable<ServicePage>, { kind: "group" }> }) {
  const g = p.group;
  return (
    <SiteShell>
      <DarkSection aria-labelledby="grp-title" className={g.media ? "pb-0" : undefined}>
        <Breadcrumb />
        <div className="mt-10 grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Eyebrow>SERVICES</Eyebrow>
            <h1 id="grp-title" className="text-display-xl mt-4 text-foreground">{g.name}</h1>
          </div>
          {g.short && <p className="text-body-lg text-muted-foreground md:col-span-4">{g.short}</p>}
        </div>
        {g.media && <div className="mt-12 md:mt-16"><ServiceMediaView media={g.media} title={g.name} priority className="aspect-video" /></div>}
      </DarkSection>

      {g.description && g.description !== g.short && (
        <Section><p className="text-body-lg max-w-3xl whitespace-pre-line text-foreground">{g.description}</p></Section>
      )}

      {g.services.length > 0 ? (
        <Section tone="white" aria-labelledby="grp-services">
          <h2 id="grp-services" className="text-h2 mb-10 text-foreground">What we do</h2>
          <ul className="grid border-t border-border md:grid-cols-2">
            {g.services.map((s, i) => (
              <li key={s.slug} className="border-b border-border md:odd:pr-8 md:even:border-l md:even:pl-8">
                <Link to="/services/$slug" params={{ slug: s.slug }} className="group flex gap-5 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <span aria-hidden className="text-caption mt-1 w-6 shrink-0 font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-h4 block font-medium text-foreground">{s.name}</span>
                    {s.short && <span className="text-small mt-2 block text-muted-foreground">{s.short}</span>}
                  </span>
                  <span aria-hidden className="text-accent opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Section tone="white"><p className="text-body text-muted-foreground">Individual {g.name} services will be listed here soon.</p></Section>
      )}

      {p.work.length > 0 && <Section aria-label="Selected work"><RelatedWork items={p.work} /></Section>}

      <DarkSection aria-labelledby="grp-cta">
        <span aria-hidden className="block h-px w-12 bg-accent" />
        <h2 id="grp-cta" className="text-display mt-8 max-w-3xl text-foreground">Have an Idea? Bring It.</h2>
        <div className="mt-10 flex flex-wrap gap-3">
          <HeroAction label="Start a Project" url="/start-a-project" variant="primary" />
          <Link to="/services" className={buttonVariants({ variant: "secondary", size: "lg" })}>All services</Link>
        </div>
      </DarkSection>
    </SiteShell>
  );
}
