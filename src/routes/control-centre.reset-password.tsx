import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, Field, FormMessage } from "@/components/admin/AuthCard";
import { Button } from "@/components/ui/brand-button";

export const Route = createFileRoute("/control-centre/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — Branta Control Centre" },
      { name: "description", content: "Choose a new Control Centre password." },
      { property: "og:title", content: "Set new password — Branta Control Centre" },
      { property: "og:description", content: "Choose a new Control Centre password." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPassword,
});

type State = "checking" | "ready" | "invalid";

function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("error") || query.get("error")) {
      setState("invalid");
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setState("ready");
    });
    // Fallback: if no recovery session appears shortly, the link is invalid or expired.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setState((s) => (s === "checking" ? (data.session ? "ready" : "invalid") : s));
    }, 1500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(updateError.message.includes("session") ? "This reset link has expired. Request a new one." : updateError.message);
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/control-centre", search: { reason: "reset" }, replace: true });
  }

  return (
    <AuthCard title="Set a new password">
      {state === "checking" && <p className="text-small text-muted-foreground">Checking your reset link…</p>}
      {state === "invalid" && (
        <div className="space-y-4">
          <FormMessage tone="error">This reset link is invalid or has expired.</FormMessage>
          <Link to="/control-centre/forgot-password" className="text-small font-medium underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      )}
      {state === "ready" && (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <Field label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
