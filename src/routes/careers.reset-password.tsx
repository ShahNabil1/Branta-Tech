import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormAlert, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/reset-password")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ meta: pageMeta({ title: "Choose a new password | Branta Careers", description: "Set a new password for your Branta Careers account.", noindex: true }) }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"wait" | "ok" | "invalid">("wait");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery") || new URLSearchParams(window.location.search).has("code");
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") setReady("ok"); });
    const t = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setReady((r) => (r === "ok" ? r : data.session && isRecovery ? "ok" : "invalid"));
    }, 800);
    return () => { sub.subscription.unsubscribe(); window.clearTimeout(t); };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== fd.get("confirm")) return setError("Passwords don't match.");
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError("We couldn't update your password. The link may have expired — request a new one.");
    navigate({ to: "/careers/account", replace: true });
  }

  return (
    <AuthLayout eyebrow="BRANTA CAREERS" title="Choose a new password">
      {ready === "wait" && <p className="text-body text-muted-foreground">Checking your link…</p>}
      {ready === "invalid" && (
        <div>
          <p className="text-body text-foreground">This reset link is invalid or has expired.</p>
          <Link to="/careers/forgot-password" className="text-small mt-4 inline-block underline underline-offset-4">Request a new link</Link>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field id="password" label="New password" required hint="At least 8 characters"><input id="password" name="password" type="password" autoComplete="new-password" className={inputCls} /></Field>
          <Field id="confirm" label="Confirm new password" required><input id="confirm" name="confirm" type="password" autoComplete="new-password" className={inputCls} /></Field>
          <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Saving…" : "Save password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
