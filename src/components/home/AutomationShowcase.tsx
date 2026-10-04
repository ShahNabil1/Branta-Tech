import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DarkSection, Eyebrow, SiteContainer } from "@/components/layout/primitives";
import { HeroAction } from "@/components/home/Hero";
import type { Automation } from "@/lib/automation.functions";
import type { FlowNode, NodeKind } from "@/lib/automation";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<NodeKind, string> = { input: "Input", ai: "AI", system: "System", action: "Action", result: "Result" };
const STEP_MS = 1600;
const COLS = 3;

/** Desktop snake layout: row 0 left→right, row 1 right→left, … */
function place(i: number) {
  const row = Math.floor(i / COLS);
  const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  return { row, col };
}

function Connector({ dir, lit }: { dir: "right" | "left" | "down"; lit: boolean }) {
  const horiz = dir !== "down";
  return (
    <span
      aria-hidden
      className={cn(
        "absolute overflow-hidden bg-border",
        dir === "right" && "left-full top-1/2 h-px w-[var(--gap)] -translate-y-1/2",
        dir === "left" && "right-full top-1/2 h-px w-[var(--gap)] -translate-y-1/2",
        dir === "down" && "left-1/2 top-full h-[var(--gap)] w-px -translate-x-1/2",
      )}
    >
      <span
        className={cn(
          "absolute inset-0 bg-accent transition-transform duration-700 ease-out motion-reduce:transition-none",
          horiz ? (dir === "right" ? "origin-left" : "origin-right") : "origin-top",
          lit ? "scale-100" : horiz ? "scale-x-0" : "scale-y-0",
        )}
      />
    </span>
  );
}

function Node({ n, i, state }: { n: FlowNode; i: number; state: "idle" | "active" | "done" }) {
  return (
    <div
      className={cn(
        "relative flex min-h-[88px] flex-col justify-between rounded-[6px] border bg-foreground/[0.03] p-4 transition-colors duration-500",
        state === "active" ? "border-accent/70" : state === "done" ? "border-foreground/25" : "border-border",
      )}
    >
      <span className="text-caption flex items-center justify-between font-mono uppercase tracking-wider text-muted-foreground">
        <span>{String(i + 1).padStart(2, "0")} · {KIND_LABEL[n.kind]}</span>
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors duration-500",
            state === "active" ? "bg-accent motion-safe:animate-pulse" : state === "done" ? "bg-foreground/60" : "bg-foreground/15",
          )}
        />
      </span>
      <span className="text-small mt-3 font-medium text-foreground">{n.label}</span>
    </div>
  );
}

function Workflow({ nodes, caseKey }: { nodes: FlowNode[]; caseKey: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduce, setReduce] = useState(false);
  const total = nodes.length;

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.25 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => setStep(0), [caseKey]);

  useEffect(() => {
    if (reduce || !visible) return;
    // steps 0..total-1 activate nodes, total = complete (held for two beats), then restart
    const t = setTimeout(() => setStep((s) => (s >= total + 1 ? 0 : s + 1)), step >= total ? STEP_MS * 1.5 : STEP_MS);
    return () => clearTimeout(t);
  }, [step, visible, reduce, total]);

  const cur = reduce ? total : step;
  const state = (i: number) => (i < cur ? "done" : i === cur ? "active" : "idle") as "idle" | "active" | "done";
  const rows = Math.ceil(total / COLS);
  const complete = cur >= total;

  return (
    <div ref={box} className="relative rounded-[8px] border border-border bg-foreground/[0.02] p-5 md:p-8">
      <div className="text-caption mb-6 flex items-center justify-between font-mono uppercase tracking-wider text-muted-foreground">
        <span>Workflow</span>
        <span aria-live="polite" className={cn("transition-colors duration-500", complete && "text-accent")}>
          {complete ? "Completed" : `Running · ${Math.min(cur + 1, total)}/${total}`}
        </span>
      </div>

      {/* Desktop: snake grid */}
      <ol
        key={`d-${caseKey}`}
        className="animate-fade-in hidden gap-[var(--gap)] [--gap:2.5rem] md:grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(COLS, total)}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}
      >
        {nodes.map((n, i) => {
          const p = place(i);
          const next = i < total - 1 ? place(i + 1) : null;
          const dir = next ? (next.row !== p.row ? "down" : next.col > p.col ? "right" : "left") : null;
          return (
            <li key={i} className="relative" style={{ gridColumn: p.col + 1, gridRow: p.row + 1 }}>
              <Node n={n} i={i} state={state(i)} />
              {dir && <Connector dir={dir} lit={i < cur} />}
            </li>
          );
        })}
      </ol>

      {/* Mobile: vertical list */}
      <ol key={`m-${caseKey}`} className="animate-fade-in grid gap-[var(--gap)] [--gap:1.25rem] md:hidden">
        {nodes.map((n, i) => (
          <li key={i} className="relative">
            <Node n={n} i={i} state={state(i)} />
            {i < total - 1 && <Connector dir="down" lit={i < cur} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AutomationShowcase({ content }: { content: NonNullable<Automation> }) {
  const [active, setActive] = useState(content.default_key);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const uc = content.use_cases.find((u) => u.key === active) ?? content.use_cases[0]!;
  const idx = content.use_cases.indexOf(uc);

  const onKey = (e: KeyboardEvent) => {
    const n = content.use_cases.length;
    let j = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (idx + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (idx - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    else return;
    e.preventDefault();
    setActive(content.use_cases[j]!.key);
    tabs.current[j]?.focus();
  };

  const cta = <HeroAction label={content.ctaLabel} url={content.ctaUrl} variant="secondary" />;

  return (
    <DarkSection aria-labelledby="automation-title">
      <SiteContainer>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-5">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h2 id="automation-title" className="text-display mt-4 whitespace-pre-line text-foreground">{content.title}</h2>
            {content.body && <p className="text-body-lg mt-6 max-w-md text-muted-foreground">{content.body}</p>}

            <div
              role="tablist"
              aria-label="Automation use cases"
              onKeyDown={onKey}
              className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:border-t lg:border-border"
            >
              {content.use_cases.map((u, i) => {
                const on = u.key === uc.key;
                return (
                  <button
                    key={u.key}
                    ref={(el) => { tabs.current[i] = el; }}
                    role="tab"
                    id={`auto-tab-${u.key}`}
                    aria-selected={on}
                    aria-controls="auto-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setActive(u.key)}
                    className={cn(
                      "text-eyebrow shrink-0 whitespace-nowrap rounded-full border px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      "lg:flex lg:items-center lg:justify-between lg:rounded-none lg:border-0 lg:border-b lg:border-border lg:px-0 lg:py-4 lg:text-left",
                      on ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{u.label}</span>
                    <span aria-hidden className={cn("hidden h-1.5 w-1.5 rounded-full lg:block", on ? "bg-accent" : "bg-transparent")} />
                  </button>
                );
              })}
            </div>

            <div className="mt-10 hidden lg:block">{cta}</div>
          </div>

          <div id="auto-panel" role="tabpanel" aria-labelledby={`auto-tab-${uc.key}`} className="min-w-0 lg:col-span-7">
            <div key={uc.key} className="animate-fade-in mb-6">
              {uc.description && <p className="text-body-lg text-foreground">{uc.description}</p>}
              <p className="sr-only">Workflow steps: {uc.nodes.map((n) => n.label).join(", then ")}.</p>
            </div>
            <Workflow nodes={uc.nodes} caseKey={uc.key} />
            {uc.outcome && (
              <p key={`o-${uc.key}`} className="text-small animate-fade-in mt-4 text-muted-foreground">
                <span className="text-accent">Outcome · </span>{uc.outcome}
              </p>
            )}
          </div>
        </div>

        {content.outcomes.length > 0 && (
          <ul aria-label="Automation outcomes" className="text-eyebrow mt-16 flex flex-wrap gap-x-3 gap-y-2 border-t border-border pt-8 text-muted-foreground">
            {content.outcomes.map((o, i) => (
              <li key={o} className="flex items-center gap-3">
                <span>{o}</span>
                {i < content.outcomes.length - 1 && <span aria-hidden className="text-accent">·</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 lg:hidden">{cta}</div>
      </SiteContainer>
    </DarkSection>
  );
}
