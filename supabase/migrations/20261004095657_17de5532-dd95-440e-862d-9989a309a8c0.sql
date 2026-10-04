insert into public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, cta_label, cta_url, config)
select id, 'web_software_showcase', 60, true, 'WEB & SOFTWARE', 'From Interface to Infrastructure.',
 'We design and build websites, digital products and custom business systems around real workflows and real business needs.',
 'Explore Web & Software', '/services/web-software',
 jsonb_build_object(
  'statement', E'Designed to impress.\nBuilt to work.',
  'promo_vimeo_url','https://vimeo.com/1167294176',
  'promo_poster_url','https://i.vimeocdn.com/video/2125222027-6739122eafab04899d842de2a648b68e8e7dfdf2614ed20b5fdbeb3dc9c1a9b7-d_1280x720',
  'capabilities', jsonb_build_array('Websites','E-commerce','SaaS','LMS','CRM','ERP','POS','Custom Software'),
  'work_heading','Selected Digital Work',
  'max_items',4,
  'project_ids','[]'::jsonb)
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages sp on sp.id = s.page_id where sp.slug='home' and s.section_type='web_software_showcase');