import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/control-centre/_admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Branta Control Centre" },
      { name: "description", content: "Branta Control Centre dashboard." },
      { property: "og:title", content: "Dashboard — Branta Control Centre" },
      { property: "og:description", content: "Branta Control Centre dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { admin } = Route.useRouteContext();
  return (
    <div className="max-w-3xl">
      <p className="text-eyebrow text-muted-foreground">Dashboard</p>
      <h1 className="text-h2 mt-3">Branta Control Centre</h1>
      <p className="text-body mt-4 text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{admin.fullName || admin.email}</span>
        {admin.fullName && admin.email ? ` (${admin.email})` : ""} · {admin.roles.join(", ")}
      </p>
    </div>
  );
}
