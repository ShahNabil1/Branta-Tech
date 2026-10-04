import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/brand-button";
import { displayName } from "@/lib/client-session";

export const Route = createFileRoute("/careers/account/")({
  component: AccountHome,
});

function AccountHome() {
  const { user } = Route.useRouteContext();
  return (
    <div className="max-w-2xl">
      <Eyebrow>BRANTA CAREERS</Eyebrow>
      <h1 className="text-heading-lg mt-4 text-foreground">Welcome, {displayName(user)}.</h1>
      <p className="text-body mt-4 text-muted-foreground">You're signed in as {user.email}. Your applications will appear here soon.</p>
      <Link to="/careers" className={buttonVariants({ variant: "primary", size: "lg" }) + " mt-8"}>Browse open roles</Link>
    </div>
  );
}
