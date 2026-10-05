ALTER TABLE public.portfolio_categories
  ADD COLUMN IF NOT EXISTS homepage_group text,
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT true;
ALTER TABLE public.portfolio_categories ADD CONSTRAINT portfolio_categories_homepage_group_chk
  CHECK (homepage_group IS NULL OR homepage_group IN ('featured_only','ai_commercial','ai_motion','ai_content','ai_photography','brand_creative','web_digital','software_saas','ai_automation','hidden'));
UPDATE public.portfolio_categories SET homepage_group = CASE slug
  WHEN 'ai-commercial' THEN 'ai_commercial' WHEN 'ai-flim' THEN 'ai_commercial'
  WHEN 'ai-motion' THEN 'ai_motion' WHEN 'saas' THEN 'ai_motion'
  WHEN 'website' THEN 'web_digital' WHEN 'social-media-design' THEN 'brand_creative'
  WHEN 'ai-product-photoshoot' THEN 'ai_photography' ELSE homepage_group END
WHERE homepage_group IS NULL;
INSERT INTO public.page_sections (page_id, section_type, eyebrow, title, body, cta_label, cta_url, config, is_visible, sort_order)
SELECT p.id, 'work_showcase', 'FEATURED WORK', 'Work We’re Proud Of.', 'Selected work across AI, creative and technology.', 'Explore All Work', '/work',
  '{"max_featured":10,"show_jump_nav":true,"speed":40,"hover_preview":true,"group_order":["ai_commercial","ai_motion","ai_content","ai_photography","brand_creative","web_digital","software_saas","ai_automation"]}'::jsonb, true, 30
FROM public.site_pages p WHERE p.slug = 'home'
AND NOT EXISTS (SELECT 1 FROM public.page_sections s WHERE s.page_id = p.id AND s.section_type = 'work_showcase');