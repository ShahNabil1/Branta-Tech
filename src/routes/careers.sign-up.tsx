import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, GoogleButton, OrDivider } from "@/components/auth/AuthLayout";
import { aria, Field, FormAlert, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { siteChromeQuery } from "@/lib/navigation";
import { safeCareersNext, signInApplicantWithGoogle } from "@/lib/applicant-auth";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/sign-up")({
  validateSearch: z.object({ next: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteChromeQuery),
  head: () => ({ meta: pageMeta({ title: "Create an applicant account | Branta Careers", description: "Create a Branta Careers applicant account.", noindex: true }) }),
  component: SignUp,
});

const Schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  confirm: z.string(),
  phone: z.string().trim().max(40).refine((v) => !v || /^[+\d\s().-]{6,}$/.test(v), "Use digits, spaces, + ( ) -"),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

function SignUp() {
  const next = safeCareersNext(Route.useSearch().next);
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
    // signup_portal is only a hint; the database maps it to "applicant" and never to a staff role.
    const { data, error } = await supabase.auth.signUp({
      email: d.email, password: d.password,
      options: {
        emailRedirectTo: `${window.location.origin}/careers/sign-in?confirmed=1&next=${encodeURIComponent(next)}`,
        data: { full_name: d.full_name, phone: d.phone || undefined, signup_portal: "careers" },
      },
    });
    setBusy(false);
    if (error) return setError(/weak|pwned|leaked/i.test(error.message) ? "Please choose a stronger password." : "We couldn't create your account. Please try again.");
    if (data.session) window.location.assign(`/careers/sign-in?next=${encodeURIComponent(next)}`);
    else setSentTo(d.email);
  }

  async function google() {
    setBusy(true); setError(null);
    const err = await signInApplicantWithGoogle(next);
    if (err) { setError(err); setBusy(false); }
  }

  if (sentTo) {
    return (
      <AuthLayout eyebrow="BRANTA CAREERS" title="Check your email">
        <p role="status" className="text-body text-foreground">If {sentTo} can be used for a new account, we've sent a link to confirm it. Open it to finish creating your applicant account.</p>
        <Link to="/careers/sign-in" search={{ next }} className="text-small mt-6 inline-block underline underline-offset-4">Back to sign in</Link>
      </AuthLayout>
    );
  }

  const a = (k: string) => aria(errs, k);
  return (
    <AuthLayout eyebrow="BRANTA CAREERS" title="Create an applicant account" intro="Apply for roles and internships and follow your applications."
      footer={<>Already have an account? <Link to="/careers/sign-in" search={{ next }} className="text-foreground underline underline-offset-4">Sign in</Link></>}>
      <GoogleButton onClick={google} busy={busy} label="Sign up with Google" />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        <Field id="full_name" label="Full name" required error={errs["full_name"]}><input id="full_name" name="full_name" autoComplete="name" className={inputCls} {...a("full_name")} /></Field>
        <Field id="email" label="Email" required error={errs["email"]}><input id="email" name="email" type="email" autoComplete="email" className={inputCls} {...a("email")} /></Field>
        <Field id="password" label="Password" required error={errs["password"]} hint="At least 8 characters"><input id="password" name="password" type="password" autoComplete="new-password" className={inputCls} {...a("password")} /></Field>
        <Field id="confirm" label="Confirm password" required error={errs["confirm"]}><input id="confirm" name="confirm" type="password" autoComplete="new-password" className={inputCls} {...a("confirm")} /></Field>
        <Field id="phone" label="Phone" error={errs["phone"]}><input id="phone" name="phone" type="tel" autoComplete="tel" className={inputCls} {...a("phone")} /></Field>
        <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
