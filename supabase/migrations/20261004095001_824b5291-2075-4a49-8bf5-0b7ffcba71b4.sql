insert into public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, cta_label, cta_url, config)
select id, 'ai_image_showcase', 50, true, 'AI IMAGE', E'Your Product.\nAnywhere.',
 'Create product, fashion, lifestyle and campaign visuals without the limitations of a traditional shoot.',
 'Explore AI Image', '/services/ai-photography',
 jsonb_build_object('layout_variant','editorial','before_after_pair',null,'media_items', jsonb_build_array(
  jsonb_build_object('url','/__l5e/assets-v1/0b4ae587-c2b7-425d-a147-20db7ce842df/product-visual-1.png','alt','Hand holding a body oil bottle with a green cap on linen in sunlight','label','AI Product','size_variant','large','sort_order',10),
  jsonb_build_object('url','/__l5e/assets-v1/826af1dd-2522-4e3f-af6a-2c4707b9f4c6/product-visual-2.webp','alt','Woman in blue reaching for a cleansing foam tube in a blue checkered room','label','Campaign','size_variant','medium','sort_order',20),
  jsonb_build_object('url','/__l5e/assets-v1/2aeb8a0a-9485-4d7a-9cb0-838a287ca45d/ugc-visual.png','alt','Man in a striped polo shirt by the sea','label','Lifestyle','size_variant','medium','sort_order',30),
  jsonb_build_object('url','/__l5e/assets-v1/6172f38a-8226-4a59-a25a-e4b6c02f6e3c/fashion-visual.png','alt','Two men in shirts leaning on driftwood on a beach at dusk','label','AI Fashion','size_variant','portrait','sort_order',40)
 ))
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages sp on sp.id = s.page_id where sp.slug='home' and s.section_type='ai_image_showcase');