import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Loader2, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Internal paths ("/x", "#x") or http(s)/mailto/tel. Blocks javascript:, data:, etc. */
export function isSafeUrl(url: string, { allowInternal = true } = {}) {
  const v = url.trim();
  if (!v) return true;
  if (/[\s<>"]/.test(v)) return false;
  if (allowInternal && (v.startsWith("/") || v.startsWith("#"))) return !v.startsWith("//");
  try {
    const u = new URL(v);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return "Something went wrong.";
  if (e.code === "23505") return "That slug is already in use. Choose a different one.";
  if (e.code === "23514") return "One of the values isn't allowed. Check the fields and try again.";
  if (e.code === "23503") return "This item is linked to other content and can't be changed that way.";
  if (e.code === "42501") return "You don't have permission to do that.";
  return e.message || "Something went wrong.";
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());

/** Slug that follows the title until the admin edits it manually. */
export function useAutoSlug(initialSlug: string, isNew: boolean) {
  const [slug, setSlugState] = useState(initialSlug);
  const touched = useRef(!isNew);
  return {
    slug,
    setSlug: (v: string) => {
      touched.current = true;
      setSlugState(v);
    },
    syncFrom: (title: string) => {
      if (!touched.current) setSlugState(slugify(title));
    },
    reset: (v: string) => {
      touched.current = true;
      setSlugState(v);
    },
  };
}

/** Warn when navigating away (in-app or tab close) with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useBlocker({
    shouldBlockFn: () => (dirty ? !window.confirm("You have unsaved changes. Leave anyway?") : false),
    enableBeforeUnload: () => dirty,
  });
}

/* ---------- layout ---------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-h3 mt-2">{title}</h1>
        {description && <p className="text-small mt-2 max-w-xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, children, actions, className }: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h2 className="text-body font-semibold">{title}</h2>}
            {description && <p className="text-caption mt-1 text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-small rounded-sm border border-dashed border-border px-4 py-8 text-center text-muted-foreground">{children}</p>;
}

export function LoadingRow() {
  return (
    <div className="text-small flex items-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-small rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
      {children}
    </p>
  );
}

/* ---------- table ---------- */

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="text-caption whitespace-nowrap px-4 py-2.5 font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("text-small px-4 py-3 align-middle", className)}>{children}</td>
);

/* ---------- badges ---------- */

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "border-foreground/20 bg-foreground text-background",
    draft: "border-border bg-muted text-foreground",
    archived: "border-border bg-transparent text-muted-foreground line-through decoration-1",
  };
  return (
    <span className={cn("text-caption inline-flex items-center rounded-sm border px-2 py-0.5 font-medium capitalize", map[status] ?? map["draft"])}>
      {status}
    </span>
  );
}

export function FeaturedBadge() {
  return (
    <span className="text-caption inline-flex items-center rounded-sm border border-accent/40 px-2 py-0.5 font-medium text-accent">
      Featured
    </span>
  );
}

/* ---------- form fields ---------- */

const inputCls =
  "w-full rounded-sm border border-input bg-surface px-3 text-small outline-none transition-colors duration-150 focus:border-foreground disabled:opacity-60";

type FieldShell = { label: string; hint?: string | undefined; error?: string | null | undefined; className?: string | undefined };

function Shell({ label, hint, error, className, children }: FieldShell & { children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-small mb-1.5 block font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-caption mt-1 block text-destructive">{error}</span>
      ) : hint ? (
        <span className="text-caption mt-1 block text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({ label, hint, error, className, ...props }: FieldShell & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell label={label} hint={hint} error={error} className={className}>
      <input className={cn(inputCls, "h-10", error && "border-destructive")} {...props} />
    </Shell>
  );
}

export function TextArea({ label, hint, error, className, ...props }: FieldShell & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell label={label} hint={hint} error={error} className={className}>
      <textarea className={cn(inputCls, "min-h-24 py-2", error && "border-destructive")} {...props} />
    </Shell>
  );
}

export function SelectInput({
  label,
  hint,
  error,
  className,
  options,
  ...props
}: FieldShell & React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <Shell label={label} hint={hint} error={error} className={className}>
      <select className={cn(inputCls, "h-10")} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Shell>
  );
}

export function CheckboxInput({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
      <span>
        <span className="text-small block font-medium">{label}</span>
        {hint && <span className="text-caption block text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export const MEDIA_TYPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "vimeo", label: "Vimeo" },
];

/* ---------- buttons ---------- */

export function AdminButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  const v = {
    primary: "bg-foreground text-background hover:bg-foreground/85",
    secondary: "border border-input bg-surface hover:border-foreground",
    ghost: "hover:bg-muted",
    danger: "border border-destructive/40 text-destructive hover:bg-destructive/5",
  }[variant];
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "text-caption h-8 px-2.5" : "text-small h-10 px-4",
        v,
        className,
      )}
      {...props}
    />
  );
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveBar({ state, dirty, error, onSave, label = "Save" }: {
  state: SaveState;
  dirty: boolean;
  error?: string | null;
  onSave?: () => void;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-6 py-3 md:-mx-10 md:px-10">
      <AdminButton type={onSave ? "button" : "submit"} onClick={onSave} variant="primary" disabled={state === "saving"}>
        {state === "saving" && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {state === "saving" ? "Saving…" : label}
      </AdminButton>
      <span className="text-caption" role="status" aria-live="polite">
        {state === "saved" && !dirty && (
          <span className="inline-flex items-center gap-1 text-foreground"><Check className="size-3.5 text-accent" aria-hidden /> Saved</span>
        )}
        {state === "error" && error && <span className="text-destructive">{error}</span>}
        {dirty && state !== "saving" && state !== "error" && <span className="text-muted-foreground">Unsaved changes</span>}
      </span>
    </div>
  );
}

export function ConfirmButton({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  children,
  variant = "danger",
  size = "sm",
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  variant?: "danger" | "ghost" | "secondary";
  size?: "sm" | "md";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <AdminButton variant={variant} size={size}>{children}</AdminButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Tracks a form object and whether it differs from the last saved snapshot. */
export function useFormState<T>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [saved, setSaved] = useState<string>(JSON.stringify(initial));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== saved;
  useEffect(() => {
    if (dirty && state === "saved") setState("idle");
  }, [dirty, state]);
  return {
    values,
    set: <K extends keyof T>(k: K, v: T[K]) => setValues((p) => ({ ...p, [k]: v })),
    setAll: setValues,
    dirty,
    state,
    error,
    markSaved: (v: T) => {
      setValues(v);
      setSaved(JSON.stringify(v));
      setState("saved");
      setError(null);
    },
    begin: () => {
      setState("saving");
      setError(null);
    },
    fail: (msg: string) => {
      setState("error");
      setError(msg);
    },
  };
}

/** Returns a copy of the array with items i and j swapped. */
export function swapped<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  const a = next[i], b = next[j];
  if (a === undefined || b === undefined) return next;
  next[i] = b;
  next[j] = a;
  return next;
}
