insert into public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, cta_label, cta_url, config)
select id, 'ai_film_showcase', 40, true, 'AI FILM', 'Turn an Idea Into a World.',
 'From commercials and product films to fashion, UGC, motion and VFX, Branta builds complete visual stories through one AI-native production workflow.',
 'Explore AI Film', '/services/ai-video-film',
 '{"max_items":8,"filter_enabled":true,"sort_mode":"featured","project_ids":[]}'::jsonb
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages sp on sp.id = s.page_id where sp.slug='home' and s.section_type='ai_film_showcase');