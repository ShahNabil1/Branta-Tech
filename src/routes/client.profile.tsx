import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientHeader, Card, Loading } from "@/components/client/ClientKit";
import { Field, FormAlert, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { cn } from "@/lib/utils";
import { useMyProfile } from "./client";

export const Route = createFileRoute("/client/profile")({ component: Profile });

function Profile() {
  const { user } = Route.useRouteContext();
  const profile = useMyProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const full_name = String(fd.get("full_name") ?? "").trim().slice(0, 120);
    const phone = String(fd.get("phone") ?? "").trim().slice(0, 40);
    const company = String(fd.get("company") ?? "").trim().slice(0, 120);
    if (full_name.length < 2) return setMsg({ tone: "error", text: "Enter your full name." });
    if (phone && !/^[+\d\s().-]{6,}$/.test(phone)) return setMsg({ tone: "error", text: "Use digits, spaces, + ( ) - for your phone." });
    setBusy(true); setMsg(null);
    // Only these columns are sent; roles live in a separate table clients can't write.
    const { error } = await supabase.from("profiles").update({ full_name, phone: phone || null, company: company || null }).eq("id", user.id);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: "We couldn't save your profile. Please try again." });
    await qc.invalidateQueries({ queryKey: ["client", "profile"] });
    setMsg({ tone: "info", text: "Profile saved." });
  }

  async function changeEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("new_email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setEmailMsg({ tone: "error", text: "Enter a valid email." });
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/client/profile` });
    setEmailMsg(error ? { tone: "error", text: "We couldn't start the email change. Please try again." } : { tone: "info", text: "Check both inboxes to confirm the change." });
  }

  const p = profile.data;
  return (
    <div className="max-w-2xl">
      <ClientHeader title="Profile" />
      <div className="flex flex-col gap-5">
        <Card title="Your details">
          {profile.isLoading ? <Loading /> : (
            <form onSubmit={save} noValidate className="flex flex-col gap-5">
              {msg && <FormAlert tone={msg.tone}>{msg.text}</FormAlert>}
              <Field id="full_name" label="Full name" required><input id="full_name" name="full_name" defaultValue={p?.full_name ?? ""} autoComplete="name" className={inputCls} /></Field>
              <Field id="phone" label="Phone"><input id="phone" name="phone" type="tel" defaultValue={p?.phone ?? ""} autoComplete="tel" className={inputCls} /></Field>
              <Field id="company" label="Company"><input id="company" name="company" defaultValue={p?.company ?? ""} autoComplete="organization" className={inputCls} /></Field>
              <button type="submit" disabled={busy} className={cn(buttonVariants({ variant: "primary", size: "md" }), "self-start")}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{busy ? "Saving…" : "Save"}
              </button>
            </form>
          )}
        </Card>
        <Card title="Email">
          <p className="text-small mb-4 text-muted-foreground">Signed in as <span className="text-foreground">{user.email}</span></p>
          <form onSubmit={changeEmail} noValidate className="flex flex-col gap-4">
            {emailMsg && <FormAlert tone={emailMsg.tone}>{emailMsg.text}</FormAlert>}
            <Field id="new_email" label="New email" required><input id="new_email" name="new_email" type="email" className={inputCls} /></Field>
            <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "md" }), "self-start")}>Change email</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
