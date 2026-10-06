import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Circle, AlertTriangle } from "lucide-react";
import { adminHead } from "@/lib/supabase/cms";
import { AdminButton, Panel } from "@/components/admin/cms";
import { PricingPage, StatCard } from "@/components/admin/pricing/PricingKit";
import { publishReadiness, type AdminPricing } from "@/lib/pricing/admin";

export const Route = createFileRoute("/control-centre/_admin/pricing/")({
  head: () => adminHead("Pricing"),
  component: () => (
    <PricingPage title="AI Video Pricing" description="Configure video types, AI models, per-second rates, tiers and add-ons. Nothing here is public until you publish it and enable public pricing.">
      {(d) => <Overview d={d} />}
    </PricingPage>
  ),
});

function Overview({ d }: { d: AdminPricing }) {
  const liveModelIds = new Set(d.models.filter((m) => m.published && m.available).map((m) => m.id));
  const liveTypeIds = new Set(d.videoTypes.filter((v) => v.published).map((v) => v.id));
  const publishedRates = d.rates.filter((r) => r.enabled && liveModelIds.has(r.ai_model_id) && liveTypeIds.has(r.video_type_id)).length;
  const anyPublished = liveTypeIds.size + liveModelIds.size + d.tiers.filter((t) => t.published).length + d.addons.filter((a) => a.published).length > 0;
  const { errors, warnings } = publishReadiness(d);
  const allMinimumsSet = d.videoTypes.length > 0 && d.videoTypes.every((v) => Number(v.minimum_project_price) > 0);

  const checklist: [string, boolean, string][] = [
    ["Video types configured", d.videoTypes.length > 0, "/control-centre/pricing/video-types"],
    ["AI models configured", d.models.some((m) => m.available), "/control-centre/pricing/ai-models"],
    ["Per-second rates configured", d.rates.some((r) => r.enabled), "/control-centre/pricing/rates"],
    ["Minimum prices reviewed", allMinimumsSet, "/control-centre/pricing/video-types"],
    ["Add-ons configured", d.addons.some((a) => a.enabled), "/control-centre/pricing/addons"],
    ["Pricing settings reviewed", d.settingsSaved, "/control-centre/pricing/settings"],
    ["Public pricing enabled", d.settings.enabled && d.settings.public_visible, "/control-centre/pricing/settings"],
  ];

  return (
    <div className="grid gap-6">
      {!anyPublished && (
        <div className="text-small flex items-start gap-3 rounded-md border border-accent/40 bg-accent/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <p>All pricing is still <strong>unpublished draft</strong>. Visitors can't see any of it. Review the values, then publish items and enable public pricing in Settings.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Video types" value={d.videoTypes.length} sub={`${liveTypeIds.size} published`} />
        <StatCard label="Active AI models" value={d.models.filter((m) => m.available).length} sub={`${liveModelIds.size} published`} />
        <StatCard label="Rate combinations" value={d.rates.length} sub={`${d.rates.filter((r) => r.enabled).length} enabled`} />
        <StatCard label="Published rates" value={publishedRates} sub="Live combinations" />
        <StatCard label="Production tiers" value={d.tiers.length} sub={`${d.tiers.filter((t) => t.published).length} published`} />
        <StatCard label="Active add-ons" value={d.addons.filter((a) => a.enabled).length} sub={`${d.addons.filter((a) => a.published && a.enabled).length} published`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Configuration checklist">
          <ul className="grid gap-2">
            {checklist.map(([label, ok, to]) => (
              <li key={label} className="text-small flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {ok ? <Check className="size-4 text-accent" aria-hidden /> : <Circle className="size-4 text-muted-foreground/50" aria-hidden />}
                  <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
                </span>
                <Link to={to} className="text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Open</Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Publish readiness" description="Checks run against current data. Items publish individually — there is no single atomic price-list release yet.">
          {errors.length === 0 ? <p className="text-small flex items-center gap-2"><Check className="size-4 text-accent" /> Ready to enable public pricing.</p> : (
            <ul className="text-small grid gap-1.5">{errors.map((e) => <li key={e} className="text-destructive">• {e}</li>)}</ul>
          )}
          {warnings.length > 0 && <ul className="text-caption mt-3 grid gap-1 text-muted-foreground">{warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
          <div className="mt-4 flex gap-2">
            <Link to="/control-centre/pricing/simulator"><AdminButton size="sm">Open simulator</AdminButton></Link>
            <Link to="/control-centre/pricing/settings"><AdminButton size="sm" variant="ghost">Settings</AdminButton></Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
