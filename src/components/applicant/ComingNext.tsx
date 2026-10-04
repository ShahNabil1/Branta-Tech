import { Link } from "@tanstack/react-router";

export function AccountTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-h2 text-foreground">{title}</h1>
      {intro && <p className="text-body mt-3 text-muted-foreground">{intro}</p>}
    </div>
  );
}

export function ComingNext({ title, text }: { title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <AccountTitle title={title} />
      <div className="rounded-sm border border-border bg-surface p-6 md:p-8">
        <p className="text-eyebrow text-accent">COMING NEXT</p>
        <p className="text-body mt-3 text-foreground">{text}</p>
        <Link to="/careers/account/profile" className="text-small mt-5 inline-block underline underline-offset-4">Complete your profile meanwhile</Link>
      </div>
    </div>
  );
}
