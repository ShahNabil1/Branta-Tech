import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { Check, Loader2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AccountTitle } from "@/components/applicant/ComingNext";
import { Field, FormAlert, fieldCls, inputCls } from "@/components/forms/FormKit";
import { buttonVariants } from "@/components/ui/brand-button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/careers/account/profile")({ component: Profile });

// applicant_profiles is newer than the generated types; keep access in this one place.
const db = supabase as unknown as { from: (t: string) => any };
const BUCKET = "applicant-media";

type Form = {
  full_name: string; phone: string; photo_path: string; current_location: string; institute: string;
  study_department: string; study_status: string; graduation_year: string; semester: string; short_bio: string;
  linkedin_url: string; portfolio_url: string; behance_url: string; github_url: string; website_url: string;
};
const EMPTY: Form = { full_name: "", phone: "", photo_path: "", current_location: "", institute: "", study_department: "", study_status: "", graduation_year: "", semester: "", short_bio: "", linkedin_url: "", portfolio_url: "", behance_url: "", github_url: "", website_url: "" };
const URL_KEYS = ["linkedin_url", "portfolio_url", "behance_url", "github_url", "website_url"] as const;
const STATUS = [["studying", "Currently studying"], ["final_year", "Final year"], ["graduated", "Graduated"], ["not_studying", "Not studying"]] as const;

function validate(f: Form) {
  const e: Record<string, string> = {};
  if (f.full_name.trim().length < 2) e["full_name"] = "Enter your full name";
  if (f.phone && !/^[+\d\s().-]{6,40}$/.test(f.phone.trim())) e["phone"] = "Use digits, spaces, + ( ) -";
  if (f.graduation_year && !/^(19[6-9]\d|20\d\d|2100)$/.test(f.graduation_year.trim())) e["graduation_year"] = "Enter a year like 2026";
  if (f.short_bio.length > 1000) e["short_bio"] = "Keep it under 1000 characters";
  for (const k of URL_KEYS) {
    const v = f[k].trim();
    if (v && !/^https:\/\/[^\s]+\.[^\s]+$/.test(v)) e[k] = "Use a full link starting with https://";
  }
  return e;
}
const nn = (v: string) => (v.trim() ? v.trim() : null);

function Profile() {
  const { user } = Route.useRouteContext();
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
        db.from("applicant_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      const f: Form = { ...EMPTY };
      f.full_name = p?.full_name ?? ""; f.phone = p?.phone ?? "";
      if (a) for (const k of Object.keys(EMPTY) as (keyof Form)[]) if (k in a && a[k] != null) f[k] = String(a[k]);
      setSaved(f); setForm(f); setLoaded(true);
    })();
  }, [user.id]);

  useEffect(() => {
    if (!form.photo_path) return setPhotoUrl(null);
    let alive = true;
    supabase.storage.from(BUCKET).createSignedUrl(form.photo_path, 3600).then(({ data }) => alive && setPhotoUrl(data?.signedUrl ?? null));
    return () => { alive = false; };
  }, [form.photo_path]);

  const dirty = useMemo(() => loaded && JSON.stringify(form) !== JSON.stringify(saved), [form, saved, loaded]);
  useBlocker({ shouldBlockFn: () => dirty && !window.confirm("You have unsaved changes. Leave without saving?"), enableBeforeUnload: () => dirty });

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (state !== "saving") setState("idle");
  };

  async function upload(file: File | undefined) {
    if (!file) return;
    setPhotoErr(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setPhotoErr("Use a JPG, PNG or WebP image.");
    if (file.size > 3 * 1024 * 1024) return setPhotoErr("The photo must be under 3 MB.");
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/photo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) return setPhotoErr("We couldn't upload that photo. Please try again.");
    setForm((f) => ({ ...f, photo_path: path }));
    setState("idle");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    const v = validate(form);
    setErrs(v);
    if (Object.keys(v).length) return setState("error");
    savingRef.current = true; setState("saving");
    const old = saved.photo_path;
    const p1 = supabase.from("profiles").update({ full_name: form.full_name.trim().slice(0, 120), phone: nn(form.phone) }).eq("id", user.id);
    const p2 = db.from("applicant_profiles").upsert({
      user_id: user.id, photo_path: nn(form.photo_path), current_location: nn(form.current_location), institute: nn(form.institute),
      study_department: nn(form.study_department), study_status: nn(form.study_status),
      graduation_year: form.graduation_year.trim() ? Number(form.graduation_year) : null, semester: nn(form.semester),
      short_bio: nn(form.short_bio), linkedin_url: nn(form.linkedin_url), portfolio_url: nn(form.portfolio_url),
      behance_url: nn(form.behance_url), github_url: nn(form.github_url), website_url: nn(form.website_url),
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    savingRef.current = false;
    if (r1.error || r2.error) return setState("error");
    if (old && old !== form.photo_path) void supabase.storage.from(BUCKET).remove([old]);
    setSaved(form); setState("saved");
  }

  if (!loaded) return <p className="text-body text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading your profile…</p>;

  const input = (k: keyof Form, label: string, o: { type?: string; ac?: string; required?: boolean; hint?: string; ph?: string } = {}) => (
    <Field id={k} label={label} required={o.required} error={errs[k]} hint={o.hint}>
      <input id={k} name={k} type={o.type ?? "text"} autoComplete={o.ac} placeholder={o.ph} value={form[k]} onChange={set(k)}
        aria-invalid={!!errs[k] || undefined} aria-describedby={errs[k] ? `${k}-err` : undefined} className={inputCls} />
    </Field>
  );
  const card = "rounded-sm border border-border bg-surface p-5 md:p-7";

  return (
    <div className="max-w-3xl pb-28">
      <AccountTitle title="Profile" intro="This is what Branta's hiring team will see alongside your applications." />
      <form onSubmit={save} noValidate className="flex flex-col gap-6">
        <section className={card} aria-labelledby="s-personal">
          <h2 id="s-personal" className="text-h4 mb-6 text-foreground">Personal details</h2>
          <div className="mb-6 flex items-center gap-5">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {photoUrl ? <img src={photoUrl} alt="Your profile photo" className="size-full object-cover" /> : <UserRound className="size-8 text-muted-foreground" aria-hidden />}
            </div>
            <div className="flex flex-col gap-2">
              <label className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "cursor-pointer self-start", uploading && "pointer-events-none opacity-60")}>
                {uploading && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{uploading ? "Uploading…" : form.photo_path ? "Replace photo" : "Upload photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {form.photo_path && <button type="button" onClick={() => setForm((f) => ({ ...f, photo_path: "" }))} className="text-small self-start text-muted-foreground underline underline-offset-4 hover:text-foreground">Remove photo</button>}
              <p className="text-caption text-muted-foreground">JPG, PNG or WebP, up to 3 MB. Only you and Branta can see it.</p>
              {photoErr && <p role="alert" className="text-caption text-destructive">{photoErr}</p>}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {input("full_name", "Full name", { ac: "name", required: true })}
            {input("phone", "Phone", { type: "tel", ac: "tel" })}
            <div className="md:col-span-2">{input("current_location", "Current location", { ac: "address-level2", ph: "e.g. Dhaka, Bangladesh" })}</div>
          </div>
          <div className="mt-5">
            <p className="text-small font-medium text-foreground">Email</p>
            <p className="text-body mt-1 text-muted-foreground">{user.email}</p>
            <EmailChange />
          </div>
        </section>

        <section className={card} aria-labelledby="s-edu">
          <h2 id="s-edu" className="text-h4 mb-6 text-foreground">Education</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">{input("institute", "University / institute")}</div>
            {input("study_department", "Department / subject")}
            <Field id="study_status" label="Current study status">
              <select id="study_status" value={form.study_status} onChange={set("study_status")} className={inputCls}>
                <option value="">Choose…</option>
                {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {input("graduation_year", "Graduation year", { ph: "e.g. 2026" })}
            {input("semester", "Semester", { hint: "Optional", ph: "e.g. 6th" })}
          </div>
        </section>

        <section className={card} aria-labelledby="s-about">
          <h2 id="s-about" className="text-h4 mb-6 text-foreground">About you</h2>
          <Field id="short_bio" label="Short bio" error={errs["short_bio"]} hint={`${form.short_bio.length}/1000`}>
            <textarea id="short_bio" rows={5} value={form.short_bio} onChange={set("short_bio")} className={cn(fieldCls, "py-3")} />
          </Field>
        </section>

        <section className={card} aria-labelledby="s-links">
          <h2 id="s-links" className="text-h4 mb-6 text-foreground">Links</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {input("linkedin_url", "LinkedIn", { type: "url", ph: "https://linkedin.com/in/…" })}
            {input("portfolio_url", "Portfolio", { type: "url", ph: "https://" })}
            {input("behance_url", "Behance", { type: "url", hint: "Optional", ph: "https://behance.net/…" })}
            {input("github_url", "GitHub", { type: "url", hint: "Optional", ph: "https://github.com/…" })}
            <div className="md:col-span-2">{input("website_url", "Personal website", { type: "url", hint: "Optional", ph: "https://" })}</div>
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-4 px-5 py-3">
            <p role="status" className="text-small mr-auto text-muted-foreground">
              {state === "saving" ? "Saving…" : state === "saved" && !dirty ? <span className="inline-flex items-center gap-1 text-foreground"><Check className="size-4 text-accent" />Saved</span>
                : state === "error" ? <span className="text-destructive">{Object.keys(errs).length ? "Please check the highlighted fields." : "We couldn't save. Please try again."}</span>
                : dirty ? "Unsaved changes" : ""}
            </p>
            <button type="submit" disabled={state === "saving" || uploading || !dirty} className={buttonVariants({ variant: "primary", size: "md" })}>
              {state === "saving" && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}{state === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EmailChange() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  async function go() {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg({ tone: "error", text: "Enter a valid email." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/careers/account/profile` });
    setBusy(false);
    setMsg(error ? { tone: "error", text: "We couldn't start the email change. Please try again." } : { tone: "info", text: "Check both inboxes and confirm the change. Your email stays the same until then." });
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-small mt-2 text-muted-foreground underline underline-offset-4 hover:text-foreground">Change email</button>;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {msg && <FormAlert tone={msg.tone}>{msg.text}</FormAlert>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input aria-label="New email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="New email" className={inputCls} />
        <button type="button" onClick={go} disabled={busy} className={cn(buttonVariants({ variant: "secondary", size: "md" }), "shrink-0")}>{busy ? "Sending…" : "Send confirmation"}</button>
      </div>
    </div>
  );
}
