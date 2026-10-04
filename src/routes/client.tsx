import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Inbox, CalendarClock, FolderLock, UserRound, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteContainer } from "@/components/layout/primitives";
import { ensureClientProfile } from "@/lib/client-auth";
import { myRoles } from "@/lib/applicant-auth";

export const Route = createFileRoute("/client")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sign-in", search: { next: location.pathname } });
    await ensureClientProfile();
    const roles = await myRoles(data.user.id);
    if (roles.includes("applicant") && !roles.includes("client")) throw redirect({ to: "/careers/account" });
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Client dashboard | Branta Tech" }, { name: "robots", content: "noindex" }] }),
  component: ClientLayout,
});

const items = [
  { to: "/client" as const, label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/client/requests" as const, label: "Requests", icon: Inbox },
  { to: "/client/bookings" as const, label: "Bookings", icon: CalendarClock },
  { to: "/client/files" as const, label: "Shared files", icon: FolderLock },
  { to: "/client/profile" as const, label: "Profile", icon: UserRound },
];

function ClientLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/sign-in", replace: true });
  }
  const linkCls = "text-small flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <SiteShell>
      <section className="bg-background py-10 md:py-16">
        <SiteContainer>
          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
            <nav aria-label="Client dashboard" className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible">
              {items.map(({ to, label, icon: Icon, exact }) => (
                <Link key={to} to={to} activeOptions={{ exact: !!exact }} className={linkCls} activeProps={{ className: "bg-muted text-foreground [&>svg]:text-accent" }}>
                  <Icon className="size-4" aria-hidden />{label}
                </Link>
              ))}
              <button onClick={signOut} className={linkCls}><LogOut className="size-4" aria-hidden />Sign out</button>
            </nav>
            <div className="min-w-0"><Outlet /></div>
          </div>
        </SiteContainer>
      </section>
    </SiteShell>
  );
}
