import logoDark from "@/assets/brand/branta-logo.png.asset.json";
import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, FileText, Newspaper, UserRound, Briefcase, Inbox, Target, CalendarClock, Menu, Layers, Image, FolderOpen, Settings, Users, LogOut, PanelLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, CMS_ROLES } from "@/lib/supabase/admin-access";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";

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

const groups = [
  { title: "Overview", items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/control-centre/dashboard" as const }] },
  {
    title: "Website",
    items: [
      { label: "Pages", icon: FileText, to: "/control-centre/website/pages" as const },
      { label: "Navigation", icon: Menu, to: "/control-centre/website/navigation" as const },
      { label: "Services", icon: Layers, to: "/control-centre/services" as const },
      { label: "Portfolio", icon: Image, to: "/control-centre/portfolio" as const },
      { label: "Media", icon: FolderOpen, to: "/control-centre/media" as const },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Insights", icon: Newspaper, to: "/control-centre/insights" as const },
      { label: "Team", icon: UserRound, to: "/control-centre/team" as const },
    ],
  },
  {
    title: "Sales",
    access: "sales",
    items: [
      { label: "Leads", icon: Target, to: "/control-centre/leads" as const },
      { label: "Bookings", icon: CalendarClock, to: "/control-centre/bookings" as const },
    ],
  },
  {
    title: "Careers",
    access: "hr",
    items: [
      { label: "Jobs", icon: Briefcase, to: "/control-centre/careers/jobs" as const },
      { label: "Applications", icon: Inbox, to: "/control-centre/careers/applications" as const },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Site Settings", icon: Settings, to: "/control-centre/settings/site" as const },
      { label: "Admin Users", icon: Users, to: "/control-centre/admin-users" as const },
    ],
  },
];

function NavList({ onNavigate, roles }: { onNavigate?: () => void; roles: string[] }) {
  const cms = roles.some((r) => (CMS_ROLES as readonly string[]).includes(r));
  const visible = (g: (typeof groups)[number]) => cms || ("access" in g && roles.includes(g.access as string));
  return (
    <nav aria-label="Control Centre" className="flex flex-col gap-6 px-3">
      {groups.filter(visible).map((g) => (
        <div key={g.title}>
          <p className="text-caption px-3 pb-2 uppercase tracking-wider text-muted-foreground/70">{g.title}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map(({ label, icon: Icon, to }) => (
              <li key={label}>
                <Link
                  to={to}
                  onClick={onNavigate}
                  className="text-small flex items-center gap-3 rounded-sm px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "bg-muted text-foreground [&>svg]:text-accent" }}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-5 py-5">
      <img src={logoDark.url} alt="Branta" width={1288} height={308} className="h-6 w-auto" />
      <span className="text-small font-semibold">Control Centre</span>
    </div>
  );
}

function AdminLayout() {
  const { admin } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/control-centre", replace: true });
  }

  const footer = (
    <div className="border-t border-border px-5 py-4">
      <p className="text-caption truncate text-muted-foreground">{admin.email}</p>
      <button onClick={signOut} className="text-small mt-2 flex items-center gap-2 text-foreground hover:text-accent">
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="dark hidden shrink-0 flex-col bg-background text-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-6"><NavList roles={admin.roles} /></div>
        {footer}
      </aside>

      <header className="dark sticky top-0 z-30 flex items-center justify-between bg-background px-4 py-3 text-foreground lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex items-center gap-2 text-small">
          <PanelLeft className="size-5" aria-hidden /> Menu
        </button>
        <span className="text-small font-semibold">Control Centre</span>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="dark flex w-72 flex-col border-border bg-background p-0 text-foreground">
          <SheetTitle className="sr-only">Control Centre menu</SheetTitle>
          <Brand />
          <div className="flex-1 overflow-y-auto pb-6"><NavList roles={admin.roles} onNavigate={() => setOpen(false)} /></div>
          {footer}
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <main className="px-4 py-8 sm:px-6 md:px-10 md:py-10">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
