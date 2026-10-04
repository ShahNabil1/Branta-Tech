import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Globe, Layers, Image, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession } from "@/lib/supabase/admin-access";

export const Route = createFileRoute("/control-centre/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/control-centre" });
    const admin = await getAdminSession();
    if (!admin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/control-centre", search: { reason: "denied" } });
    }
    return { admin };
  },
  component: AdminLayout,
});

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/control-centre/dashboard" as const },
  { label: "Website", icon: Globe },
  { label: "Services", icon: Layers },
  { label: "Portfolio", icon: Image },
  { label: "Settings", icon: Settings },
];

function AdminLayout() {
  const { admin } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/control-centre", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="dark flex shrink-0 flex-col bg-background text-foreground md:sticky md:top-0 md:h-screen md:w-60">
        <div className="flex items-center gap-2 px-5 py-5">
          <span aria-hidden className="grid size-7 place-items-center rounded-sm bg-foreground text-caption font-bold text-background">B</span>
          <span className="text-small font-semibold">Control Centre</span>
        </div>
        <nav aria-label="Control Centre" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {nav.map(({ label, icon: Icon, to }) =>
            to ? (
              <Link
                key={label}
                to={to}
                className="text-small flex items-center gap-3 rounded-sm px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-muted text-foreground [&>svg]:text-accent" }}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ) : (
              <span
                key={label}
                aria-disabled="true"
                className="text-small flex cursor-not-allowed items-center gap-3 rounded-sm px-3 py-2 text-muted-foreground/50"
                title="Coming soon"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
            ),
          )}
        </nav>
        <div className="hidden border-t border-border px-5 py-4 md:block">
          <p className="text-caption truncate text-muted-foreground">{admin.email}</p>
          <button onClick={signOut} className="text-small mt-2 flex items-center gap-2 text-foreground hover:text-accent">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end border-b border-border px-6 py-3 md:hidden">
          <button onClick={signOut} className="text-small flex items-center gap-2">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </header>
        <main className="px-6 py-10 md:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
