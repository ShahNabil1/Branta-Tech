import { describe, expect, it } from "vitest";
import {
  applyTemplate, autoLeadLink, bookingPreselect, businessToday, canManagePricing, canManageQuotes, followUpBucket,
  isVersionExpired, leadSuggestions, mayLinkBookingToQuote, pdfFromVersion, pricingAnalytics, shouldMarkRequestExpired, type TemplateDraft,
} from "./phase5";

const version = {
  version: 2, status: "issued", issued_at: "2026-10-01T10:00:00Z", created_at: "2026-10-01T09:00:00Z", valid_until: "2026-10-20",
  line_items: [{ label: "Production", quantity: 2, unit_minor: 150000 }], subtotal_minor: 300000, discount_minor: 30000,
  tax_label: "VAT", tax_percentage: 15, tax_inclusive: false, tax_minor: 40500, total_minor: 310500, currency: "BDT",
  scope: "Scope", deliverables: "1 video", revisions: 2, delivery_timeline: "10 days", payment_terms: "50% upfront", customer_notes: null,
};
const req = { public_reference: "Q-ABCDEF1234", customer_name: "A", company_name: null, customer_email: "a@x.com", duration_seconds: 30 };
const company = { name: "Branta Tech", email: null, phone: null };

describe("PDF version integrity", () => {
  it("uses stored totals, never recomputes from current rates", () => {
    const d = pdfFromVersion(version, req, null, company);
    expect(d.total).toBe(310500); expect(d.discount).toBe(30000); expect(d.lines[0]!.amount_minor).toBe(300000);
    expect(d.tax?.amount).toBe(40500); expect(d.version).toBe(2);
  });
  it("refuses drafts and carries no internal fields", () => {
    expect(() => pdfFromVersion({ ...version, status: "draft" }, req, null, company)).toThrow();
    const d = pdfFromVersion({ ...version, internal_notes: "secret" } as never, req, null, company);
    expect(JSON.stringify(d)).not.toContain("secret");
  });
});

describe("historical immutability", () => {
  it("snapshot names come from the saved estimate, not current config", () => {
    const d = pdfFromVersion(version, req, { videoType: { name: "Old name" }, model: { name: "M" }, tier: { name: "T" }, addonLines: [] }, company);
    expect(d.production.videoType).toBe("Old name");
  });
});

describe("CRM linking", () => {
  const leads = [
    { id: "l1", client_user_id: "u1", email: "a@x.com", created_at: "2026-01-01" },
    { id: "l2", client_user_id: null, email: "a@x.com", created_at: "2026-02-01" },
    { id: "l3", client_user_id: "u1", email: "other@x.com", created_at: "2026-03-01" },
  ];
  it("auto-links only via verified account (latest)", () => { expect(autoLeadLink("u1", leads)).toBe("l3"); });
  it("never auto-links by email alone", () => { expect(autoLeadLink(null, leads)).toBeNull(); expect(autoLeadLink("u9", leads)).toBeNull(); });
  it("marks email-only matches as unverified suggestions", () => {
    const s = leadSuggestions({ requester_user_id: null, customer_email: "A@x.com" }, leads);
    expect(s.map((x) => [x.id, x.match])).toEqual([["l1", "email_unverified"], ["l2", "email_unverified"]]);
  });
});

describe("booking preselection", () => {
  const groups = [{ slug: "ai", services: [{ slug: "ai-commercial", id: "s1" }] }];
  it("preselects only published services", () => {
    expect(bookingPreselect(groups, { service: "ai-commercial" })).toEqual({ group: "ai", service: "ai-commercial" });
    expect(bookingPreselect(groups, { service: "draft-service", group: "nope" })).toEqual({ group: null, service: null });
  });
  it("links a booking only for the quote owner", () => {
    const q = { requester_user_id: "u1", customer_email: "a@x.com" };
    expect(mayLinkBookingToQuote(q, { userId: "u1", email: "z@z.com" })).toBe(true);
    expect(mayLinkBookingToQuote(q, { userId: null, email: "A@X.com" })).toBe(true);
    expect(mayLinkBookingToQuote(q, { userId: "u2", email: "b@x.com" })).toBe(false);
  });
});

describe("template application", () => {
  const draft: TemplateDraft = { scope: "Mine", deliverables: "", revisions: "", delivery_timeline: "", payment_terms: "", customer_notes: "", lines: [] };
  const tpl = { status: "approved", scope: "T scope", deliverables: "T del", revisions: 2, delivery_timeline: "7 days", payment_terms: "T pay", conditions: "Cond", charge_presets: [{ label: "Voice", quantity: 1, unit_minor: 500000 }, { label: "" }] };
  it("fills empty fields, keeps staff text, appends presets", () => {
    const r = applyTemplate(draft, tpl);
    expect(r.scope).toBe("Mine"); expect(r.deliverables).toBe("T del"); expect(r.revisions).toBe("2");
    expect(r.customer_notes).toBe("Cond"); expect(r.lines).toEqual([{ label: "Voice", quantity: "1", unit: "5000" }]);
  });
  it("rejects draft templates", () => { expect(() => applyTemplate(draft, { ...tpl, status: "draft" })).toThrow(); });
});

describe("quote expiry", () => {
  const v = { status: "issued", customer_response: null, valid_until: "2026-10-05" };
  it("expires unanswered issued versions after validity", () => {
    expect(isVersionExpired(v, "2026-10-06")).toBe(true);
    expect(isVersionExpired(v, "2026-10-05")).toBe(false);
  });
  it("never expires accepted quotes retroactively", () => {
    expect(isVersionExpired({ ...v, customer_response: "accepted" }, "2027-01-01")).toBe(false);
    expect(shouldMarkRequestExpired("accepted", v, "2027-01-01")).toBe(false);
    expect(shouldMarkRequestExpired("quoted", v, "2027-01-01")).toBe(true);
  });
  it("uses the Dhaka business day", () => { expect(businessToday(new Date("2026-10-05T19:00:00Z"))).toBe("2026-10-06"); });
});

describe("follow-up status", () => {
  const t = "2026-10-06";
  it("buckets correctly", () => {
    expect(followUpBucket({ follow_up_status: "pending", follow_up_at: t }, t)).toBe("due_today");
    expect(followUpBucket({ follow_up_status: "pending", follow_up_at: "2026-10-01" }, t)).toBe("overdue");
    expect(followUpBucket({ follow_up_status: "pending", follow_up_at: "2026-10-09" }, t)).toBe("upcoming");
    expect(followUpBucket({ follow_up_status: "done", follow_up_at: "2026-10-01" }, t)).toBe("completed");
    expect(followUpBucket({ follow_up_status: "none", follow_up_at: null }, t)).toBe("unscheduled");
  });
});

describe("pricing analytics", () => {
  it("computes real counts and only real rates", () => {
    const s = pricingAnalytics({
      calculatorStarts: 0,
      requests: [{ status: "new", video_type_id: "v1", ai_model_id: "m1", created_at: "x" }, { status: "custom_quote_requested", video_type_id: null, ai_model_id: null, created_at: "x" }],
      versions: [{ quote_id: "a", status: "issued", customer_response: "accepted", total_minor: 1000 }, { quote_id: "b", status: "superseded", customer_response: "declined", total_minor: 0 }, { quote_id: "c", status: "draft", customer_response: null, total_minor: 9 }],
    });
    expect(s).toMatchObject({ quoteRequests: 2, issued: 2, accepted: 1, declined: 1, averageAcceptedMinor: 1000, startToRequest: null, issuedToAccepted: 50 });
    expect(s.topVideoTypes).toEqual([["v1", 1]]);
  });
});

describe("staff authorization", () => {
  it("matches database role helpers", () => {
    expect(canManageQuotes(["hr"])).toBe(false);
    expect(canManageQuotes(["sales"])).toBe(true);
    expect(canManagePricing(["sales"])).toBe(false);
    expect(canManagePricing(["admin"])).toBe(true);
    expect(canManageQuotes(["client"])).toBe(false);
  });
});

import { calculatorPreselect } from "./phase5";
describe("calculatorPreselect", () => {
  const groups = [
    { id: "1", name: "AI Video Production", slug: "ai-video", services: [{ id: "a", name: "AI UGC", slug: "ai-ugc" }, { id: "b", name: "AI Commercial", slug: "ai-commercial" }] },
    { id: "2", name: "AI Product Photography", slug: "ai-photo", services: [{ id: "c", name: "Fashion Photography", slug: "fashion-photo" }] },
  ] as never;
  it("matches service by kind", () => expect(calculatorPreselect(groups, "video", "AI UGC")).toEqual({ group: "ai-video", service: "ai-ugc" }));
  it("falls back to category group only", () => expect(calculatorPreselect(groups, "video", "AI TVC")).toEqual({ group: "ai-video", service: null }));
  it("single-service group preselects it", () => expect(calculatorPreselect(groups, "photography", "Unknown")).toEqual({ group: "ai-photo", service: "fashion-photo" }));
  it("no match leaves selector empty", () => {
    const g = [{ id: "9", name: "Web & Software", slug: "web", services: [{ id: "x", name: "Websites", slug: "websites" }] }] as never;
    expect(calculatorPreselect(g, "photography", "Flat-lay")).toEqual({ group: null, service: null });
  });
});
