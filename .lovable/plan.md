# AI Pricing System: Video + Product Photography

Adds a photography category to the existing pricing system and loads your proposed video prices as drafts for your approval. Nothing goes public automatically. Everything stays on your own Supabase project, with no Lovable Cloud.

## 1. Video prices (draft proposals, nothing overwritten)
- The three main models become Google Budget / Omni Flash (lowest), Kling (middle) and Seedance Premium (highest). Any other models stay off for the public.
- The brief's per-second rates, base fees and minimum charges go in as **proposals**. A new "Proposed changes" screen shows old and new values side by side, and you approve each change or all of them. Approved changes still stay unpublished.
- Tiers stay at 1.00×, 1.25× and 1.50×. The 10 video add-ons reuse the drafts you already have. Missing ones are added with no price.
- The pricing calculator itself stays the same.

## 2. Photography pricing (new, all drafts)
- **Categories and per-image rates:** the 8 services from BDT 200 to BDT 1,000.
- **Image workflow:** Magnific C3 or GPT-5 Image. The customer sees which one they chose, but both cost the same.
- **Packages:** A Basic Flat-lay (BDT 500, 2 images), B Website Set (BDT 900, 4), C Fashion Complete (BDT 2,200, 6) and D Premium Fashion (BDT 3,500, 6). You can edit each package's views and add example photos. No photos will be made up.
- **Views list:** a list of image views you can edit, used by packages and custom orders.
- **Bulk discounts:** 1–4 products 0%, 5–9 products 5%, 10–24 products 10%, 25–49 products 15%. For 50+ products the calculator asks for a custom quote. Only one discount tier applies, and only to services or packages you mark as eligible.
- **Minimum order:** BDT 1,000 for single-image orders. This is saved but switched off until you approve it.
- **Add-ons:** the 12 listed add-ons, with no prices set, which keeps them hidden until you add a price.
- **How a photography price is worked out:** rate × images × products, or package price × products. Then the bulk discount, add-ons, minimum, rounding and tax are applied. Package images are never charged twice.

## 3. Public /pricing page
- Two category cards sit at the top (AI Video Production and AI Product Photography) and switch instantly without reloading the page.
- The photography calculator lets visitors pick a category, workflow, single images or a package, product quantity, images per product, views, background, model and extras.
- The existing sticky summary is kept on desktop. Phones get a compact price bar that expands to show the breakdown.
- The estimate notes are editable in Website → Pages → Pricing.

## 4. Quotations
- "Request This Quote" works for both categories. Name, WhatsApp and email are required, as now.
- Each quote saves only the details that matter for its type. Video quotes keep the type, model, duration and tier. Photography quotes keep the package, products, images, views, discount and add-ons.
- Prices are always recalculated on the server. While pricing is unpublished, requests are saved as "Custom Quote Requested".
- The quote builder, customer quote page and PDF only show fields that fit the category. Older quote versions stay exactly as they were.

## 5. Control Centre → Pricing menu
- **AI Video:** Video Types, AI Models, Rate Matrix, Tiers, Video Add-ons, Minimum Charges, Proposed changes
- **AI Photography:** Categories and Rates, Packages, Package Views, Bulk Discounts, Photography Add-ons, Photography Settings
- **Shared:** Overview, Simulator (both categories), Publication Review (checks both), Quotations, Analytics, Settings
- Only full admins can make changes, as now.

## 6. Testing
Tests will cover the 18 QA points in your brief, including:
- the model price order and video maths
- each package, and equal C3 vs GPT-5 Image prices
- bulk discount boundaries and the minimum order
- photography quote details
- server recalculation, and no draft prices leaking to visitors
Desktop and phone layouts will be checked in a browser. Signed-in admin screens still need you to test them.

## Technical notes
- New tables `pricing_photo_categories`, `pricing_photo_packages`, `pricing_photo_views`, `pricing_photo_package_views`, `pricing_photo_addons`, `pricing_photo_bulk_tiers` and `pricing_rate_proposals`. Photography settings live in the `site_settings` group `pricing_photo`. All tables get grants, RLS, and public reads only for published rows.
- Quote requests get a new `category` column ('video' default) and a `photo_selection` JSON column. Video columns become nullable, so existing rows are unchanged.
- The new engine `src/lib/pricing/photo-engine.ts` reuses the existing integer-poisha rounding and tax helpers. `calculatePublicQuote` sends each request to the right engine based on its category.
- `src/lib/pricing/AGENTS.md` will be updated with the new rules.
