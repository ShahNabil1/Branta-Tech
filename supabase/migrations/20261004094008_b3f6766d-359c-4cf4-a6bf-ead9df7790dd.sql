with p as (
insert into public.portfolio_projects (title, slug, status, is_featured, sort_order, cover_type, cover_url)
values
 ('Pure Radiance Body Oil','pure-radiance-body-oil','published',true,10,'vimeo','https://vimeo.com/1183677731'),
 ('Tilamok','tilamok','published',true,20,'vimeo','https://vimeo.com/1205217563'),
 ('AIRA','aira','published',true,30,'vimeo','https://vimeo.com/1211608607'),
 ('Branta SaaS Service','branta-saas-service','published',true,40,'vimeo','https://vimeo.com/1167294176'),
 ('AI Photography','ai-photography','published',true,50,'vimeo','https://vimeo.com/1167621946'),
 ('Untitled film 1232728534','film-1232728534','draft',false,60,'vimeo','https://vimeo.com/1232728534'),
 ('Untitled film 1183677848','film-1183677848','draft',false,70,'vimeo','https://vimeo.com/1183677848'),
 ('Untitled film 1205217155','film-1205217155','draft',false,80,'vimeo','https://vimeo.com/1205217155'),
 ('Untitled film 1205217544','film-1205217544','draft',false,90,'vimeo','https://vimeo.com/1205217544'),
 ('Untitled film 1211576753','film-1211576753','draft',false,100,'vimeo','https://vimeo.com/1211576753'),
 ('Untitled film 1211608803','film-1211608803','draft',false,110,'vimeo','https://vimeo.com/1211608803'),
 ('Untitled film 1211609079','film-1211609079','draft',false,120,'vimeo','https://vimeo.com/1211609079')
on conflict (slug) do nothing
returning id, slug, cover_url)
insert into public.portfolio_media (project_id, media_type, url, poster_url, orientation, sort_order, alt_text)
select p.id, 'vimeo', p.cover_url, t.poster, t.o, 0, t.alt from p join (values
 ('pure-radiance-body-oil','https://i.vimeocdn.com/video/2146619792-8895512f173b9ed90684a35d377134e2b4341e0032884acec9cacce241254005-d_1280x720','landscape','Pure Radiance body oil film'),
 ('tilamok','https://i.vimeocdn.com/video/2173747684-5a0df81abf33d1e1c0ff78e15d26e28b65bd8fc567e553dd64fa4962e3f38ea8-d_1280x720','landscape','Tilamok film'),
 ('aira','https://i.vimeocdn.com/video/2181823675-7c3f11470901bbcd418cebc31e3b51de7e1adf292657e6e28aed870a78c5ab42-d_1280x720','landscape','AIRA film'),
 ('branta-saas-service','https://i.vimeocdn.com/video/2125222027-6739122eafab04899d842de2a648b68e8e7dfdf2614ed20b5fdbeb3dc9c1a9b7-d_1280x720','landscape','Branta SaaS service film'),
 ('ai-photography','https://i.vimeocdn.com/video/2125682743-e0281bfc35a39e633e621805c6827a5d2813683bd1cf3e81d4ef3dd26d2f0609-d_1280x720','landscape','AI photography film'),
 ('film-1232728534','https://i.vimeocdn.com/video/2208226870-5d14aa495aad051e5edf0267586253a44cb42b6c1ef80f23882deef389af31ea-d_1280x720','landscape','Branta film'),
 ('film-1183677848','https://i.vimeocdn.com/video/2146619879-7b8563ef84bad2c2e872a35a227f83209b47979d2567a82e3e04245e7297b65e-d_1280x720','landscape','Branta film'),
 ('film-1205217155','https://i.vimeocdn.com/video/2173747238-493aff13c6679b43f049bc6bc7d9b2153354001fb06f628fc777e91d187c6b8d-d_1080x1080','square','Branta film'),
 ('film-1205217544','https://i.vimeocdn.com/video/2173747662-fd592cc4b39bbfe3633ca62cb3cb97fc3d14c29a4c43e76f4417fc2524e48e03-d_720x1280','portrait','Branta film'),
 ('film-1211576753','https://i.vimeocdn.com/video/2181785201-d68ee801857d6f8e5977988aab8f4fa11d67ba2c1b82444b6ebf2877456d85e0-d_1280x720','landscape','Branta film'),
 ('film-1211608803','https://i.vimeocdn.com/video/2181823701-4f74dc6b7f8a4ec9629f26224934230d1461187922d4e6407d4f20deb1b4ed4a-d_720x1280','portrait','Branta film'),
 ('film-1211609079','https://i.vimeocdn.com/video/2181824713-a8ac60caf07b14311f2212f417890c061d4a2de30c3617ba4acfb0f9869169c1-d_1280x720','landscape','Branta film')
) as t(slug, poster, o, alt) on t.slug = p.slug;

insert into public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, cta_label, cta_url, config)
select id, 'featured_work', 30, true, 'SELECTED WORK', 'Made by Branta.',
 'A selection of films, visuals, campaigns and digital work created across AI, creative and technology.',
 'View All Work', '/work', '{"max_projects":6,"show_client":true,"show_category":true,"show_services":true}'::jsonb
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages sp on sp.id = s.page_id where sp.slug='home' and s.section_type='featured_work');