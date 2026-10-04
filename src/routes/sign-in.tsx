import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, GoogleButton, OrDivider } from "@/components/auth/AuthLayout";
import { Field, FormAlert, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { safeNext } from "@/lib/client-session";
import { ensureClientProfile, signInWithGoogle } from "@/lib/client-auth";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({ next: z.string().optional(), confirmed: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ meta: pageMeta({ title: "Sign in | Branta Tech", description: "Sign in to your Branta client account.", noindex: true }) }),
  component: SignIn,
});

function SignIn() {
  const search = Route.useSearch();
  const next = safeNext(search.next);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or returning from Google): forward once the session is confirmed.
  useEffect(() => {
    let done = false;
    const go = async () => {
      if (done) return;
      const { data } = await supabase.auth.getUser();
      if (data.user && !done) {
        done = true;
        await ensureClientProfile();
        navigate({ to: next as "/client", replace: true });
      }
    };
    void go();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => e === "SIGNED_IN" && void go());
    return () => sub.subscription.unsubscribe();
  }, [navigate, next]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) return setError("Enter your email and password.");
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError(/confirm/i.test(error.message) ? "Please confirm your email first — check your inbox for the link." : "That email and password don't match.");
    }
  }

  async function google() {
    setBusy(true); setError(null);
    const err = await signInWithGoogle(next);
    if (err) { setError(err); setBusy(false); }
  }

  return (
    <AuthLayout eyebrow="CLIENT ACCOUNT" title="Sign in" intro="Follow your requests, call bookings and shared files."
      footer={<>New to Branta? <Link to="/sign-up" search={{ next }} className="text-foreground underline underline-offset-4">Create an account</Link></>}>
      {search.confirmed && <div className="mb-5"><FormAlert tone="info">Email confirmed. You can sign in now.</FormAlert></div>}
      <GoogleButton onClick={google} busy={busy} />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        <Field id="email" label="Email" required><input id="email" name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
        <Field id="password" label="Password" required><input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} /></Field>
        <Link to="/forgot-password" className="text-small -mt-2 self-end text-muted-foreground underline underline-offset-4 hover:text-foreground">Forgot password?</Link>
        <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
