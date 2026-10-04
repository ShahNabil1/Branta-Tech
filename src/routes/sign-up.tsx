import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, GoogleButton, OrDivider } from "@/components/auth/AuthLayout";
import { aria, Field, FormAlert, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { safeNext } from "@/lib/client-session";
import { signInWithGoogle } from "@/lib/client-auth";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sign-up")({
  validateSearch: z.object({ next: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ meta: pageMeta({ title: "Create an account | Branta Tech", description: "Create a Branta client account.", noindex: true }) }),
  component: SignUp,
});

const Schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  confirm: z.string(),
  company: z.string().trim().max(120),
  phone: z.string().trim().max(40).refine((v) => !v || /^[+\d\s().-]{6,}$/.test(v), "Use digits, spaces, + ( ) -"),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

function SignUp() {
  const next = safeNext(Route.useSearch().next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const p = Schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!p.success) {
      const f: Record<string, string> = {};
      for (const i of p.error.issues) f[String(i.path[0])] ??= i.message;
      setErrs(f); return setError("Please check the highlighted fields.");
    }
    setBusy(true); setError(null); setErrs({});
    const d = p.data;
    // Only profile details go in metadata; the database assigns the client role itself.
    const { data, error } = await supabase.auth.signUp({
      email: d.email, password: d.password,
      options: { emailRedirectTo: `${window.location.origin}/sign-in?confirmed=1`, data: { full_name: d.full_name, company: d.company || undefined, phone: d.phone || undefined } },
    });
    setBusy(false);
    if (error) return setError(/weak|pwned|leaked/i.test(error.message) ? "Please choose a stronger password." : "We couldn't create your account. Please try again.");
    if (data.session) window.location.assign(next);
    else setSentTo(d.email);
  }

  async function google() {
    setBusy(true); setError(null);
    const err = await signInWithGoogle(next);
    if (err) { setError(err); setBusy(false); }
  }

  if (sentTo) {
    return (
      <AuthLayout eyebrow="CLIENT ACCOUNT" title="Check your email">
        <p role="status" className="text-body text-foreground">If {sentTo} can be used for a new account, we've sent a link to confirm it. Open it to finish creating your account.</p>
        <Link to="/sign-in" className="text-small mt-6 inline-block underline underline-offset-4">Back to sign in</Link>
      </AuthLayout>
    );
  }

  const a = (k: string) => aria(errs, k);
  return (
    <AuthLayout eyebrow="CLIENT ACCOUNT" title="Create an account" intro="Keep your project requests and call bookings in one place."
      footer={<>Already have an account? <Link to="/sign-in" search={{ next }} className="text-foreground underline underline-offset-4">Sign in</Link></>}>
      <GoogleButton onClick={google} busy={busy} label="Sign up with Google" />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        <Field id="full_name" label="Full name" required error={errs["full_name"]}><input id="full_name" name="full_name" autoComplete="name" className={inputCls} {...a("full_name")} /></Field>
        <Field id="email" label="Email" required error={errs["email"]}><input id="email" name="email" type="email" autoComplete="email" className={inputCls} {...a("email")} /></Field>
        <Field id="password" label="Password" required error={errs["password"]} hint="At least 8 characters"><input id="password" name="password" type="password" autoComplete="new-password" className={inputCls} {...a("password")} /></Field>
        <Field id="confirm" label="Confirm password" required error={errs["confirm"]}><input id="confirm" name="confirm" type="password" autoComplete="new-password" className={inputCls} {...a("confirm")} /></Field>
        <Field id="company" label="Company name" error={errs["company"]}><input id="company" name="company" autoComplete="organization" className={inputCls} {...a("company")} /></Field>
        <Field id="phone" label="Phone" error={errs["phone"]}><input id="phone" name="phone" type="tel" autoComplete="tel" className={inputCls} {...a("phone")} /></Field>
        <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
