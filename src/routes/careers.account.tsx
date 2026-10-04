import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteContainer } from "@/components/layout/primitives";
import { ensureApplicantProfile } from "@/lib/applicant-auth";

export const Route = createFileRoute("/careers/account")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/careers/sign-in", search: { next: location.pathname } });
    await ensureApplicantProfile();
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Applicant account | Branta Careers" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AccountLayout,
});

function AccountLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/careers/sign-in", replace: true });
  }
  return (
    <SiteShell>
      <section className="bg-background py-10 md:py-16">
        <SiteContainer>
          <div className="mb-8 flex justify-end">
            <button onClick={signOut} className="text-small flex items-center gap-2 rounded-sm px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <LogOut className="size-4" aria-hidden />Sign out
            </button>
          </div>
          <Outlet />
        </SiteContainer>
      </section>
    </SiteShell>
  );
}
