-- Photography pricing + rate proposals (additive; everything starts unpublished)
create table public.pricing_photo_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  price_per_image numeric(12,2) check (price_per_image is null or price_per_image >= 0),
  bulk_eligible boolean not null default true,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_photo_views (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  applies_to text not null default 'all' check (applies_to in ('all','fashion','product')),
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_photo_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  price_per_product numeric(12,2) check (price_per_product is null or price_per_product >= 0),
  image_count integer not null check (image_count > 0 and image_count <= 100),
  example_image_url text,
  bulk_eligible boolean not null default true,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_photo_package_views (
  package_id uuid not null references public.pricing_photo_packages(id) on delete cascade,
  view_id uuid not null references public.pricing_photo_views(id) on delete cascade,
  position integer not null default 0,
  primary key (package_id, view_id)
);
create table public.pricing_photo_addons (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text,
  charge_type text not null default 'per_product' check (charge_type in ('fixed','per_product','per_image','percentage')),
  amount numeric(12,2) check (amount is null or amount >= 0),
  percentage numeric(6,3) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  enabled boolean not null default true,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_photo_bulk_tiers (
  id uuid primary key default gen_random_uuid(),
  min_products integer not null check (min_products >= 1),
  max_products integer check (max_products is null or max_products >= min_products),
  discount_percentage numeric(6,3) check (discount_percentage is null or (discount_percentage >= 0 and discount_percentage <= 100)),
  custom_quote boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (custom_quote or discount_percentage is not null)
);
create table public.pricing_rate_proposals (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('pricing_model_rates','pricing_video_types')),
  target_id uuid not null,
  field text not null check (field in ('selling_rate_per_second','base_creative_fee','minimum_project_price')),
  label text not null,
  current_value numeric(12,2),
  proposed_value numeric(12,2) not null check (proposed_value >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  source text,
  decided_at timestamptz, decided_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['pricing_photo_categories','pricing_photo_views','pricing_photo_packages','pricing_photo_addons','pricing_photo_bulk_tiers','pricing_rate_proposals'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['pricing_photo_categories','pricing_photo_views','pricing_photo_packages','pricing_photo_package_views','pricing_photo_addons','pricing_photo_bulk_tiers','pricing_rate_proposals'] loop
    if t <> 'pricing_rate_proposals' then execute format('grant select on public.%I to anon', t); end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "CMS admins read %1$s" on public.%1$I for select to authenticated using (private.is_cms_admin())', t);
    execute format('create policy "CMS admins insert %1$s" on public.%1$I for insert to authenticated with check (private.is_cms_admin())', t);
    execute format('create policy "CMS admins update %1$s" on public.%1$I for update to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin())', t);
    execute format('create policy "CMS admins delete %1$s" on public.%1$I for delete to authenticated using (private.is_cms_admin())', t);
  end loop;
end $$;

create policy "Public reads published photo categories" on public.pricing_photo_categories for select to anon, authenticated using (published and price_per_image is not null);
create policy "Public reads published photo views" on public.pricing_photo_views for select to anon, authenticated using (published);
create policy "Public reads published photo packages" on public.pricing_photo_packages for select to anon, authenticated using (published and price_per_product is not null);
create policy "Public reads published package views" on public.pricing_photo_package_views for select to anon, authenticated using (
  exists (select 1 from public.pricing_photo_packages p where p.id = package_id and p.published)
  and exists (select 1 from public.pricing_photo_views v where v.id = view_id and v.published));
create policy "Public reads priced photo addons" on public.pricing_photo_addons for select to anon, authenticated using (
  published and enabled and ((charge_type = 'percentage' and percentage is not null) or (charge_type <> 'percentage' and amount is not null)));
create policy "Public reads published bulk tiers" on public.pricing_photo_bulk_tiers for select to anon, authenticated using (published);

-- Quote requests: additive category support
alter table public.pricing_quote_requests
  add column if not exists category text not null default 'video' check (category in ('video','photography')),
  add column if not exists photo_selection jsonb;

-- Seed photography drafts
insert into public.pricing_photo_categories (name, slug, price_per_image, sort_order) values
 ('Basic Website Product Image','basic-website-product',200,1),
 ('E-commerce Product Photography','ecommerce-product',250,2),
 ('Flat-lay Product Photography','flat-lay-product',300,3),
 ('AI Model Product Photography','ai-model-product',450,4),
 ('Fashion Product Photography','fashion-product',500,5),
 ('Lifestyle Product Photography','lifestyle-product',550,6),
 ('Campaign Creative Photography','campaign-creative',700,7),
 ('Premium Advertising Visual','premium-advertising',1000,8);

insert into public.pricing_photo_views (name, slug, applies_to, sort_order) values
 ('Flat-lay Front','flat-lay-front','all',1),('Flat-lay Back','flat-lay-back','all',2),
 ('Front','front','product',3),('Back','back','product',4),('Side','side','product',5),('Close-up','close-up','all',6),
 ('Model Front','model-front','fashion',7),('Model Back','model-back','fashion',8),('Model Side','model-side','fashion',9),
 ('Model Close-up','model-close-up','fashion',10),('Detail Shot','detail-shot','all',11),
 ('Lifestyle','lifestyle','all',12),('Campaign Visual','campaign-visual','all',13);

insert into public.pricing_photo_packages (name, slug, description, price_per_product, image_count, sort_order) values
 ('Basic Flat-lay','basic-flat-lay','Two clean flat-lay images per product.',500,2,1),
 ('Website Product Set','website-product-set','Four essential views for product pages.',900,4,2),
 ('Fashion Complete','fashion-complete','Flat-lay plus on-model views.',2200,6,3),
 ('Premium Fashion','premium-fashion','Premium styling, advanced model consistency and detailed product-accuracy review.',3500,6,4);

insert into public.pricing_photo_package_views (package_id, view_id, position)
select p.id, v.id, x.pos from (values
 ('basic-flat-lay','flat-lay-front',1),('basic-flat-lay','flat-lay-back',2),
 ('website-product-set','front',1),('website-product-set','back',2),('website-product-set','side',3),('website-product-set','close-up',4),
 ('fashion-complete','flat-lay-front',1),('fashion-complete','flat-lay-back',2),('fashion-complete','model-front',3),('fashion-complete','model-back',4),('fashion-complete','model-side',5),('fashion-complete','model-close-up',6),
 ('premium-fashion','flat-lay-front',1),('premium-fashion','flat-lay-back',2),('premium-fashion','model-front',3),('premium-fashion','model-back',4),('premium-fashion','model-side',5),('premium-fashion','model-close-up',6)
) x(pk, vw, pos) join public.pricing_photo_packages p on p.slug = x.pk join public.pricing_photo_views v on v.slug = x.vw;

insert into public.pricing_photo_addons (name, charge_type, sort_order) values
 ('Premium Model Development','fixed',1),('Additional Image View','per_product',2),('Additional Color Variant','per_product',3),
 ('Character Consistency','fixed',4),('Advanced Product Accuracy','per_product',5),('Fabric/Texture Matching','per_product',6),
 ('Advanced Retouching','per_image',7),('Complex Background','per_image',8),('Lifestyle Environment','per_image',9),
 ('High-resolution Export','per_image',10),('Rush Delivery','percentage',11),('Additional Revision Round','fixed',12);

insert into public.pricing_photo_bulk_tiers (min_products, max_products, discount_percentage, custom_quote, sort_order) values
 (1,4,0,false,1),(5,9,5,false,2),(10,24,10,false,3),(25,49,15,false,4),(50,null,null,true,5);

insert into public.site_settings (setting_group, settings)
select 'pricing_photo', jsonb_build_object(
  'enabled', false, 'currency', 'BDT', 'rounding_increment', 100,
  'minimum_order', 1000, 'minimum_order_enabled', false,
  'max_products', 500, 'max_images_per_product', 30,
  'workflows', jsonb_build_array(jsonb_build_object('slug','magnific-c3','name','Magnific C3'), jsonb_build_object('slug','gpt-5-image','name','GPT-5 Image')),
  'backgrounds', jsonb_build_array('White studio','Solid colour','Lifestyle scene','Custom')
) where not exists (select 1 from public.site_settings where setting_group = 'pricing_photo');

-- Model hierarchy: names and order only (prices go through proposals)
update public.pricing_ai_models set name = 'Google Budget / Omni Flash', sort_order = 1 where slug = 'omni-flash';
update public.pricing_ai_models set sort_order = 2 where slug = 'kling';
update public.pricing_ai_models set name = 'Seedance Premium', sort_order = 3 where slug = 'seedance';

-- Proposals from the brief (only where different from current values)
insert into public.pricing_rate_proposals (target_table, target_id, field, label, current_value, proposed_value, source)
select 'pricing_model_rates', r.id, 'selling_rate_per_second', v.name || ' · ' || m.name, r.selling_rate_per_second, x.val, 'Complete AI Pricing brief'
from (values
 ('ai-motion','omni-flash',150),('ai-motion','kling',230),('ai-motion','seedance',350),
 ('ai-ugc','omni-flash',180),('ai-ugc','kling',250),('ai-ugc','seedance',400),
 ('ai-product-video','omni-flash',250),('ai-product-video','kling',380),('ai-product-video','seedance',600),
 ('ai-commercial','omni-flash',350),('ai-commercial','kling',450),('ai-commercial','seedance',750),
 ('ai-ovc','omni-flash',500),('ai-ovc','kling',650),('ai-ovc','seedance',1000),
 ('ai-tvc','omni-flash',700),('ai-tvc','kling',1000),('ai-tvc','seedance',1600),
 ('fashion-cinematic','omni-flash',400),('fashion-cinematic','kling',600),('fashion-cinematic','seedance',1100)
) x(vt, md, val)
join public.pricing_video_types v on v.slug = x.vt join public.pricing_ai_models m on m.slug = x.md
join public.pricing_model_rates r on r.video_type_id = v.id and r.ai_model_id = m.id
where r.selling_rate_per_second <> x.val;

insert into public.pricing_rate_proposals (target_table, target_id, field, label, current_value, proposed_value, source)
select 'pricing_video_types', v.id, x.f, v.name || case x.f when 'base_creative_fee' then ' · base fee' else ' · minimum' end,
  case x.f when 'base_creative_fee' then v.base_creative_fee else v.minimum_project_price end, x.val, 'Complete AI Pricing brief'
from (values
 ('ai-motion','base_creative_fee',3500),('ai-ugc','base_creative_fee',3500),('ai-product-video','base_creative_fee',5000),
 ('ai-commercial','base_creative_fee',7000),('ai-ovc','base_creative_fee',12000),('ai-tvc','base_creative_fee',20000),('fashion-cinematic','base_creative_fee',7000),
 ('ai-motion','minimum_project_price',8000),('ai-ugc','minimum_project_price',8000),('ai-product-video','minimum_project_price',12000),
 ('ai-commercial','minimum_project_price',18000),('ai-ovc','minimum_project_price',28000),('ai-tvc','minimum_project_price',45000),('fashion-cinematic','minimum_project_price',20000)
) x(vt, f, val) join public.pricing_video_types v on v.slug = x.vt
where (case x.f when 'base_creative_fee' then v.base_creative_fee else v.minimum_project_price end) <> x.val;