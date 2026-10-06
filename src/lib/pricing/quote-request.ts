/** Validation + server recalculation for public quote requests (pure; used by the server fn and tests). */
import { z } from "zod";
import { calculateQuote, PricingError, type PricingConfig, type Quote } from "./engine";
import { calculatePhotoQuote, type PhotoConfig, type PhotoQuote } from "./photo-engine";

export const WHATSAPP_RE = /^\+?[0-9][0-9\s()-]{6,18}[0-9]$/;

export const QuoteRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  whatsapp: z.string().trim().max(40).refine((v) => WHATSAPP_RE.test(v) && v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15, "Enter a valid WhatsApp number, e.g. +8801XXXXXXXXX"),
  email: z.string().trim().email("Enter a valid email").max(200),
  company: z.string().trim().max(120).default(""),
  description: z.string().trim().max(3000).default(""),
  deadline: z.string().trim().default("").refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Choose a valid date"),
  hp_field: z.string().max(0).optional(),
  started_at: z.number(),
  selection: z.object({
    videoTypeId: z.string().uuid(), modelId: z.string().uuid(), tierId: z.string().uuid(),
    durationSeconds: z.number().int().positive().max(3600),
    addons: z.array(z.object({ id: z.string().uuid(), scenes: z.number().int().positive().max(500).optional() })).max(30).default([]),
  }).nullable().default(null),
  category: z.enum(["video", "photography"]).default("video"),
  photoSelection: z.object({
    mode: z.enum(["individual", "package"]),
    categoryId: z.string().uuid().optional(), packageId: z.string().uuid().optional(),
    workflow: z.string().max(40), products: z.number().int().positive().max(1000),
    imagesPerProduct: z.number().int().positive().max(100).optional(),
    viewIds: z.array(z.string().uuid()).max(30).optional(),
    background: z.string().max(80).optional(), modelRequired: z.boolean().optional(),
    specs: z.string().max(1000).optional(),
    addons: z.array(z.object({ id: z.string().uuid() })).max(30).optional(),
  }).nullable().default(null),
  // Anything the browser claims about price is accepted only to be ignored.
  clientTotal: z.unknown().optional(),
});
export type QuoteRequestInput = z.input<typeof QuoteRequestSchema>;

export type ProcessedQuote =
  | { ok: false; error: string; fields?: Record<string, string> }
  | { ok: true; status: "new" | "custom_quote_requested"; estimate: Quote | null; selection: z.infer<typeof QuoteRequestSchema>["selection"]; data: z.infer<typeof QuoteRequestSchema> };

/**
 * `config` is the PUBLIC configuration (published rows only, enabled only when public pricing is on) or null.
 * - Public pricing active + selection → must price successfully via the engine, else rejected.
 * - Public pricing off → saved as a custom quote request; selection is dropped (draft ids are never stored/priced).
 */
export function processQuoteRequest(raw: unknown, config: PricingConfig | null, now = Date.now()): ProcessedQuote {
  const parsed = QuoteRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    if (fields["hp_field"] || fields["started_at"]) return { ok: false, error: "We couldn't send your request. Please try again." };
    return { ok: false, error: "Please check the highlighted fields.", fields };
  }
  const d = parsed.data;
  if (now - d.started_at < 2000) return { ok: false, error: "That was quick — please review your details and send again." };
  if (d.deadline && Date.parse(d.deadline) < now - 86400_000) return { ok: false, error: "Please check the highlighted fields.", fields: { deadline: "Choose a future date" } };
  const active = !!config?.settings.enabled;
  if (!active || !d.selection) return { ok: true, status: "custom_quote_requested", estimate: null, selection: null, data: d };
  try {
    const estimate = calculateQuote(config, d.selection, "public");
    return { ok: true, status: "new", estimate, selection: d.selection, data: d };
  } catch (e) {
    return { ok: false, error: e instanceof PricingError ? `${e.message} Please adjust your selection.` : "We couldn't price that selection." };
  }
}

export type ProcessedPhotoQuote =
  | { ok: false; error: string; fields?: Record<string, string> }
  | { ok: true; status: "new" | "custom_quote_requested"; estimate: PhotoQuote | null; selection: z.infer<typeof QuoteRequestSchema>["photoSelection"]; data: z.infer<typeof QuoteRequestSchema> };

/** Photography variant: same validation; prices only via the photo engine with the PUBLIC photo config. */
export function processPhotoQuoteRequest(raw: unknown, config: PhotoConfig | null, now = Date.now()): ProcessedPhotoQuote {
  const base = processQuoteRequest(raw, null, now);
  if (!base.ok) return base;
  const d = base.data;
  // 50+ product custom-quote tiers (or pricing off) fall back to a custom request — specs are still kept.
  if (!config?.settings.enabled || !d.photoSelection) return { ok: true, status: "custom_quote_requested", estimate: null, selection: null, data: d };
  try {
    return { ok: true, status: "new", estimate: calculatePhotoQuote(config, d.photoSelection, "public"), selection: d.photoSelection, data: d };
  } catch (e) {
    if (e instanceof PricingError && e.code === "custom_quote_required") return { ok: true, status: "custom_quote_requested", estimate: null, selection: null, data: d };
    return { ok: false, error: e instanceof PricingError ? `${e.message} Please adjust your selection.` : "We couldn't price that selection." };
  }
}
