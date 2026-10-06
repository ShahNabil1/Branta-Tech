# Professional SEO, AEO & GEO foundation

## Goal
Make every public Branta Tech page easy for search engines and answer engines to discover, understand and cite, while keeping private and transactional pages out of search.

## What will change

### 1. Production sitemap
- Rebuild `/sitemap.xml` around one deduplicated URL registry.
- Keep the main public pages and add the new legal pages.
- Include every published, indexable work item, service group, service, insight and open/published job from the external Supabase project.
- Respect CMS `noindex` settings for dynamic pages and About, Team and Careers.
- Use each record's real `updated_at` only when it is a valid date; never use build time or today's date.
- Detect query failures instead of silently serving a misleading partial sitemap, while preserving a valid static fallback.
- Prevent duplicate `/services/<slug>` entries when group and service slugs collide.

### 2. Indexing controls
- Keep public marketing, portfolio, service, insight, pricing, careers, booking, legal and project-enquiry pages indexable.
- Keep authentication, applicant/account, client dashboard, Control Centre, job application and private quotation pages `noindex, nofollow`.
- Strengthen `robots.txt` for private route families and tokenized quotation URLs without blocking crawlers from seeing `noindex` on ordinary auth pages.
- Ensure missing dynamic content remains `noindex` and never enters the sitemap.

### 3. Search and social metadata
- Standardize all public route metadata through the shared SEO helper.
- Add self-referencing `og:url`, `og:site_name` and consistent Twitter card behavior.
- Accept CMS canonical overrides only when they are valid Branta Tech canonical URLs; otherwise use the page's own canonical.
- Preserve CMS titles, descriptions, images and `noindex` controls.

### 4. Structured data for SEO/AEO/GEO
- Enrich the homepage `Organization` and `WebSite` entities from existing public brand/contact/social data.
- Add `Service` and `BreadcrumbList` markup to service detail/group pages.
- Add `BlogPosting` and breadcrumb markup to insight articles using the published author, date and visible cover.
- Add `JobPosting` markup to open job pages using only fields already published on the page.
- Add FAQ structured data only where the same questions and answers are visibly rendered.
- Add an `llms.txt` discovery file listing safe public sections only; exclude admin, account, auth, application and quotation URLs.

### 5. Verification
- Test sitemap XML, deduplication, noindex filtering and query-failure behavior.
- Verify representative public and private pages for canonical, robots and structured data output.
- Check `/sitemap.xml`, `/robots.txt` and `/llms.txt` in the running preview.
- Run the relevant automated tests and confirm the final build.

## Current audit baseline
- The site is server-rendered, crawlable, and already serves valid robots and sitemap files.
- The current sitemap misses legal pages, can silently lose dynamic URLs on query errors, and does not respect CMS noindex on all static entries.
- Private areas are mostly protected correctly already.
- Structured data currently exists only on the homepage; articles, jobs and services are the main missed opportunities.
- Semrush currently estimates 2 US organic keywords and approximately 0 monthly organic visits; this is directional third-party data, not measured traffic.

## Boundaries
- Use the existing external Supabase project only; do not enable Lovable Cloud.
- Do not publish the site or submit the sitemap to Search Console in this implementation step.
- Do not invent addresses, legal facts, prices, credentials or unpublished content.
