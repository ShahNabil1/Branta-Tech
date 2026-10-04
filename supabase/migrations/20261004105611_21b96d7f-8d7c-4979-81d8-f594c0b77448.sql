ALTER TABLE public.services ADD COLUMN IF NOT EXISTS hero_poster_url text, ADD COLUMN IF NOT EXISTS page_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.service_groups ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.services (group_id, name, slug, sort_order, status)
SELECT g.id, v.name, v.slug, v.ord, 'draft'
FROM (VALUES
 ('ai-video-film','AI Film & TVC','ai-film-tvc',10),('ai-video-film','AI Commercial','ai-commercial',20),('ai-video-film','AI Product Video','ai-product-video',30),
 ('ai-video-film','AI Fashion Film','ai-fashion-film',40),('ai-video-film','AI UGC','ai-ugc',50),('ai-video-film','Character Animation','character-animation',60),('ai-video-film','Motion Graphics & VFX','motion-graphics-vfx',70),
 ('ai-photography','AI Product Photography','ai-product-photography',10),('ai-photography','AI Fashion Visuals','ai-fashion-visuals',20),('ai-photography','Campaign Visuals','campaign-visuals',30),
 ('ai-photography','Lifestyle Visuals','lifestyle-visuals',40),('ai-photography','Virtual Models','virtual-models',50),('ai-photography','E-commerce Images','ecommerce-images',60),
 ('brand-creative','Branding','branding',10),('brand-creative','Graphic Design','graphic-design',20),('brand-creative','Campaign Creative','campaign-creative',30),('brand-creative','Social Media Creative','social-media-creative',40),('brand-creative','Packaging','packaging-design',50),
 ('ui-ux-digital-design','UI/UX Design','ui-ux-design',10),('ui-ux-digital-design','Website UI','website-ui',20),('ui-ux-digital-design','Mobile App UI','mobile-app-ui',30),('ui-ux-digital-design','SaaS Product Design','saas-product-design',40),('ui-ux-digital-design','Dashboard Design','dashboard-design',50),
 ('web-software','Website Development','web-development',10),('web-software','E-commerce Development','ecommerce-development',20),('web-software','SaaS Development','saas-development',30),
 ('web-software','LMS','lms-development',40),('web-software','CRM','crm-development',50),('web-software','ERP','erp-development',60),('web-software','POS','pos-development',70),('web-software','Custom Software','custom-software',80),
 ('ai-automation','AI Agents','ai-agents',10),('ai-automation','AI Chatbots','ai-chatbots',20),('ai-automation','n8n Automation','n8n-automation',30),('ai-automation','Marketing Automation','marketing-automation',40),('ai-automation','Sales Automation','sales-automation',50),('ai-automation','Business Process Automation','business-process-automation',60)
) AS v(gslug,name,slug,ord)
JOIN public.service_groups g ON g.slug = v.gslug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.site_pages (title, slug, page_type, status) VALUES ('AI Studio','ai-studio','standard','published') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.page_sections (page_id, section_type, eyebrow, title, body, sort_order, is_visible)
SELECT p.id, 'studio_hero', 'AI STUDIO', 'Experiments Before They Become Services.', 'A space for visual experiments, prototypes and AI-native ideas from the Branta team.', 0, true
FROM public.site_pages p WHERE p.slug = 'ai-studio'
AND NOT EXISTS (SELECT 1 FROM public.page_sections s WHERE s.page_id = p.id AND s.section_type = 'studio_hero');