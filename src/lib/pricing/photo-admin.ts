/** Control Centre photography pricing + rate proposals (browser client, RLS: private.is_cms_admin()). */
import { supabase } from "@/integrations/supabase/client";
import { must, getSettingsGroup, saveSettingsGroup } from "@/lib/supabase/cms";
import type { Tables } from "@/integrations/supabase/types";
import { DEFAULT_PHOTO_SETTINGS, type PhotoConfig, type PhotoSettings } from "./photo-engine";

export type PhotoCategoryRow = Tables<"pricing_photo_categories">;
export type PhotoViewRow = Tables<"pricing_photo_views">;
export type PhotoPackageRow = Tables<"pricing_photo_packages">;
export type PhotoAddonRow = Tables<"pricing_photo_addons">;
export type PhotoBulkRow = Tables<"pricing_photo_bulk_tiers">;
export type ProposalRow = Tables<"pricing_rate_proposals">;
export type PhotoSettingsStored = Omit<PhotoSettings, "tax">;

export const PHOTO_KEY = ["cms", "pricing-photo"] as const;

export type AdminPhoto = {
  categories: PhotoCategoryRow[]; views: PhotoViewRow[]; packages: PhotoPackageRow[];
  packageViews: { package_id: string; view_id: string; position: number }[];
  addons: PhotoAddonRow[]; bulkTiers: PhotoBulkRow[]; settings: PhotoSettingsStored;
};

export async function loadAdminPhoto(): Promise<AdminPhoto> {
  const [categories, views, packages, packageViews, addons, bulkTiers, raw] = await Promise.all([
    must(supabase.from("pricing_photo_categories").select("*").order("sort_order")),
    must(supabase.from("pricing_photo_views").select("*").order("sort_order")),
    must(supabase.from("pricing_photo_packages").select("*").order("sort_order")),
    must(supabase.from("pricing_photo_package_views").select("package_id,view_id,position").order("position")),
    must(supabase.from("pricing_photo_addons").select("*").order("sort_order")),
    must(supabase.from("pricing_photo_bulk_tiers").select("*").order("min_products")),
    getSettingsGroup<Partial<PhotoSettingsStored>>("pricing_photo"),
  ]);
  const { tax: _t, ...defaults } = DEFAULT_PHOTO_SETTINGS;
  return { categories, views, packages, packageViews, addons, bulkTiers, settings: { ...defaults, ...(raw ?? {}) } };
}
export const savePhotoSettings = (s: PhotoSettingsStored) => saveSettingsGroup("pricing_photo", s);

const n = (v: unknown) => (v == null ? null : Number(v));
/** Admin rows → engine config (drafts included; use mode "admin" to preview). */
export function toPhotoEngineConfig(d: AdminPhoto, tax: PhotoSettings["tax"]): PhotoConfig {
  return {
    settings: { ...d.settings, tax },
    categories: d.categories.map((c) => ({ ...c, price_per_image: n(c.price_per_image) })),
    views: d.views.map((v) => ({ ...v, applies_to: v.applies_to as "all" })),
    packages: d.packages.map((p) => ({ ...p, price_per_product: n(p.price_per_product), view_ids: d.packageViews.filter((x) => x.package_id === p.id).map((x) => x.view_id) })),
    addons: d.addons.map((a) => ({ ...a, charge_type: a.charge_type as "fixed", amount: n(a.amount), percentage: n(a.percentage) })),
    bulkTiers: d.bulkTiers.map((t) => ({ ...t, discount_percentage: n(t.discount_percentage) })),
  };
}

/** Pre-publish checks for photography. */
export function photoReadiness(d: AdminPhoto) {
  const errors: string[] = [], warnings: string[] = [];
  const pubCats = d.categories.filter((c) => c.published), pubPk = d.packages.filter((p) => p.published);
  if (!pubCats.length && !pubPk.length) errors.push("Publish at least one photography category or package.");
  for (const c of pubCats) if (c.price_per_image == null) errors.push(`${c.name} is published without a per-image price.`);
  for (const p of pubPk) {
    if (p.price_per_product == null) errors.push(`${p.name} is published without a price.`);
    const vs = d.packageViews.filter((x) => x.package_id === p.id);
    if (vs.length !== p.image_count) warnings.push(`${p.name}: ${p.image_count} images but ${vs.length} views listed.`);
    if (vs.some((x) => !d.views.find((v) => v.id === x.view_id)?.published)) warnings.push(`${p.name} includes unpublished views (they're hidden publicly).`);
  }
  const pt = d.bulkTiers.filter((t) => t.published).sort((a, b) => a.min_products - b.min_products);
  for (let i = 1; i < pt.length; i++) {
    const prev = pt[i - 1]!;
    if (prev.max_products == null || prev.max_products >= pt[i]!.min_products) errors.push(`Bulk tiers overlap around ${pt[i]!.min_products} products.`);
  }
  if (d.settings.workflows.length < 1) errors.push("Add at least one image workflow.");
  if (!d.settings.enabled) warnings.push("Photography pricing switch is off — the public calculator shows a custom-quote card.");
  if (d.settings.minimum_order_enabled === false) warnings.push("Minimum order is not applied yet.");
  return { errors, warnings };
}

export async function loadProposals() {
  return must(supabase.from("pricing_rate_proposals").select("*").order("status").order("label"));
}

/** Applies one approved proposal to its target row (still unpublished), then records the decision. */
export async function decideProposal(p: ProposalRow, approve: boolean) {
  const { data: u } = await supabase.auth.getUser();
  if (approve) {
    const res = p.target_table === "pricing_model_rates"
      ? await supabase.from("pricing_model_rates").update({ selling_rate_per_second: p.proposed_value }).eq("id", p.target_id)
      : await supabase.from("pricing_video_types").update(p.field === "base_creative_fee" ? { base_creative_fee: p.proposed_value } : { minimum_project_price: p.proposed_value }).eq("id", p.target_id);
    if (res.error) throw res.error;
  }
  await must(supabase.from("pricing_rate_proposals").update({ status: approve ? "approved" : "rejected", decided_at: new Date().toISOString(), decided_by: u.user?.id ?? null }).eq("id", p.id));
}
