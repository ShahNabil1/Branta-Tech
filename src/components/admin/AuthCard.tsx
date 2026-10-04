import type { ReactNode } from "react";

export function AuthCard({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2">
          <span aria-hidden className="grid size-7 place-items-center rounded-sm bg-foreground text-caption font-bold text-background">
            B
          </span>
          <span className="text-small font-semibold">Branta Control Centre</span>
        </div>
        <h1 className="text-h3">{title}</h1>
        {intro && <p className="text-small mt-2 text-muted-foreground">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-small mb-1.5 block font-medium">{label}</span>
      <input
        className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-body outline-none transition-colors duration-200 focus:border-foreground"
        {...props}
      />
    </label>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "text-small rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive"
          : "text-small rounded-sm border border-border bg-muted px-3 py-2"
      }
    >
      {children}
    </p>
  );
}
