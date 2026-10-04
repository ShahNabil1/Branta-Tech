import type { ReactNode } from "react";
import { SiteContainer } from "./primitives";
import { SiteHeader, BrandLogo } from "./SiteHeader";

function SiteFooter() {
  return (
    <footer className="dark border-t border-border bg-background py-10 text-foreground">
      <SiteContainer wide className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <BrandLogo src={null} />
        <p className="text-caption text-muted-foreground">© {new Date().getFullYear()} Branta Tech</p>
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
