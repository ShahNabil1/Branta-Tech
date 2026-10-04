import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/SiteShell";
import { Section, SiteContainer } from "@/components/layout/primitives";
import { RichText } from "@/components/content/RichText";
import { PostTile } from "@/components/content/PostCards";
import { siteChromeQuery } from "@/lib/navigation";
import { formatPostDate, postQuery } from "@/lib/company.functions";
import { readingMinutes } from "@/lib/rich-text";
import { pageMeta, canonical } from "@/lib/seo";

export const Route = createFileRoute("/insights/$slug")({
  loader: async ({ context, params }) => {
    const [, res] = await Promise.all([context.queryClient.ensureQueryData(siteChromeQuery), context.queryClient.ensureQueryData(postQuery(params.slug))]);
    if (!res.post) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Article not found | Branta Tech" }, { name: "robots", content: "noindex" }] };
    const title = p.seo.title || `${p.title} | Branta Tech`;
    return {
      meta: pageMeta({ title, description: p.seo.description || p.excerpt || "An article from the Branta team.", image: p.seo.ogImage || p.cover, noindex: p.seo.noindex, type: "article" }),
      links: canonical(`/insights/${params.slug}`, p.seo.canonical),
    };
  },
  errorComponent: () => <p className="p-8">Something went wrong loading this article.</p>,
  notFoundComponent: () => (
    <SiteShell>
      <Section tone="warm">
        <h1 className="text-h1">This article isn't available</h1>
        <Link to="/insights" className="text-body mt-6 inline-block underline underline-offset-4">Back to Insights</Link>
      </Section>
    </SiteShell>
  ),
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  const p = data.post!;
  const mins = readingMinutes(p.blocks);
  const meta = [formatPostDate(p.publishedAt), mins ? `${mins} min read` : ""].filter(Boolean).join(" · ");
  return (
    <SiteShell>
      <article>
        <header className="pt-20 pb-12 md:pt-28">
          <SiteContainer>
            <Link to="/insights" className="text-small text-muted-foreground hover:text-foreground">← Insights</Link>
            {p.category && <p className="text-eyebrow mt-10 text-accent">{p.category}</p>}
            <h1 className="text-display mt-4 max-w-[22ch] break-words text-foreground">{p.title}</h1>
            {p.excerpt && <p className="text-body-lg mt-8 max-w-2xl text-muted-foreground">{p.excerpt}</p>}
            <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-6">
              {p.author?.photo && <img src={p.author.photo} alt="" className="size-10 rounded-full object-cover" />}
              <div>
                {p.author && <p className="text-small font-medium text-foreground">{p.author.name}{p.author.role ? <span className="font-normal text-muted-foreground"> · {p.author.role}</span> : null}</p>}
                {meta && <p className="text-caption text-muted-foreground">{meta}</p>}
              </div>
            </div>
          </SiteContainer>
        </header>
        {p.cover && (
          <SiteContainer>
            <img src={p.cover} alt={p.coverAlt} className="aspect-[16/9] w-full rounded-[6px] object-cover" />
          </SiteContainer>
        )}
        <SiteContainer>
          <div className="mx-auto max-w-[68ch] py-16 md:py-24">
            {p.blocks.length ? <RichText blocks={p.blocks} /> : null}
            {p.author?.bio && (
              <aside className="mt-16 border-t border-border pt-8">
                <p className="text-eyebrow text-muted-foreground">About the author</p>
                <p className="text-body mt-3 text-foreground">{p.author.name}</p>
                <p className="text-small mt-2 text-muted-foreground">{p.author.bio}</p>
                {p.author.profileUrl && <a href={p.author.profileUrl} target="_blank" rel="noopener noreferrer" className="text-small mt-3 inline-block underline underline-offset-4">Profile</a>}
              </aside>
            )}
          </div>
        </SiteContainer>
      </article>
      {data.related.length > 0 && (
        <Section tone="muted" aria-labelledby="more-title">
          <h2 id="more-title" className="text-h2 text-foreground">More from Insights</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">{data.related.map((r) => <PostTile key={r.slug} p={r} />)}</div>
        </Section>
      )}
    </SiteShell>
  );
}
