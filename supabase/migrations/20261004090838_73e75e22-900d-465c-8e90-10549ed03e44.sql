INSERT INTO public.site_pages (title, slug, page_type, status)
VALUES ('Home', 'home', 'home', 'published')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, media_url, media_type, cta_label, cta_url, config)
SELECT p.id, 'hero', 10, true,
  'AI-powered creative & technology studio',
  'We Create What Brands Need Next.',
  'AI films, product visuals, campaigns, digital products and automation, built by one integrated creative technology team.',
  'https://vimeo.com/1232728534', 'video',
  'Explore Our Work', '/work',
  jsonb_build_object(
    'secondary_cta', jsonb_build_object('label','Start a Project','url','/contact'),
    'capabilities', jsonb_build_array('AI Film','AI Photography','Creative','Web','Software','Automation'),
    'media_items', jsonb_build_array(
      jsonb_build_object('role','film','type','vimeo','url','https://vimeo.com/1232728534','poster_url','https://i.vimeocdn.com/video/2208226870-5d14aa495aad051e5edf0267586253a44cb42b6c1ef80f23882deef389af31ea-d_1280?region=us','label','AI Film','alt','Branta Tech AI film reel','size_variant','primary','sort_order',10),
      jsonb_build_object('role','fashion','type','image','url','/__l5e/assets-v1/6172f38a-8226-4a59-a25a-e4b6c02f6e3c/fashion-visual.png','poster_url','','label','AI Fashion','alt','Two men in shirts leaning on driftwood on a beach at dusk','size_variant','portrait','sort_order',20),
      jsonb_build_object('role','product','type','image','url','/__l5e/assets-v1/0b4ae587-c2b7-425d-a147-20db7ce842df/product-visual-1.png','poster_url','','label','AI Product','alt','Hand holding a body oil bottle with a green cap on linen in sunlight','size_variant','small','sort_order',30),
      jsonb_build_object('role','ugc','type','image','url','/__l5e/assets-v1/2aeb8a0a-9485-4d7a-9cb0-838a287ca45d/ugc-visual.png','poster_url','','label','AI UGC','alt','Man in a striped polo shirt by the sea','size_variant','small','sort_order',40),
      jsonb_build_object('role','campaign','type','image','url','/__l5e/assets-v1/826af1dd-2522-4e3f-af6a-2c4707b9f4c6/product-visual-2.webp','poster_url','','label','AI Campaign','alt','Woman in blue reaching for a cleansing foam tube in a blue checkered room','size_variant','small','sort_order',50),
      jsonb_build_object('role','web','type','image','url','','poster_url','','label','Digital Product','alt','','size_variant','wide','sort_order',60)
    )
  )
FROM public.site_pages p
WHERE p.slug = 'home'
  AND NOT EXISTS (SELECT 1 FROM public.page_sections s WHERE s.page_id = p.id AND s.section_type = 'hero');