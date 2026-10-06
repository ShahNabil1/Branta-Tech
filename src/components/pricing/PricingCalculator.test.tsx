import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PricingConfig } from "@/lib/pricing/engine";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, search: _s, ...p }: { children: React.ReactNode; to: string; search?: unknown }) => <a href={to} {...p}>{children}</a> }));
import { PricingCalculator } from "./PricingCalculator";

const config: PricingConfig = {
  settings: { enabled: true, currency: "BDT", min_duration: 5, max_duration: 60, duration_step: 5, rounding_increment: 100, tax: { enabled: true, label: "VAT", percentage: 10, inclusive: false } },
  videoTypes: [
    { id: "a", name: "AI Motion", slug: "ai-motion", base_creative_fee: 3500, minimum_project_price: 0, published: true },
    { id: "b", name: "AI TVC", slug: "ai-tvc", base_creative_fee: 20000, minimum_project_price: 45000, published: true },
  ],
  models: [{ id: "s", name: "Seedance", slug: "seedance", available: true, published: true }, { id: "k", name: "Kling", slug: "kling", available: true, published: true }],
  tiers: [{ id: "e", name: "Essential", slug: "essential", multiplier: 1, published: true }, { id: "p", name: "Premium", slug: "premium", multiplier: 1.5, published: true }],
  rates: [
    { id: "1", video_type_id: "a", ai_model_id: "s", selling_rate_per_second: 180, currency: "BDT", enabled: true },
    { id: "2", video_type_id: "a", ai_model_id: "k", selling_rate_per_second: 230, currency: "BDT", enabled: false },
    { id: "3", video_type_id: "b", ai_model_id: "k", selling_rate_per_second: 1000, currency: "BDT", enabled: true },
  ],
  addons: [{ id: "ls", name: "Lip Sync", charge_type: "per_scene", amount: 2000, percentage: null, enabled: true, published: true, video_type_ids: [] }],
};
const renderIt = () => render(<PricingCalculator data={{ active: true, disclaimer: "", config, descriptions: {}, defaults: { videoType: null, model: null, tier: null } }} />);
const totalText = () => screen.getAllByText(/৳/).map((n) => n.textContent).join(" ");

describe("PricingCalculator", () => {
  it("shows unpriced state with no amounts when inactive", () => {
    render(<PricingCalculator data={{ active: false, disclaimer: "" }} />);
    expect(screen.getByText("Custom pricing is available.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/৳/);
  });
  it("hides disabled model combinations and revalidates on type change", () => {
    renderIt();
    expect(screen.queryByRole("radio", { name: /Kling/ })).toBeNull(); // disabled for AI Motion
    fireEvent.click(screen.getByRole("radio", { name: /AI TVC/ }));
    expect(screen.getByRole("radio", { name: /Kling/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("radio", { name: /Seedance/ })).toBeNull();
  });
  it("per-scene add-on requires a quantity", () => {
    renderIt();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getAllByText(/number of scenes/i).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("spinbutton", { name: /number of scenes/i }), { target: { value: "2" } });
    // 30s default: 3500 + 30*180 + 2*2000 = 12900 → +10% VAT = 14190
    expect(totalText()).toContain("৳4,000");
  });
});
