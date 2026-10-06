<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Backend is an external, user-connected Supabase project only; never enable Lovable Cloud — owner requirement for portability.
- Layout primitives live in src/components/layout/primitives.tsx and buttons in src/components/ui/brand-button.tsx — single source for page building blocks.
- Motion uses CSS utilities (reveal, reveal-mask, media-zoom, animate-marquee) plus an IntersectionObserver hook; add GSAP only for sticky/parallax needs — keeps bundle light.
- Typography tokens are fluid @utility classes (text-display-xl … text-caption) in src/styles.css — one place to tune the scale.
- Browser Supabase access goes only through src/integrations/supabase/client.ts (generated, single lazy client); app-side Supabase helpers live in src/lib/supabase/ — keeps one client and no hardcoded values.
- Control Centre lives under /control-centre (ssr:false); the pathless control-centre/_admin layout gates on getUser + own user_roles (super_admin/admin/hr/sales; nav filtered by role). RLS helper private.is_cms_admin() is self-only — never re-expose role checks taking a user id.
- Site chrome (SiteShell) is applied per public route, not in __root, so admin pages stay chrome-free.
- Control Centre CMS screens use the shared kit in src/components/admin/cms.tsx (fields, badges, SaveBar, ConfirmButton, slug/URL helpers) and src/lib/supabase/cms.ts; writes go through the browser client under RLS — never the service-role client — so admin protection stays in the database.
- Navigation is stored as JSON in site_settings (setting_group "navigation", { items: [...] }) — no dedicated table until navigation needs relational features.
- Public header (SiteHeader.tsx) renders CMS navigation via navFromCms, falling back to FALLBACK_NAV (src/lib/navigation.ts) only when CMS is empty; unknown routes render as inactive labels — never create placeholder routes.
- Public data for site chrome is read by the getSiteChrome server fn with the publishable key (anon RLS); route loaders ensure siteChromeQuery so SSR has the header.
- Each homepage section is a Home page_section (config JSON, parsed in src/lib/*, read with the publishable key) — no per-section tables; per-section rules live in src/components/home/AGENTS.md.
- Public footer (SiteShell) reads company/contact/social/brand from site_settings via getSiteChrome and footer columns from CMS navigation items in menu_group "footer", falling back to FALLBACK_FOOTER; links use SmartLink so missing routes render inactive.
- Vimeo posters fall back to Vimeo oEmbed thumbnails resolved server-side (src/lib/vimeo.server.ts, dynamically imported); players are poster-first and mount only on click or near viewport.
- /services/<slug> links (nav, CTAs via SmartLink/HeroAction) activate only when the slug is in getSiteChrome().serviceSlugs (published services + groups) — drafts stay inactive.
- Long-form content (posts.content_json, jobs.description_json) is { blocks } validated by src/lib/rich-text.ts and rendered as React elements — never store or render raw HTML.
- Job applications are written only by submitApplication (service role, magic-byte CV check, honeypot, rate limit); CVs in private career-private; staff access via private.is_hr_admin(). HR-only users see just Careers.
- Client accounts: public /sign-in, /sign-up, /forgot-password, /reset-password; dashboard under /client (ssr:false gate). The database (handle_new_user / ensure_client_profile) assigns "client" only to role-less users — never set roles from the browser.
- Leads/bookings are inserted only by src/lib/inquiry.functions.ts (service role, honeypot, rate limit; optional verified bearer links client_user_id); clients read them only via my_requests()/my_bookings() (no internal fields); sales staff = private.is_sales_admin() (super_admin/admin/sales). Shared files live in private bucket client-private under files/<client id>/.
- Booking availability uses sales-only booking_availability_rules/exceptions plus site_settings "booking"; public slots are computed server-side against active bookings, and a database exclusion constraint is the final overlap guard.
- Public content route rules (work, services, AI Studio, insights/company) live in src/routes/AGENTS.md.
- Branta Assistant (chat) is deterministic (no LLM/external AI): guests reach chat tables only via src/lib/chat.functions.ts → chat.server.ts (service role, hashed session token, rate limits); staff use the browser client under private.is_chat_agent() RLS; visitors get content-free Realtime pings and refetch; lead capture (chatIdentify) must complete before doSend accepts messages; funnel counts in chat_funnel_events — never expose chat rows to anon.
- AI video pricing is configured in pricing_* tables (relational, BDT minor-unit engine in src/lib/pricing/engine.ts); quotes are only recalculated server-side via src/lib/pricing.functions.ts — never trust browser totals.
- Quotations: public requests only via submitQuoteRequest (src/lib/quotes.functions.ts, service role, server recalculation, rate limit); staff manage under private.is_sales_admin() RLS; issued versions are immutable (DB trigger) and customers reach them only via a hashed random token at /quote/$token.
- Quotation integration rules (PDF, CRM/booking linking, expiry job) live in src/lib/pricing/AGENTS.md.
