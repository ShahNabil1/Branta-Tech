import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/brand-button";
import { calculateQuote, PricingError, type PricingConfig, type Quote } from "@/lib/pricing/engine";
import type { PublicPricing } from "@/lib/pricing.functions";
import { cn } from "@/lib/utils";

const money = (minor: number, cur: string) => `${cur === "BDT" ? "৳" : `${cur} `}${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Smoothly tweens a number; jumps instantly under reduced motion. */
function useTween(target: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); from.current = target; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 350), e = 1 - Math.pow(1 - k, 3);
      const n = Math.round(a + (target - a) * e);
      setV(n); from.current = n;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export function PricingCalculator({ data }: { data: PublicPricing }) {
  if (!data.active) return <Unpriced />;
  return <Calculator config={data.config} defaults={data.defaults} desc={data.descriptions} disclaimer={data.disclaimer} />;
}

function Unpriced() {
  return (
    <div className="mx-auto max-w-2xl rounded-[8px] border border-border bg-[var(--white)] p-8 text-center md:p-12">
      <p className="text-eyebrow text-accent">CUSTOM PRICING</p>
      <h3 className="text-h3 mt-4 text-foreground">Custom pricing is available.</h3>
      <p className="text-body-lg mt-4 text-muted-foreground">Tell us about your project and our team will prepare a quote.</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/book-a-call" className={buttonVariants({ variant: "primary", size: "lg" })}>Book a Call</Link>
        <Link to="/start-a-project" className={buttonVariants({ variant: "secondary", size: "lg" })}>Request a Quote</Link>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <legend className="contents">
        <span className="flex items-baseline gap-3">
          <span className="text-caption font-mono text-accent">{String(n).padStart(2, "0")}</span>
          <span className="text-h4 font-medium text-foreground">{title}</span>
        </span>
      </legend>
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}

function Choice({ selected, onClick, title, meta, desc }: { selected: boolean; onClick: () => void; title: string; meta?: string | undefined; desc?: string | undefined }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={cn("relative flex min-h-16 w-full flex-col items-start rounded-[6px] border bg-[var(--white)] px-4 py-3 text-left transition-[border-color,box-shadow] duration-200",
        selected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border hover:border-foreground/40")}>
      <span className={cn("absolute right-3 top-3 size-2 rounded-full transition-colors", selected ? "bg-accent" : "bg-border")} aria-hidden />
      <span className="text-small pr-5 font-medium text-foreground">{title}</span>
      {meta && <span className="text-caption mt-0.5 text-muted-foreground">{meta}</span>}
      {desc && <span className="text-caption mt-1.5 line-clamp-2 text-muted-foreground">{desc}</span>}
    </button>
  );
}

function Calculator({ config, defaults, desc, disclaimer }: { config: PricingConfig; defaults: Extract<PublicPricing, { active: true }>["defaults"]; desc: Record<string, string>; disclaimer: string }) {
  const s = config.settings;
  const cur = s.currency;
  const live = (vt: string) => config.models.filter((m) => config.rates.some((r) => r.video_type_id === vt && r.ai_model_id === m.id && r.enabled));
  const types = config.videoTypes.filter((v) => live(v.id).length > 0);
  const tiers = [...config.tiers].sort((a, b) => a.multiplier - b.multiplier);
  const bySlug = <T extends { id: string; slug: string }>(rows: T[], slug: string | null) => rows.find((r) => r.slug === slug)?.id ?? rows[0]?.id ?? "";

  const [vt, setVt] = useState(() => bySlug(types, defaults.videoType));
  const models = live(vt);
  const [modelPick, setModel] = useState(() => bySlug(live(bySlug(types, defaults.videoType)), defaults.model));
  // Revalidate model whenever video type changes: keep if still valid, else default/first.
  const model = models.some((m) => m.id === modelPick) ? modelPick : bySlug(models, defaults.model);
  const [tier, setTier] = useState(() => bySlug(config.tiers, defaults.tier));
  const valid = (d: number) => d >= s.min_duration && d <= s.max_duration && (d - s.min_duration) % s.duration_step === 0;
  const snap = (d: number) => Math.min(s.max_duration, Math.max(s.min_duration, s.min_duration + Math.round((d - s.min_duration) / s.duration_step) * s.duration_step));
  const [dur, setDur] = useState(() => snap(30));
  const [durText, setDurText] = useState(String(snap(30)));
  const presets = [5, 10, 15, 30, 45, 60].filter(valid);
  const [picked, setPicked] = useState<Record<string, string>>({}); // addonId → scene count text ("" for non-scene)
  const addons = config.addons.filter((a) => !a.video_type_ids.length || a.video_type_ids.includes(vt));
  const [sheet, setSheet] = useState(false);

  const result = useMemo((): { quote: Quote } | { error: string } => {
    const chosen = addons.filter((a) => a.id in picked);
    const missing = chosen.find((a) => a.charge_type === "per_scene" && !(Number(picked[a.id]) > 0));
    if (missing) return { error: `Enter the number of scenes for ${missing.name}.` };
    try {
      return { quote: calculateQuote(config, { videoTypeId: vt, modelId: model, tierId: tier, durationSeconds: dur,
        addons: chosen.map((a) => (a.charge_type === "per_scene" ? { id: a.id, scenes: Number(picked[a.id]) } : { id: a.id })) }, "public") };
    } catch (e) { return { error: e instanceof PricingError ? e.message : "This combination can't be priced." }; }
  }, [config, vt, model, tier, dur, picked, addons]);

  const fromPrice = (typeId: string) => {
    const ms = live(typeId), t = tiers[0];
    if (!t) return null;
    const totals = ms.map((m) => { try { return calculateQuote(config, { videoTypeId: typeId, modelId: m.id, tierId: t.id, durationSeconds: s.min_duration }, "public").total; } catch { return null; } }).filter((x): x is number => x != null);
    return totals.length ? Math.min(...totals) : null;
  };

  const q = "quote" in result ? result.quote : null;
  const shown = useTween(q?.total ?? 0);
  const brief = q ? [
    "Estimate from the Branta pricing calculator:",
    `Video type: ${q.videoType.name}`, `AI model: ${q.model.name}`, `Duration: ${q.durationSeconds} seconds`, `Production tier: ${q.tier.name}`,
    `Add-ons: ${q.addonLines.length ? q.addonLines.map((l) => l.name + (l.chargeType === "per_scene" ? ` (${l.quantity} scenes)` : "")).join(", ") : "None"}`,
    `Estimated total: ${money(q.total, cur)} (estimate, to be confirmed)`, "", "About my project: ",
  ].join("\n") : undefined;

  const Line = ({ l, v }: { l: string; v: string }) => <div className="text-small flex justify-between gap-4 py-1"><span className="text-muted-foreground">{l}</span><span className="text-right tabular-nums text-foreground">{v}</span></div>;
  const breakdown = q && (
    <div className="divide-y divide-border">
      <div className="pb-3">
        <Line l="Base creative fee" v={money(q.baseFee, cur)} />
        <Line l={`${q.model.name} · ${money(q.ratePerSecond, cur)}/sec × ${q.durationSeconds}s`} v="" />
        <Line l={`Production (${q.tier.name} ${q.tier.multiplier.toFixed(2)}×)`} v={money(q.variableSubtotal, cur)} />
        {q.addonLines.map((l) => <Line key={l.addonId} l={l.name + (l.chargeType === "per_scene" ? ` × ${l.quantity}` : l.chargeType === "percentage" ? ` (${l.quantity}%)` : "")} v={money(l.amount, cur)} />)}
        {q.minimumAdjustment > 0 && <Line l="Minimum project adjustment" v={`+ ${money(q.minimumAdjustment, cur)}`} />}
        {q.roundingAdjustment > 0 && <Line l="Rounding" v={`+ ${money(q.roundingAdjustment, cur)}`} />}
        {q.tax && <Line l={`${q.tax.label} ${q.tax.percentage}%${q.tax.inclusive ? " (included)" : ""}`} v={money(q.tax.amount, cur)} />}
      </div>
    </div>
  );
  const actions = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Link to="/start-a-project" search={{ brief }} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full justify-center", !q && "pointer-events-none opacity-50")} aria-disabled={!q}>Request This Quote</Link>
      <Link to="/book-a-call" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full justify-center")}>Book a Call</Link>
    </div>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
      <div className="min-w-0 pb-24 lg:pb-0">
        <Step n={1} title="What are you creating?">
          <div role="radiogroup" aria-label="Video type" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {types.map((v) => { const f = fromPrice(v.id); return <Choice key={v.id} selected={vt === v.id} onClick={() => setVt(v.id)} title={v.name} meta={f != null ? `From ${money(f, cur)}` : undefined} desc={desc[v.id]} />; })}
          </div>
        </Step>
        <Step n={2} title="Choose your AI production model.">
          <div role="radiogroup" aria-label="AI model" className="grid gap-3 sm:grid-cols-3">
            {models.map((m) => { const r = config.rates.find((x) => x.video_type_id === vt && x.ai_model_id === m.id); return <Choice key={m.id} selected={model === m.id} onClick={() => setModel(m.id)} title={m.name} meta={r ? `${money(Math.round(r.selling_rate_per_second * 100), cur)} / sec` : undefined} desc={desc[m.id]} />; })}
          </div>
        </Step>
        <Step n={3} title="How long should your video be?">
          <div className="flex flex-wrap items-center gap-4">
            <input type="range" aria-label="Duration in seconds" min={s.min_duration} max={s.max_duration} step={s.duration_step} value={dur}
              onChange={(e) => { const d = Number(e.target.value); setDur(d); setDurText(String(d)); }}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]" />
            <label className="text-small flex items-center gap-2 text-muted-foreground">
              <input inputMode="numeric" type="number" min={s.min_duration} max={s.max_duration} step={s.duration_step} value={durText}
                onChange={(e) => { setDurText(e.target.value); const d = Number(e.target.value); if (valid(d)) setDur(d); }}
                onBlur={() => { const d = snap(Number(durText) || s.min_duration); setDur(d); setDurText(String(d)); }}
                className="h-11 w-20 rounded-[6px] border border-border bg-[var(--white)] px-3 text-right tabular-nums text-foreground outline-none focus:border-foreground" aria-label="Seconds" />
              sec
            </label>
          </div>
          {presets.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {presets.map((p) => <button key={p} type="button" onClick={() => { setDur(p); setDurText(String(p)); }}
                className={cn("text-small h-10 rounded-full border px-4 transition-colors", dur === p ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-foreground/40")}>{p} sec</button>)}
            </div>
          )}
          <p className="text-caption mt-3 text-muted-foreground">{s.min_duration}–{s.max_duration} seconds, in {s.duration_step}-second steps.</p>
        </Step>
        <Step n={4} title="Choose your production level.">
          <div role="radiogroup" aria-label="Production tier" className="grid gap-3 sm:grid-cols-3">
            {config.tiers.map((t) => <Choice key={t.id} selected={tier === t.id} onClick={() => setTier(t.id)} title={t.name} meta={`${t.multiplier.toFixed(2)}× production`} desc={desc[t.id]} />)}
          </div>
          <p className="text-caption mt-3 text-muted-foreground">The multiplier applies to the production cost (duration × per-second rate), not the base creative fee or add-ons.</p>
        </Step>
        {addons.length > 0 && (
          <Step n={5} title="Customize your production.">
            <ul className="divide-y divide-border rounded-[6px] border border-border bg-[var(--white)]">
              {addons.map((a) => {
                const on = a.id in picked;
                const rule = a.charge_type === "percentage" ? `+${a.percentage}% of production total` : `${money(Math.round((a.amount ?? 0) * 100), cur)}${a.charge_type === "per_second" ? " / sec" : a.charge_type === "per_scene" ? " / scene" : ""}`;
                return (
                  <li key={a.id} className="px-4 py-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={on} className="size-5 accent-[var(--accent)]"
                        onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[a.id] = ""; else delete n[a.id]; return n; })} />
                      <span className="min-w-0 flex-1">
                        <span className="text-small block font-medium text-foreground">{a.name}</span>
                        {desc[a.id] && <span className="text-caption block text-muted-foreground">{desc[a.id]}</span>}
                      </span>
                      <span className="text-caption shrink-0 tabular-nums text-muted-foreground">{rule}</span>
                    </label>
                    {on && a.charge_type === "per_scene" && (
                      <label className="text-small mt-2 flex items-center gap-2 pl-8 text-muted-foreground">
                        Number of scenes
                        <input inputMode="numeric" type="number" min={1} max={500} value={picked[a.id]} required
                          onChange={(e) => setPicked((p) => ({ ...p, [a.id]: e.target.value }))}
                          className="h-10 w-20 rounded-[6px] border border-border bg-[var(--white)] px-3 tabular-nums text-foreground outline-none focus:border-foreground" />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </Step>
        )}
      </div>

      {/* Desktop sticky summary */}
      <aside aria-label="Your estimate" className="hidden lg:block">
        <div className="dark sticky top-24 rounded-[8px] border border-border bg-background p-6 text-foreground">
          <Summary q={q} err={"error" in result ? result.error : null} shown={shown} cur={cur} />
          <div className="mt-5">{breakdown}</div>
          <div className="mt-5">{actions}</div>
          {disclaimer && <p className="text-caption mt-4 text-muted-foreground">{disclaimer}</p>}
        </div>
      </aside>

      {/* Mobile compact bar + expandable breakdown */}
      <div className="dark fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background text-foreground lg:hidden">
        {sheet && (
          <div className="max-h-[60vh] overflow-y-auto border-b border-border px-[var(--gutter)] py-4">
            {breakdown}
            <div className="mt-4">{actions}</div>
            {disclaimer && <p className="text-caption mt-3 text-muted-foreground">{disclaimer}</p>}
          </div>
        )}
        <button type="button" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} className="flex w-full items-center justify-between gap-3 px-[var(--gutter)] py-3">
          <span className="text-left">
            <span className="text-caption block text-muted-foreground">Estimated price</span>
            <span className="text-h4 block tabular-nums">{q ? money(shown, cur) : "—"}</span>
          </span>
          <span className="text-small flex items-center gap-1 text-muted-foreground">{sheet ? "Hide" : "Breakdown"}<ChevronUp className={cn("size-4 transition-transform", !sheet && "rotate-180")} /></span>
        </button>
      </div>
    </div>
  );
}

function Summary({ q, err, shown, cur }: { q: Quote | null; err: string | null; shown: number; cur: string }) {
  return (
    <div>
      <p className="text-eyebrow text-muted-foreground">YOUR PRODUCTION</p>
      {q && <p className="text-small mt-3 text-foreground">{q.videoType.name} · {q.model.name} · {q.durationSeconds}s · {q.tier.name}</p>}
      <p className="text-caption mt-6 text-muted-foreground">Estimated price</p>
      {q ? <p className="text-display mt-1 tabular-nums text-foreground" aria-live="polite">{money(shown, cur)}</p>
        : <p className="text-small mt-2 text-muted-foreground" role="status">{err}</p>}
    </div>
  );
}
