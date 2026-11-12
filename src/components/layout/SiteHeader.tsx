import { BRANTA_LIGHT_LOGO, resolveBrantaMedia } from "@/lib/brand-media";
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useHydrated, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { displayName, useClientSession } from "@/lib/client-session";
import { ArrowUpRight, ChevronDown, Menu } from "lucide-react";
import { FALLBACK_NAV, navFromCms, safeImage, siteChromeQuery, type NavEntry, type NavLink } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const MobileMenu = lazy(() => import("./MobileMenu"));

/* ---------------- link resolution ---------------- */

type Resolved = { kind: "internal"; to: string; hash?: string } | { kind: "external"; href: string } | { kind: "pending" };

function useResolveLink() {
  const router = useRouter();
  const { data: chrome } = useQuery(siteChromeQuery);
  // Before hydration both server and browser treat /services/* as live (no mismatch); afterwards drafts go inactive.
  const hydrated = useHydrated();
  const slugs = hydrated ? chrome?.serviceSlugs : undefined;
  return useCallback(
    (url: string | undefined): Resolved => {
      const v = (url ?? "").trim();
      if (!v || v === "#") return { kind: "pending" };
      if (v.startsWith("/") && !v.startsWith("//")) {
        const [rawPath = "/", hash] = v.split("#");
        const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
        const svc = /^\/services\/([a-z0-9-]+)$/.exec(path);
        const exists = svc ? (slugs ? slugs.includes(svc[1]!) : true) : Boolean((router.routesByPath as unknown as Record<string, unknown>)[path]);
        if (svc && exists) return { kind: "internal", to: path, ...(hash ? { hash } : {}) };
        return exists ? { kind: "internal", to: path, ...(hash ? { hash } : {}) } : { kind: "pending" };
      }
      try {
        const u = new URL(v);
        if (["https:", "http:", "mailto:", "tel:"].includes(u.protocol)) return { kind: "external", href: v };
      } catch {
        /* invalid */
      }
      return { kind: "pending" };
    },
    [router, slugs],
  );
}

export function SmartLink({ url, className, pendingClassName, children, onNavigate, ...rest }: {
  url: string | undefined;
  className?: string;
  pendingClassName?: string;
  children: ReactNode;
  onNavigate?: () => void;
  "aria-current"?: "page";
}) {
  const r = useResolveLink()(url);
  if (r.kind === "internal")
    return (
      <Link to={r.to as "/"} {...(r.hash ? { hash: r.hash } : {})} className={className} onClick={onNavigate} {...rest}>
        {children}
      </Link>
    );
  if (r.kind === "external")
    return (
      <a href={r.href} className={className} onClick={onNavigate} {...(r.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  return (
    <span aria-disabled="true" title="Coming soon" className={cn(className, pendingClassName ?? "cursor-not-allowed opacity-45")}>
      {children}
    </span>
  );
}

/* ---------------- data ---------------- */

function useChrome() {
  const { data } = useQuery(siteChromeQuery);
  const nav = navFromCms(data?.navigation) ?? FALLBACK_NAV;
  const logo = safeImage(data?.brand?.logo_dark_url) ?? safeImage(data?.brand?.logo_url);
  const email = typeof data?.contact?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.email) ? data.contact.email : null;
  return { nav, logo, email, featured: data?.featured ?? null };
}

/** Book a call → /book-a-call, else /contact, else contact email, else pending. */
function useBookingUrl(email: string | null) {
  const resolve = useResolveLink();
  if (resolve("/book-a-call").kind === "internal") return "/book-a-call";
  if (resolve("/contact").kind === "internal") return "/contact";
  return email ? `mailto:${email}` : "#";
}

export function BrandLogo({ src, onNavigate }: { src: string | null; onNavigate?: () => void }) {
  return (
    <Link to="/" onClick={onNavigate} aria-label="Branta Tech home" className="flex shrink-0 items-center gap-2 rounded-sm text-foreground">
      <img src={src ? resolveBrantaMedia(src) : BRANTA_LIGHT_LOGO} alt="Branta Tech" width={1288} height={308} className="h-7 w-auto" />
    </Link>
  );
}

function usePathActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (entry: NavEntry) => {
    const urls = [entry.url, ...entry.columns.flatMap((c) => [c.url, ...c.links.map((l) => l.url)])].filter(Boolean) as string[];
    return urls.some((u) => {
      const p = u.split("#")[0] ?? "";
      return p === "/" ? pathname === "/" : !!p && p.startsWith("/") && (pathname === p || pathname.startsWith(`${p}/`));
    });
  };
}

/* ---------------- header ---------------- */

export function SiteHeader() {
  const { nav, logo, email, featured } = useChrome();
  const booking = useBookingUrl(email);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileLoaded, setMobileLoaded] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const headerRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = usePathActive();
  const baseId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on navigation.
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  // Outside click + Escape for desktop panels.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const id = open;
        setOpen(null);
        triggerRefs.current[id]?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hoverAt = useRef(0);
  const hoverOpen = (id: string) => {
    window.clearTimeout(closeTimer.current);
    setOpen((o) => {
      if (o !== id) hoverAt.current = Date.now();
      return id;
    });
  };
  const hoverClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 160);
  };
  const keepOpen = () => window.clearTimeout(closeTimer.current);
  const openEntry = nav.find((n) => n.id === open && n.kind !== "link");

  return (
    <header
      ref={headerRef}
      className={cn(
        "dark sticky top-0 z-50 border-b border-border bg-background text-foreground",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-6 px-5 md:px-8 xl:h-[68px]">
        <BrandLogo src={logo} />

        {/* Desktop nav */}
        <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex" onMouseLeave={hoverClose}>
          <ul className="flex items-center gap-0.5">
            {nav.map((entry) => {
              const active = isActive(entry);
              const itemCls = cn(
                "text-small relative flex h-9 items-center gap-1 rounded-sm px-3 font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                (active || open === entry.id) && "text-foreground",
              );
              const dot = active && <span aria-hidden className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />;
              if (entry.kind === "link")
                return (
                  <li key={entry.id} onMouseEnter={() => setOpen(null)}>
                    <SmartLink url={entry.url} className={itemCls} pendingClassName="cursor-default text-muted-foreground/45 hover:text-muted-foreground/45" {...(active ? { "aria-current": "page" as const } : {})}>
                      {entry.label}
                      {dot}
                    </SmartLink>
                  </li>
                );
              const panelId = `${baseId}-${entry.id}`;
              return (
                <li key={entry.id} onMouseEnter={() => hoverOpen(entry.id)}>
                  <button
                    ref={(el) => {
                      triggerRefs.current[entry.id] = el;
                    }}
                    type="button"
                    aria-expanded={open === entry.id}
                    aria-controls={panelId}
                    onClick={() => {
                      // A click right after hover-open should not immediately close the panel.
                      const recent = Date.now() - hoverAt.current < 500;
                      setOpen((o) => (o === entry.id ? (recent ? o : null) : entry.id));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setOpen(entry.id);
                        requestAnimationFrame(() => document.getElementById(panelId)?.querySelector<HTMLElement>("a,[tabindex]")?.focus());
                      }
                    }}
                    className={itemCls}
                  >
                    {entry.label}
                    <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200", open === entry.id && "rotate-180")} />
                    {dot}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Desktop actions */}
        <div className="ml-auto hidden items-center gap-1 lg:flex">
          <AccountArea />
          <BookButton url={booking} className="ml-2" />
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className="text-small ml-auto flex h-10 items-center gap-2 rounded-sm px-2 font-medium lg:hidden"
          aria-expanded={mobile}
          aria-controls={`${baseId}-mobile`}
          onClick={() => { setMobileLoaded(true); setMobile(true); }}
        >
          <Menu className="size-5" aria-hidden /> Menu
        </button>
      </div>

      {/* Desktop panel */}
      {nav.filter((n) => n.kind !== "link").map((entry) => (
        <div
          key={entry.id}
          id={`${baseId}-${entry.id}`}
          role="region"
          aria-label={`${entry.label} menu`}
          onMouseEnter={keepOpen}
          onMouseLeave={hoverClose}
          className={cn("absolute inset-x-0 top-full hidden border-b border-border bg-[var(--dark-alt)] motion-safe:animate-[nav-in_200ms_var(--ease-out-expo)]", open === entry.id && "lg:block")}
        >
          {entry.kind === "mega" ? (
            <MegaPanel entry={entry} featured={entry.id === nav.find((n) => n.kind === "mega")?.id ? featured : null} onNavigate={() => setOpen(null)} />
          ) : (
            <DropdownPanel entry={entry} onNavigate={() => setOpen(null)} />
          )}
        </div>
      ))}

      {mobileLoaded && typeof document !== "undefined" && createPortal(
        <Suspense fallback={null}>
          <MobileMenu
            id={`${baseId}-mobile`}
            open={mobile}
            nav={nav}
            logo={<BrandLogo src={logo} onNavigate={() => setMobile(false)} />}
            account={<AccountArea mobile onNavigate={() => setMobile(false)} />}
            booking={<BookButton url={booking} large />}
            active={isActive}
            renderLink={(url, label, className, pendingClassName) => (
              <SmartLink url={url} onNavigate={() => setMobile(false)} className={className} pendingClassName={pendingClassName}>{label}</SmartLink>
            )}
            onClose={() => setMobile(false)}
          />
        </Suspense>,
        document.body,
      )}
    </header>
  );
}

/* ---------------- desktop panels ---------------- */

const panelLink =
  "group/link text-small flex items-center gap-1 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none";

function LinkRow({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  return (
    <SmartLink url={link.url} onNavigate={onNavigate} className={panelLink} pendingClassName="cursor-default text-muted-foreground/70 hover:text-muted-foreground/70">
      {link.label}
      <ArrowUpRight aria-hidden className="size-3 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100 group-focus-visible/link:opacity-100" />
    </SmartLink>
  );
}

function MegaPanel({ entry, featured, onNavigate }: { entry: NavEntry; featured: { title: string; slug: string; image: string; category: string | null } | null; onNavigate: () => void }) {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-10 md:px-8 xl:grid-cols-[1fr_18rem]">
      <div className="grid grid-cols-3 divide-x divide-border">
        {entry.columns.map((col) => (
          <div key={col.title} className="px-8 first:pl-0">
            <SmartLink url={col.url} onNavigate={onNavigate} className="text-eyebrow mb-4 inline-flex items-center gap-1 text-foreground hover:text-accent" pendingClassName="cursor-default">
              {col.title}
            </SmartLink>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}><LinkRow link={l} onNavigate={onNavigate} /></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {featured && (
        <SmartLink url={`/work/${featured.slug}`} onNavigate={onNavigate} className="group/feat hidden xl:block" pendingClassName="cursor-default">
          <span className="block aspect-[4/5] overflow-hidden rounded-sm bg-muted">
            <img src={featured.image} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover/feat:scale-[1.03]" />
          </span>
          <span className="text-caption mt-3 block text-muted-foreground">{featured.category ?? "Featured work"}</span>
          <span className="text-small block font-medium">{featured.title}</span>
        </SmartLink>
      )}
      <div className="xl:col-span-2 border-t border-border pt-5">
        <SmartLink url={entry.url} onNavigate={onNavigate} className="text-small inline-flex items-center gap-1 font-medium text-foreground hover:text-accent" pendingClassName="cursor-default text-muted-foreground/70">
          View all {entry.label.toLowerCase()} services <ArrowUpRight aria-hidden className="size-3.5" />
        </SmartLink>
      </div>
    </div>
  );
}

function DropdownPanel({ entry, onNavigate }: { entry: NavEntry; onNavigate: () => void }) {
  const links = entry.columns.flatMap((c) => c.links);
  return (
    <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
      <ul className="grid grid-cols-5 divide-x divide-border">
        {links.map((l) => (
          <li key={l.label} className="px-6 first:pl-0">
            <SmartLink url={l.url} onNavigate={onNavigate} className="group/link block" pendingClassName="cursor-default opacity-60">
              <span className="text-small flex items-center gap-1 font-medium text-foreground">
                {l.label}
                <ArrowUpRight aria-hidden className="size-3 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100" />
              </span>
              {l.description && <span className="text-caption mt-1 block text-muted-foreground">{l.description}</span>}
            </SmartLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- actions ---------------- */

/** Client sign-in / sign-up arrive with the Client Portal phase; shown but inactive. */
function AccountArea({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { ready, user } = useClientSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = "text-small items-center rounded-sm px-3 font-medium text-muted-foreground transition-colors hover:text-foreground";
  const block = "flex h-12 justify-center border border-border text-foreground transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-[0.98] focus-visible:border-accent focus-visible:text-accent";
  async function signOut() {
    onNavigate?.();
    await qc.cancelQueries({ queryKey: ["client"] });
    qc.removeQueries({ queryKey: ["client"] });
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    navigate({ to: "/sign-in", replace: true });
  }
  if (!ready) return mobile ? <div className="col-span-2 h-12" /> : <span className="hidden w-[120px] xl:inline-block" />;
  if (!user) {
    return mobile ? (
      <>
        <Link to="/sign-in" onClick={onNavigate} className={cn(base, block)}>Sign in</Link>
        <Link to="/sign-up" onClick={onNavigate} className={cn(base, block)}>Create account</Link>
      </>
    ) : (
      <>
        <Link to="/sign-in" className={cn(base, "hidden h-9 xl:inline-flex")}>Sign in</Link>
        <Link to="/sign-up" className={cn(base, "hidden h-9 xl:inline-flex")}>Sign up</Link>
      </>
    );
  }
  const name = displayName(user);
  if (mobile) {
    return (
      <>
        <p className="text-small col-span-2 truncate text-foreground">Signed in as {name}</p>
        <Link to="/client" onClick={onNavigate} className={cn(base, block)}>Dashboard</Link>
        <Link to="/client/profile" onClick={onNavigate} className={cn(base, block)}>Profile</Link>
        <button type="button" onClick={signOut} className={cn(base, block, "col-span-2")}>Sign out</button>
      </>
    );
  }
  return (
    <span className="hidden items-center gap-1 xl:inline-flex">
      <Link to="/client" className={cn(base, "inline-flex h-9 gap-2 text-foreground")} title="Client dashboard">
        <span aria-hidden className="grid size-6 place-items-center rounded-full bg-muted text-caption font-semibold uppercase">{name.charAt(0)}</span>
        <span className="max-w-[120px] truncate">Dashboard</span>
      </Link>
      <button type="button" onClick={signOut} className={cn(base, "inline-flex h-9")}>Sign out</button>
    </span>
  );
}

function BookButton({ url, className, large }: { url: string; className?: string; large?: boolean }) {
  return (
    <SmartLink
      url={url}
      className={cn(
        "group/cta inline-flex items-center justify-center gap-1.5 rounded-full bg-accent font-medium text-accent-foreground transition-colors duration-200 hover:bg-foreground hover:text-background",
        large ? "text-body h-14 w-full" : "text-small h-9 px-4",
        className,
      )}
      pendingClassName="cursor-default opacity-60"
    >
      Book a call
      <ArrowUpRight aria-hidden className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
    </SmartLink>
  );
}

