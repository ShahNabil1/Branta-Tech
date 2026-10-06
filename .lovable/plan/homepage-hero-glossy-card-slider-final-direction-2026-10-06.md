# Homepage hero: glossy card slider (final direction)

This replaces the current light, centered hero and the "Made by Branta." grid with one glossy card slider. Your two most recent briefs overlap. The plan follows the newer one ("FINAL homepage hero direction"). The Tasklytic brief is used only as a visual guide for the slides: the floating pill menu bar, the warm pastel glow and the large media frame.

## What visitors will see
- One large rounded card per slide on a soft off-white page. A little of the next and previous slides shows at the edges.
- Arrows, page dots and swipe on phones. Optional slow autoplay that pauses on hover, on touch and when the slider is off-screen.
- Transitions are a short fade with a small slide. There is no heavy parallax.
- The menu bar stays the light floating pill already on the homepage. It is restyled slightly: a centered nav group and a dark "Book a Call" button.

## The 6 slides (starting copy, all editable)
1. **Creative Ideas. Made to Move.** Motion ads intro with 3 mini project cards taken from published AI Motion projects.
2. **See What Branta Can Build.** The Vimeo video 1227685387 fills the card. It plays muted, loops and has no controls. Clicking it opens the existing full-size popup with sound.
3. **AI Product Photoshoots, Reimagined.** Product visuals from published AI Photography work. Button: "Explore AI Product Photography".
4. **Commercial Stories, Built with AI.** A cinematic layout using published AI Commercial work. Button: "Explore AI Commercial".
5. **Web Experiences That Work.** A browser-style mockup showing Web & Digital work, if any is published. Button: "Explore Web & Software".
6. **The Card. The Only Card. That Works Like Branta.** A brand statement around a glossy card made in code (no stock photo). Button: "Work with Branta".

Media comes only from your real published work. If a slide has no media, it uses a clean gradient layout instead of fake work.

## Control Centre editing
Under Website → Pages → Home → Hero, you can do this for each slide:
- add, remove and change the order of slides
- switch a slide between Draft and Published
- edit the badge, headline, description, button text and button link
- choose a layout (intro, video, product, commercial, web, brand card)
- pick media (image, MP4 or Vimeo) with the existing media editor
- choose whether mini cards are filled from a work category
- set autoplay on or off, and its speed

## What stays the same
- Booking, pricing, sign-in, portfolio, Control Centre, and every homepage section below the hero.
- Everything is stored in your external Supabase. Lovable Cloud is not used.

## Technical details
- Slides are stored as `slides[]` inside the existing Home `hero` page_section config. There is no new table, which follows the per-section JSON rule. Parsing goes in `src/lib/hero.ts`; `getHomeHero` adds Vimeo posters. Published-work media for the mini cards and fallbacks is reused from `workShowcaseQuery`.
- `HeroSlider.tsx` uses Motion (`motion/react`) for stateful slide transitions, with pointer and touch swipe, keyboard arrows and `aria-roledescription="carousel"`. Only the active slide and the slides next to it mount media.
- Video goes through `BrantaVideo`: poster first, muted background loop, paused off-screen. On phones the Vimeo poster stays until the visitor taps, which keeps the mobile speed work intact.
- `EditorialHero` and the `bento_video_*` settings are removed. The saved Vimeo URL is moved into slide 2.
- Admin: `HeroFields.tsx` gets a slide list editor that reuses the `cms.tsx` fields and `SectionMediaEditor`.
- The 6 starting slides are saved into the hero config through a data update.
- Checks: 320–1600px with no overflow, swipe on phone, autoplay pause, video popup with sound, build and tests.
- Update the homepage rules in AGENTS.md and the design memory (hero map).
