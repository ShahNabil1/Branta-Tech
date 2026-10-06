# Branta Tech Mobile Performance & Best Practices Optimization

## Goal
Make the public site feel immediate on mobile while preserving Branta’s visual quality, content, SEO, CMS behavior, and the existing zero-layout-shift experience.

## What the audit found
- The supplied PageSpeed run reports **Best Practices 77**. Its direct failures are Vimeo’s third-party cookie and related browser cookie issues from autoplaying Vimeo embeds.
- The supplied run transferred about **4.0 MB** and estimated roughly **902 KB unused JavaScript**; its mobile LCP was about **3.7 s**, Speed Index **6.1 s**, and TBT **550 ms**.
- A fresh independent throttled mobile Lighthouse run reproduced the problem: the hero poster was LCP, with **5.1 s LCP**, **440 ms TBT**, **3.5 MB payload**, and heavy style/layout plus script work. The run also showed server-response variance, so repeated validation is necessary.
- CLS is effectively zero. The issue is loading and execution cost, not unstable layout.
- The homepage currently prepares the hero Vimeo player immediately and renders several additional hero media items on phones. Vimeo connections are also preconnected globally on pages that may not need video.
- Google Fonts add a blocking cross-origin request chain. Shared header code loads the Motion runtime before the mobile menu is ever opened.

## Implementation

### 1. Make the first screen lightweight
- Keep the hero poster as the immediate, high-priority visual and the LCP candidate.
- Do not mount the Vimeo iframe during initial mobile load; start it after the page is interactive/idle, or immediately after explicit play interaction.
- On phones, load only the primary hero media initially. Defer secondary hero tiles until they approach the viewport instead of downloading hidden/secondary assets during first paint.
- Preserve fixed aspect ratios and current layout so CLS remains effectively zero.

### 2. Remove unnecessary third-party work
- Remove global Vimeo preconnects from every page; add only narrowly scoped connection hints where a video is actually about to load.
- Keep Vimeo privacy-friendly parameters and defer iframe creation so its cookie/Inspector issues no longer affect the initial homepage audit.
- Tighten near-viewport thresholds for below-fold videos and ensure only the currently visible/selected video can prepare or play.

### 3. Reduce critical JavaScript and rendering work
- Lazy-load the animated mobile menu and Motion runtime only when the menu is requested, while preserving the approved smooth no-layout-shift animation.
- Split below-fold homepage sections into deferred chunks where safe, retaining server-rendered crawlable content and accessible fallbacks.
- Disable decorative parallax work on coarse-pointer/mobile devices and reduce first-load observers/duplicate media nodes.
- Keep chat’s existing click-to-load behavior.

### 4. Optimize fonts and images
- Replace the render-blocking Google Fonts chain with locally served Geist/Geist Mono files using `font-display: swap` and preload only the essential face.
- Add responsive image sizing hints and dimensions where CMS media currently lacks them.
- Use the external Supabase image transformation endpoint for oversized public CMS images where supported, with safe fallback to the original asset.
- Preserve original, untinted media appearance.

### 5. Improve instant repeat navigation
- Verify caching on hashed scripts/styles and public media; add app-controlled cache headers only where hosting defaults are insufficient.
- Retain TanStack link preloading for fast internal navigation without eagerly fetching large media.
- Avoid speculative connections and requests that compete with the hero on mobile.

### 6. Validate and guard against regressions
- Run focused tests plus the full existing test suite.
- Check build diagnostics and browser console/network errors.
- Verify homepage and representative public pages at phone and desktop sizes, including menu motion, hero playback, navigation, and zero horizontal overflow.
- Run repeated throttled mobile Lighthouse tests and compare median results for Performance, LCP, TBT, CLS, transferred bytes, unused JavaScript, and Best Practices.
- Document remaining provider/hosting limitations separately; do not claim a fixed score because Lighthouse naturally varies by network and server conditions.

## Expected outcome
- Much faster first paint and hero completion, lower mobile CPU/network cost, and instant-feeling navigation.
- Best Practices failures caused by Vimeo removed from the initial page load.
- Existing SEO/AEO/GEO output, CMS publishing, external Supabase architecture, visual hierarchy, and smooth mobile menu retained.
