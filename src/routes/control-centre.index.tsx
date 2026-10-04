import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession } from "@/lib/supabase/admin-access";
import { AuthCard, Field, FormMessage } from "@/components/admin/AuthCard";
import { Button } from "@/components/ui/brand-button";

export const Route = createFileRoute("/control-centre/")({
  validateSearch: z.object({ reason: z.enum(["denied", "reset"]).optional() }),
  beforeLoad: async () => {
    if (await getAdminSession()) throw redirect({ to: "/control-centre/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Branta Control Centre" },
      { name: "description", content: "Branta Tech staff sign in." },
      { property: "og:title", content: "Branta Control Centre" },
      { property: "og:description", content: "Branta Tech staff sign in." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const { reason } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setBusy(false);
      setError("Incorrect email or password.");
      return;
    }
    const admin = await getAdminSession();
    if (!admin) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("This account does not have Control Centre access.");
      return;
    }
    navigate({ to: "/control-centre/dashboard", replace: true });
  }

  return (
    <AuthCard title="Sign in" intro="Staff access only.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {reason === "denied" && <FormMessage tone="error">You don't have access to the Control Centre.</FormMessage>}
        {reason === "reset" && <FormMessage tone="info">Password updated. Sign in with your new password.</FormMessage>}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Link to="/control-centre/forgot-password" className="text-small block text-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot password?
        </Link>
      </form>
    </AuthCard>
  );
}
