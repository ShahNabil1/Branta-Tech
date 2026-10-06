create table public.pricing_video_types (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  related_service_id uuid references public.services(id) on delete set null,
  base_creative_fee numeric(12,2) not null default 0 check (base_creative_fee >= 0),
  minimum_project_price numeric(12,2) not null default 0 check (minimum_project_price >= 0),
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_ai_models (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  available boolean not null default true,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_model_rates (
  id uuid primary key default gen_random_uuid(),
  video_type_id uuid not null references public.pricing_video_types(id) on delete cascade,
  ai_model_id uuid not null references public.pricing_ai_models(id) on delete cascade,
  selling_rate_per_second numeric(12,2) not null check (selling_rate_per_second >= 0),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (video_type_id, ai_model_id)
);
create table public.pricing_production_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  multiplier numeric(6,3) not null default 1 check (multiplier > 0 and multiplier <= 10),
  description text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_addons (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text,
  charge_type text not null check (charge_type in ('fixed','per_second','per_scene','percentage')),
  amount numeric(12,2) check (amount is null or amount >= 0),
  percentage numeric(6,3) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  enabled boolean not null default true,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((charge_type = 'percentage' and percentage is not null) or (charge_type <> 'percentage' and amount is not null))
);
-- Empty = applies to all video types.
create table public.pricing_addon_video_types (
  addon_id uuid not null references public.pricing_addons(id) on delete cascade,
  video_type_id uuid not null references public.pricing_video_types(id) on delete cascade,
  primary key (addon_id, video_type_id)
);

do $$ declare t text; begin
  foreach t in array array['pricing_video_types','pricing_ai_models','pricing_model_rates','pricing_production_tiers','pricing_addons'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['pricing_video_types','pricing_ai_models','pricing_model_rates','pricing_production_tiers','pricing_addons','pricing_addon_video_types'] loop
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "CMS admins read %1$s" on public.%1$I for select to authenticated using (private.is_cms_admin())', t);
    execute format('create policy "CMS admins insert %1$s" on public.%1$I for insert to authenticated with check (private.is_cms_admin())', t);
    execute format('create policy "CMS admins update %1$s" on public.%1$I for update to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin())', t);
    execute format('create policy "CMS admins delete %1$s" on public.%1$I for delete to authenticated using (private.is_cms_admin())', t);
  end loop;
end $$;

create policy "Public reads published video types" on public.pricing_video_types for select to anon, authenticated using (published);
create policy "Public reads published models" on public.pricing_ai_models for select to anon, authenticated using (published and available);
create policy "Public reads published tiers" on public.pricing_production_tiers for select to anon, authenticated using (published);
create policy "Public reads published addons" on public.pricing_addons for select to anon, authenticated using (published and enabled);
create policy "Public reads live rates" on public.pricing_model_rates for select to anon, authenticated using (
  enabled
  and exists (select 1 from public.pricing_video_types v where v.id = video_type_id and v.published)
  and exists (select 1 from public.pricing_ai_models m where m.id = ai_model_id and m.published and m.available));
create policy "Public reads live addon scopes" on public.pricing_addon_video_types for select to anon, authenticated using (
  exists (select 1 from public.pricing_addons a where a.id = addon_id and a.published and a.enabled));