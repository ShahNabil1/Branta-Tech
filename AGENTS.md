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
- Control Centre lives under /control-centre (ssr:false); the pathless control-centre/_admin layout gates on getUser + own user_roles (super_admin/admin). RLS helper private.is_cms_admin() is self-only — never re-expose role checks taking a user id.
- Site chrome (SiteShell) is applied per public route, not in __root, so admin pages stay chrome-free.
- Control Centre CMS screens use the shared kit in src/components/admin/cms.tsx (fields, badges, SaveBar, ConfirmButton, slug/URL helpers) and src/lib/supabase/cms.ts; writes go through the browser client under RLS — never the service-role client — so admin protection stays in the database.
- Navigation is stored as JSON in site_settings (setting_group "navigation", { items: [...] }) — no dedicated table until navigation needs relational features.
- Public header (src/components/layout/SiteHeader.tsx) renders CMS navigation via navFromCms, falling back to FALLBACK_NAV in src/lib/navigation.ts only when CMS is empty; links to routes not in the router render as inactive labels — never create placeholder routes to satisfy nav.
- Public data for site chrome is read by the getSiteChrome server fn with the publishable key (anon RLS); route loaders ensure siteChromeQuery so SSR has the header.
- Each homepage section is a Home page_section (config JSON, parsed in src/lib/*, read with the publishable key) — no per-section tables; per-section rules live in src/components/home/AGENTS.md.
- Public footer (SiteShell) reads company/contact/social/brand from site_settings via getSiteChrome and footer columns from CMS navigation items in menu_group "footer", falling back to FALLBACK_FOOTER; links use SmartLink so missing routes render inactive.
- Public portfolio lives at /work (work.index.tsx, filters via ?filter=slug from tags used by published work) and /work/$slug (work.$slug.tsx); both read via src/lib/work.functions.ts with the publishable key — drafts never resolve.
- Case studies are built from portfolio_case_sections (ordered, typed, config validated by src/lib/case-study.ts with a closed list of types/layouts/tones and https-only media) plus portfolio_project_team credits; when a project has no sections the legacy text fields + portfolio_media render instead.
- Vimeo posters fall back to Vimeo oEmbed thumbnails resolved server-side (src/lib/vimeo.server.ts, dynamically imported); players are poster-first and mount only on click or near viewport.
