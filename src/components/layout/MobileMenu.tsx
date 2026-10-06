import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NavEntry } from "@/lib/navigation";

type MobileMenuProps = {
  id: string;
  open: boolean;
  nav: NavEntry[];
  logo: ReactNode;
  account: ReactNode;
  booking: ReactNode;
  active: (entry: NavEntry) => boolean;
  renderLink: (url: string, label: ReactNode, className: string, pendingClassName: string) => ReactNode;
  onClose: () => void;
};

export default function MobileMenu({ id, open, nav, logo, account, booking, active, renderLink, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <MobileMenuPanel id={id} nav={nav} logo={logo} account={account} booking={booking} active={active} renderLink={renderLink} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}

function MobileMenuPanel({ id, nav, logo, account, booking, active, renderLink, onClose }: Omit<MobileMenuProps, "open">) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const prev = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (scrollbar > 0) document.body.style.paddingRight = `${currentPadding + scrollbar}px`;
    requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.paddingRight = prev.paddingRight;
      document.body.style.overscrollBehavior = prev.overscrollBehavior;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const links = nav.filter((entry) => entry.kind === "link");
  const groups = nav.filter((entry) => entry.kind !== "link");
  const row = "text-h4 flex min-h-14 w-full cursor-pointer items-center justify-between border-b border-border py-3 text-left font-medium";
  const duration = reduceMotion ? 0 : 0.46;
  const ease = [0.22, 1, 0.36, 1] as const;
  const item = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 14 },
    visible: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.28, ease } },
  };
  const panel = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : -18, scale: reduceMotion ? 1 : 0.992 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration, ease, when: "beforeChildren" as const, staggerChildren: reduceMotion ? 0 : 0.02, delayChildren: reduceMotion ? 0 : 0.03 } },
    exit: { opacity: 0, y: reduceMotion ? 0 : -12, scale: reduceMotion ? 1 : 0.994, transition: { duration: reduceMotion ? 0 : 0.3, ease } },
  };

  return (
    <motion.div id={id} role="dialog" aria-modal="true" aria-label="Site menu" initial="hidden" animate="visible" exit="exit" variants={panel}
      className="dark fixed inset-0 z-[100] flex h-[100dvh] min-h-0 w-full origin-top flex-col overflow-hidden bg-background text-foreground will-change-transform">
      <motion.div variants={item} className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
        {logo}
        <button ref={closeRef} type="button" onClick={onClose} className="text-small flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-2 font-medium transition-colors hover:text-accent">
          <motion.span animate={{ rotate: 90 }} transition={{ duration: reduceMotion ? 0 : 0.42, ease }} className="flex"><X className="size-5" aria-hidden /></motion.span> Close
        </button>
      </motion.div>
      <nav aria-label="Mobile" className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 pb-6">
        <ul>
          {links.map((entry) => (
            <motion.li key={entry.id} variants={item}>
              {renderLink(entry.url, entry.label, `${row}${active(entry) ? " text-accent" : ""}`, "cursor-default text-muted-foreground/50")}
            </motion.li>
          ))}
          {groups.map((entry) => {
            const expandedNow = expanded === entry.id;
            const subId = `${id}-${entry.id}`;
            const sub = entry.kind === "mega" ? entry.columns.map((column) => ({ label: column.title, url: column.url ?? "#" })) : entry.columns.flatMap((column) => column.links);
            return (
              <motion.li key={entry.id} variants={item}>
                <button type="button" className={row} aria-expanded={expandedNow} aria-controls={subId} onClick={() => setExpanded(expandedNow ? null : entry.id)}>
                  {entry.label}
                  <motion.span animate={{ rotate: expandedNow ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.3, ease }} className="flex text-muted-foreground"><ChevronDown aria-hidden className="size-5" /></motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {expandedNow && (
                    <motion.ul id={subId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: reduceMotion ? 0 : 0.38, ease }, opacity: { duration: reduceMotion ? 0 : 0.22 } }} className="overflow-hidden border-b border-border">
                      <div className="py-2">
                        {sub.map((link) => <li key={link.label}>{renderLink(link.url, link.label, "text-body flex min-h-11 items-center text-muted-foreground hover:text-foreground", "cursor-default opacity-60")}</li>)}
                        {entry.kind === "mega" && <li>{renderLink(entry.url, "View all", "text-body flex min-h-11 items-center font-medium text-foreground", "cursor-default opacity-50")}</li>}
                      </div>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </nav>
      <motion.div variants={item} className="shrink-0 border-t border-border bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <p className="text-eyebrow mb-3 text-muted-foreground">Account</p>
        <div className="mb-4 grid grid-cols-2 gap-2">{account}</div>
        {booking}
      </motion.div>
    </motion.div>
  );
}