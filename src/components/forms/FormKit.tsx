import type { ReactNode } from "react";

export const fieldCls = "w-full rounded-sm border border-input bg-surface px-3 text-body text-foreground outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring";
export const inputCls = `${fieldCls} h-11`;

export function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-small mb-1.5 block font-medium text-foreground">
        {label}
        {required ? <span aria-hidden className="text-accent"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {children}
      {error ? <p id={`${id}-err`} className="text-caption mt-1 text-destructive">{error}</p> : hint ? <p className="text-caption mt-1 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const aria = (errs: Record<string, string>, k: string) => ({ "aria-invalid": !!errs[k] || undefined, "aria-describedby": errs[k] ? `${k}-err` : undefined });

export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "text-small rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive" : "text-small rounded-sm border border-border bg-muted px-3 py-2 text-foreground"}>
      {children}
    </p>
  );
}

/** Hidden field bots fill in; humans never see it. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>Leave empty<input name="hp_field" tabIndex={-1} autoComplete="off" /></label>
    </div>
  );
}
