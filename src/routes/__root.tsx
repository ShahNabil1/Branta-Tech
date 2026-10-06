import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteShell } from "@/components/layout/SiteShell";

function NotFoundComponent() {
  return (
    <SiteShell>
      <section className="flex min-h-[70vh] items-center bg-background px-6 py-24">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-caption uppercase tracking-[0.2em] text-muted-foreground">404</p>
          <h1 className="text-h1 mt-4 text-foreground">This page doesn't exist.</h1>
          <p className="text-body mt-4 text-muted-foreground">It may have moved, or the link may be out of date.</p>
          <div className="mt-8 flex flex-wrap gap-6">
            <Link to="/" className="text-body underline underline-offset-4">Back to home</Link>
            <Link to="/work" className="text-body underline underline-offset-4">See our work</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Branta Tech" },
      { name: "description", content: "Branta Tech — Creative. AI. Technology." },
      { name: "author", content: "Branta Tech" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preload",
        href: "/fonts/geist-latin-variable.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (import.meta.env.DEV) {
      void import("@/lib/supabase/dev-health-check").then((m) => m.runSupabaseDevHealthCheck());
    }
  }, []);

  // Single auth listener: re-run route guards on identity changes.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      void import("@/integrations/supabase/client").then(({ supabase }) => {
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
          void router.invalidate();
          if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
        });
        unsub = () => data.subscription.unsubscribe();
      });
    };
    const storedSession = Object.keys(window.localStorage).some((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));
    if (storedSession) start();
    else {
      window.addEventListener("pointerdown", start, { once: true, passive: true });
      window.addEventListener("keydown", start, { once: true });
    }
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      unsub?.();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
