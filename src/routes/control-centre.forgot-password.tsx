import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, Field, FormMessage } from "@/components/admin/AuthCard";
import { Button } from "@/components/ui/brand-button";

export const Route = createFileRoute("/control-centre/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Branta Control Centre" },
      { name: "description", content: "Request a password reset link." },
      { property: "og:title", content: "Reset password — Branta Control Centre" },
      { property: "og:description", content: "Request a password reset link." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/control-centre/reset-password`,
    });
    setBusy(false);
    // Same message whether or not the account exists, so emails can't be probed.
    if (resetError && resetError.status === 429) setError("Too many requests. Please wait a minute and try again.");
    else setSent(true);
  }

  return (
    <AuthCard title="Forgot password" intro="We'll email you a link to set a new password.">
      {sent ? (
        <FormMessage tone="info">If that email belongs to a staff account, a reset link is on its way.</FormMessage>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy || !email}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link to="/control-centre" className="text-small mt-6 block text-center text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
