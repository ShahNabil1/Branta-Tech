import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Field, FormAlert, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/forgot-password")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ meta: pageMeta({ title: "Reset your password | Branta Careers", description: "Get a link to reset your Branta Careers applicant password.", noindex: true }) }),
  component: Forgot,
});

function Forgot() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email.");
    setBusy(true); setError(null);
    // Same message whether or not the account exists (no account enumeration).
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/careers/reset-password` });
    setBusy(false); setSent(true);
  }

  return (
    <AuthLayout eyebrow="BRANTA CAREERS" title="Forgot your password?" intro="Enter your email and we'll send you a reset link."
      footer={<Link to="/careers/sign-in" className="text-foreground underline underline-offset-4">Back to sign in</Link>}>
      {sent ? (
        <p role="status" className="text-body text-foreground">If an account exists for that email, a reset link is on its way. It may take a few minutes.</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field id="email" label="Email" required><input id="email" name="email" type="email" autoComplete="email" className={inputCls} /></Field>
          <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
