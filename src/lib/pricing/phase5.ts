/**
 * Pure helpers for quotation integrations (follow-ups, expiry, CRM linking, booking
 * preselection, templates, analytics, PDF model, staff access). No I/O — shared by
 * server functions, admin screens and tests.
 */

/* ---------- Dates ---------- */
/** Calendar date (YYYY-MM-DD) in Dhaka — the business day used for validity and follow-ups. */
export const businessToday = (now = new Date()) => new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 10);

/* ---------- Follow-ups ---------- */
export type FollowUpStatus = "none" | "pending" | "done";
export type FollowUpBucket = "due_today" | "overdue" | "upcoming" | "completed" | "unscheduled";
export const FOLLOW_UP_FILTERS: [FollowUpBucket, string][] = [["due_today", "Due today"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["completed", "Completed"]];

export function followUpBucket(r: { follow_up_status: string; follow_up_at: string | null }, today: string): FollowUpBucket {
  if (r.follow_up_status === "done") return "completed";
  if (r.follow_up_status !== "pending" || !r.follow_up_at) return "unscheduled";
  if (r.follow_up_at === today) return "due_today";
  return r.follow_up_at < today ? "overdue" : "upcoming";
}

/* ---------- Expiry ---------- */
type VersionLike = { status: string; customer_response: string | null; valid_until: string | null };
/** An issued, unanswered version past its validity date. Answered versions never expire retroactively. */
export const isVersionExpired = (v: VersionLike, today: string) =>
  v.status === "issued" && !v.customer_response && !!v.valid_until && v.valid_until < today;
/** Only a request still waiting on the customer ("quoted") moves to expired. */
export const shouldMarkRequestExpired = (requestStatus: string, v: VersionLike, today: string) =>
  requestStatus === "quoted" && isVersionExpired(v, today);

/* ---------- CRM linking ---------- */
type LeadLike = { id: string; client_user_id: string | null; email: string; created_at: string };
/**
 * Auto-link a quote request to an existing lead ONLY through a verified account id.
 * A matching email alone is never enough (it is unverified input); staff can link manually.
 */
export function autoLeadLink(verifiedUserId: string | null, leads: LeadLike[]): string | null {
  if (!verifiedUserId) return null;
  const own = leads.filter((l) => l.client_user_id === verifiedUserId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return own[0]?.id ?? null;
}
/** Leads staff may consider for a manual link: same account, or same email shown as an unverified suggestion. */
export function leadSuggestions<L extends LeadLike>(q: { requester_user_id: string | null; customer_email: string }, leads: L[]) {
  const email = q.customer_email.trim().toLowerCase();
  return leads
    .map((l) => ({ ...l, match: q.requester_user_id && l.client_user_id === q.requester_user_id ? ("account" as const) : l.email.trim().toLowerCase() === email ? ("email_unverified" as const) : null }))
    .filter((l): l is L & { match: "account" | "email_unverified" } => l.match !== null);
}

/* ---------- Booking from a quote ---------- */
export const QUOTE_REF_RE = /^Q-[0-9A-F]{10}$/;
type Group = { slug: string; services: { slug: string; id: string }[] };
/** Preselect only services that are currently published (present in the public booking groups). */
export function bookingPreselect(groups: Group[], want: { group?: string | null | undefined; service?: string | null | undefined }) {
  const group = groups.find((g) => (want.service && g.services.some((s) => s.slug === want.service)) || g.slug === want.group);
  if (!group) return { group: null, service: null };
  const service = want.service ? group.services.find((s) => s.slug === want.service) ?? null : null;
  return { group: group.slug, service: service?.slug ?? null };
}
const norm = (v: string) => v.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const CAT_HINT = { video: /\b(video|film|motion|commercial|tvc|ovc|ugc|cinematic)\b/, photography: /\b(photo|photography|image|imagery|visual|shoot)\b/ } as const;
/**
 * Maps a calculator selection to a published booking category/service by name (never creates one).
 * Service: exact name match on the selected kind, else a service whose name mentions the category; group: the service's group, else a group whose name matches the category.
 */
export function calculatorPreselect(groups: Group[], intent: "video" | "photography" | null | undefined, kind?: string | null) {
  if (!intent) return { group: null, service: null };
  const hint = CAT_HINT[intent];
  const real = groups.filter((g) => g.slug && g.slug !== "general");
  const all = real.flatMap((g) => g.services.filter((s) => s.slug).map((s) => ({ g, s })));
  const k = kind ? norm(kind) : "";
  const hit = (k && (all.find(({ s }) => norm(s.name ?? "") === k) ?? all.find(({ s }) => { const n = norm(s.name ?? ""); return n.includes(k) || (n.length > 3 && k.includes(n)); })))
    || (() => { const inGroup = real.find((g) => hint.test(norm(g.name ?? ""))); return inGroup ? null : all.find(({ s }) => hint.test(norm(s.name ?? ""))); })();
  if (hit) return { group: hit.g.slug, service: hit.s.slug };
  const g = real.find((x) => hint.test(norm(x.name ?? "")));
  return { group: g?.slug ?? null, service: g && g.services.length === 1 ? g.services[0]!.slug : null };
}

/** A booking may reference a quote when the caller is its verified owner or uses the same contact email. */
export function mayLinkBookingToQuote(q: { requester_user_id: string | null; customer_email: string }, b: { userId: string | null; email: string }) {
  if (q.requester_user_id && b.userId === q.requester_user_id) return true;
  return q.customer_email.trim().toLowerCase() === b.email.trim().toLowerCase();
}

/* ---------- Templates ---------- */
export type ChargePreset = { label: string; quantity: number; unit_minor: number };
export type QuoteTemplate = {
  status: string; scope: string | null; deliverables: string | null; revisions: number | null;
  delivery_timeline: string | null; payment_terms: string | null; conditions: string | null; charge_presets: unknown;
};
export type TemplateDraft = { scope: string; deliverables: string; revisions: string; delivery_timeline: string; payment_terms: string; customer_notes: string; lines: { label: string; quantity: string; unit: string }[] };

export function parsePresets(v: unknown): ChargePreset[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p) => {
    const o = p as Record<string, unknown>;
    const label = typeof o["label"] === "string" ? o["label"].trim() : "";
    const quantity = Number(o["quantity"] ?? 1), unit = Number(o["unit_minor"]);
    return label && Number.isFinite(unit) && unit >= 0 && Number.isFinite(quantity) && quantity > 0 ? [{ label, quantity, unit_minor: Math.round(unit) }] : [];
  });
}
/** Approved templates only. Fills empty fields, appends conditions and charge presets; never overwrites staff text. */
export function applyTemplate(d: TemplateDraft, t: QuoteTemplate): TemplateDraft {
  if (t.status !== "approved") throw new Error("Only approved templates can be applied.");
  const fill = (cur: string, v: string | null) => (cur.trim() ? cur : v?.trim() ?? cur);
  const notes = t.conditions?.trim() && !d.customer_notes.includes(t.conditions.trim()) ? [d.customer_notes.trim(), t.conditions.trim()].filter(Boolean).join("\n\n") : d.customer_notes;
  return {
    ...d,
    scope: fill(d.scope, t.scope), deliverables: fill(d.deliverables, t.deliverables),
    revisions: d.revisions !== "" ? d.revisions : t.revisions != null ? String(t.revisions) : "",
    delivery_timeline: fill(d.delivery_timeline, t.delivery_timeline), payment_terms: fill(d.payment_terms, t.payment_terms),
    customer_notes: notes,
    lines: [...d.lines, ...parsePresets(t.charge_presets).map((p) => ({ label: p.label, quantity: String(p.quantity), unit: String(p.unit_minor / 100) }))],
  };
}

/* ---------- Analytics ---------- */
type AReq = { status: string; video_type_id: string | null; ai_model_id: string | null; created_at: string };
type AVer = { quote_id: string; status: string; customer_response: string | null; total_minor: number };
export function pricingAnalytics(input: { requests: AReq[]; versions: AVer[]; calculatorStarts: number; since?: string }) {
  const reqs = input.since ? input.requests.filter((r) => r.created_at >= input.since!) : input.requests;
  const issuedQuotes = new Set(input.versions.filter((v) => v.status !== "draft").map((v) => v.quote_id));
  const answered = input.versions.filter((v) => v.status !== "draft" && v.customer_response);
  const accepted = answered.filter((v) => v.customer_response === "accepted");
  const declined = answered.filter((v) => v.customer_response === "declined");
  const tally = (key: "video_type_id" | "ai_model_id") => {
    const m = new Map<string, number>();
    for (const r of reqs) if (r[key]) m.set(r[key]!, (m.get(r[key]!) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
  return {
    calculatorStarts: input.calculatorStarts, quoteRequests: reqs.length, issued: issuedQuotes.size,
    accepted: accepted.length, declined: declined.length,
    averageAcceptedMinor: accepted.length ? Math.round(accepted.reduce((t, v) => t + Number(v.total_minor), 0) / accepted.length) : null,
    topVideoTypes: tally("video_type_id"), topModels: tally("ai_model_id"),
    // Calculator starts are only tracked from launch; this rate is null until any are recorded.
    startToRequest: rate(reqs.filter((r) => r.status !== "custom_quote_requested").length, input.calculatorStarts),
    issuedToAccepted: rate(accepted.length, issuedQuotes.size),
  };
}

/* ---------- Staff access (mirrors private.is_sales_admin / is_cms_admin) ---------- */
export const SALES_ROLES = ["super_admin", "admin", "sales"] as const;
export const canManageQuotes = (roles: string[]) => roles.some((r) => (SALES_ROLES as readonly string[]).includes(r));
export const canManagePricing = (roles: string[]) => roles.some((r) => r === "super_admin" || r === "admin");

/* ---------- PDF model ---------- */
export type PdfQuote = {
  reference: string; version: number; issuedAt: string; validUntil: string | null;
  customer: { name: string; company: string | null; email: string };
  production: { videoType: string | null; model: string | null; tier: string | null; durationSeconds: number | null; addons: string[] };
  /** Photography specs (only for photography quotes); video fields are then empty. */
  photoSpecs?: string[] | null;
  lines: { label: string; quantity: number; unit_minor: number; amount_minor: number }[];
  subtotal: number; discount: number; tax: { label: string; percentage: number; inclusive: boolean; amount: number } | null; total: number; currency: string;
  scope: string | null; deliverables: string | null; revisions: number | null; timeline: string | null; paymentTerms: string | null; notes: string | null;
  company: { name: string; email: string | null; phone: string | null };
};
type VersionRow = {
  version: number; status: string; issued_at: string | null; created_at: string; valid_until: string | null; line_items: unknown;
  subtotal_minor: number; discount_minor: number; tax_label: string; tax_percentage: number; tax_inclusive: boolean; tax_minor: number; total_minor: number; currency: string;
  scope: string | null; deliverables: string | null; revisions: number | null; delivery_timeline: string | null; payment_terms: string | null; customer_notes: string | null;
};
type SnapQuote = { videoType: { name: string }; model: { name: string }; tier: { name: string }; addonLines: { name: string }[] } | PhotoSnap | null | undefined;
type PhotoSnap = { category: "photography"; item: { name: string }; mode: string; workflow: { name: string }; products: number; imagesPerProduct: number; totalImages: number; views: { name: string }[]; bulk: { percentage: number } | null; addonLines: { name: string }[] };

/** Customer-facing photography spec lines from a saved snapshot (+ free-text specs). Only relevant fields. */
export function photoSpecLines(snap: PhotoSnap | null | undefined, specs?: string | null): string[] {
  const out: string[] = [];
  if (snap) {
    out.push(`${snap.mode === "package" ? "Package" : "Photography category"}: ${snap.item.name}`, `Image workflow: ${snap.workflow.name}`,
      `Products: ${snap.products}`, `Images per product: ${snap.imagesPerProduct}`, `Total images: ${snap.totalImages}`);
    if (snap.views.length) out.push(`Views: ${snap.views.map((v) => v.name).join(", ")}`);
    if (snap.bulk) out.push(`Bulk discount: ${snap.bulk.percentage}%`);
    if (snap.addonLines.length) out.push(`Extras: ${snap.addonLines.map((l) => l.name).join(", ")}`);
  } else out.push("Custom photography");
  if (specs) out.push(`Product specifications: ${specs}`);
  return out;
}
const isPhotoSnap = (s: SnapQuote): s is PhotoSnap => !!s && (s as PhotoSnap).category === "photography";
/**
 * Builds the PDF content strictly from a SAVED, non-draft version (its stored totals — never current rates).
 * Only customer-facing fields are copied; internal notes are not part of the input type.
 */
export function pdfFromVersion(v: VersionRow, q: { public_reference: string; customer_name: string; company_name: string | null; customer_email: string; duration_seconds: number | null; category?: string | null; photo_selection?: unknown }, snapIn: SnapQuote, company: PdfQuote["company"]): PdfQuote {
  const photo = q.category === "photography" || isPhotoSnap(snapIn);
  const snap = photo || isPhotoSnap(snapIn) ? null : snapIn;
  if (v.status === "draft") throw new Error("Drafts can't be exported. Issue the version first.");
  const lines = (Array.isArray(v.line_items) ? v.line_items : []) as { label: string; quantity: number; unit_minor: number }[];
  return {
    reference: q.public_reference, version: v.version, issuedAt: v.issued_at ?? v.created_at, validUntil: v.valid_until,
    customer: { name: q.customer_name, company: q.company_name, email: q.customer_email },
    production: { videoType: snap?.videoType.name ?? null, model: snap?.model.name ?? null, tier: snap?.tier.name ?? null, durationSeconds: photo ? null : q.duration_seconds, addons: snap?.addonLines.map((l) => l.name) ?? [] },
    photoSpecs: photo ? photoSpecLines(isPhotoSnap(snapIn) ? snapIn : null, (q.photo_selection as { specs?: string } | null)?.specs ?? null) : null,
    lines: lines.map((l) => ({ label: String(l.label), quantity: Number(l.quantity), unit_minor: Number(l.unit_minor), amount_minor: Math.round(Number(l.unit_minor) * Number(l.quantity)) })),
    subtotal: Number(v.subtotal_minor), discount: Number(v.discount_minor),
    tax: Number(v.tax_percentage) > 0 ? { label: v.tax_label, percentage: Number(v.tax_percentage), inclusive: v.tax_inclusive, amount: Number(v.tax_minor) } : null,
    total: Number(v.total_minor), currency: v.currency,
    scope: v.scope, deliverables: v.deliverables, revisions: v.revisions, timeline: v.delivery_timeline, paymentTerms: v.payment_terms, notes: v.customer_notes,
    company,
  };
}
/** PDF-safe money (standard PDF fonts have no ৳ glyph). */
export const pdfMoney = (minor: number, cur: string) => `${cur} ${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
