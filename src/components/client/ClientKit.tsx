import type { ReactNode } from "react";

export function ClientHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1 text-foreground">{title}</h1>
        {intro && <p className="text-body mt-2 text-muted-foreground">{intro}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5 md:p-6">
      {(title || action) && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-h3 text-foreground">{title}</h2>{action}</div>}
      {children}
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="text-caption inline-flex rounded-full border border-border px-2.5 py-0.5 text-foreground">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-body rounded-md border border-dashed border-border p-6 text-muted-foreground">{children}</p>;
}

export function Loading() {
  return <p className="text-small text-muted-foreground">Loading…</p>;
}
export function Failed() {
  return <p role="alert" className="text-small text-destructive">We couldn't load this right now. Please refresh.</p>;
}
