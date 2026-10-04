import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteContainer } from "./primitives";
import { ButtonLink } from "@/components/ui/brand-button";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-h4 font-semibold tracking-tight" aria-label="Branta Tech home">
      <span aria-hidden className="grid size-7 place-items-center rounded-sm bg-foreground text-caption font-bold text-background">
        B
      </span>
      Branta<span className="text-muted-foreground">Tech</span>
    </Link>
  );
}

function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <SiteContainer wide className="flex h-16 items-center justify-between">
        <Logo />
        <ButtonLink to="/" size="sm" arrow>
          Book a call
        </ButtonLink>
      </SiteContainer>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="dark bg-background py-12 text-foreground">
      <SiteContainer wide className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <Logo />
        <p className="text-caption text-muted-foreground">© {new Date().getFullYear()} Branta Tech. Creative. AI. Technology.</p>
      </SiteContainer>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
