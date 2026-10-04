import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminHead, must } from "@/lib/supabase/cms";
import { PageHeader, Panel, StatusBadge, EmptyState, LoadingRow, ErrorNote, formatDate } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/dashboard")({
  head: () => adminHead("Dashboard"),
  component: Dashboard,
});

const count = (q: PromiseLike<{ count: number | null; error: unknown }>) =>
  Promise.resolve(q).then((r) => {
    if (r.error) throw r.error;
    return r.count ?? 0;
  });

function Dashboard() {
  const { admin } = Route.useRouteContext();
  const q = useQuery({
    queryKey: ["cms", "dashboard"],
    queryFn: async () => {
      const head = { count: "exact" as const, head: true };
      const [pub, draft, services, projects, featured, pages, recentServices, recentProjects] = await Promise.all([
        count(supabase.from("site_pages").select("id", head).eq("status", "published")),
        count(supabase.from("site_pages").select("id", head).eq("status", "draft")),
        count(supabase.from("services").select("id", head)),
        count(supabase.from("portfolio_projects").select("id", head)),
        count(supabase.from("portfolio_projects").select("id", head).eq("is_featured", true)),
        must(supabase.from("site_pages").select("id,title,status,updated_at").order("updated_at", { ascending: false }).limit(5)),
        must(supabase.from("services").select("id,name,status,updated_at").order("updated_at", { ascending: false }).limit(5)),
        must(supabase.from("portfolio_projects").select("id,title,status,updated_at").order("updated_at", { ascending: false }).limit(5)),
      ]);
      return { pub, draft, services, projects, featured, pages, recentServices, recentProjects };
    },
  });

  const stats = q.data
    ? [
        ["Published pages", q.data.pub],
        ["Draft pages", q.data.draft],
        ["Services", q.data.services],
        ["Portfolio projects", q.data.projects],
        ["Featured projects", q.data.featured],
      ]
    : [];

  return (
    <div className="max-w-6xl">
      <PageHeader eyebrow="Overview" title="Dashboard" description={`Signed in as ${admin.fullName || admin.email} · ${admin.roles.join(", ")}`} />
      {q.isLoading && <LoadingRow />}
      {q.error && <ErrorNote>Couldn't load dashboard data.</ErrorNote>}
      {q.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-surface px-4 py-4">
                <p className="text-caption text-muted-foreground">{label}</p>
                <p className="text-h3 mt-1 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <Recent title="Recent pages" rows={q.data.pages.map((p) => ({ id: p.id, name: p.title, status: p.status, updated_at: p.updated_at }))} kind="page" />
            <Recent title="Recent services" rows={q.data.recentServices.map((p) => ({ id: p.id, name: p.name, status: p.status, updated_at: p.updated_at }))} kind="service" />
            <Recent title="Recent projects" rows={q.data.recentProjects.map((p) => ({ id: p.id, name: p.title, status: p.status, updated_at: p.updated_at }))} kind="project" />
          </div>
        </>
      )}
    </div>
  );
}

function Recent({ title, rows, kind }: { title: string; rows: { id: string; name: string; status: string; updated_at: string }[]; kind: "page" | "service" | "project" }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <EmptyState>Nothing yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                {kind === "page" ? (
                  <Link to="/control-centre/website/pages/$id" params={{ id: r.id }} className="text-small block truncate font-medium hover:text-accent">{r.name}</Link>
                ) : kind === "service" ? (
                  <Link to="/control-centre/services/$id" params={{ id: r.id }} className="text-small block truncate font-medium hover:text-accent">{r.name}</Link>
                ) : (
                  <Link to="/control-centre/portfolio/projects/$id" params={{ id: r.id }} className="text-small block truncate font-medium hover:text-accent">{r.name}</Link>
                )}
                <p className="text-caption text-muted-foreground">{formatDate(r.updated_at)}</p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
