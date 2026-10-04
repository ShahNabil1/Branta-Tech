-- ===== Shared helpers =====
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ===== user_roles =====
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin','admin','content_manager','sales','hr','client','applicant')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_cms_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('super_admin','admin'))
$$;

revoke execute on function public.has_role(uuid, text) from public, anon;
revoke execute on function public.is_cms_admin(uuid) from public, anon;
grant execute on function public.has_role(uuid, text) to authenticated, service_role;
grant execute on function public.is_cms_admin(uuid) to authenticated, service_role;

-- Roles: users read their own; admins read all. No client writes at all (service role only).
create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_cms_admin(auth.uid()));

-- Profiles policies
create policy "Users read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_cms_admin(auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_cms_admin(auth.uid()))
  with check (id = auth.uid() or public.is_cms_admin(auth.uid()));

-- Non-admins cannot change their own status or email
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_cms_admin(auth.uid()) then
    new.status := old.status;
    new.email := old.email;
    new.id := old.id;
  end if;
  return new;
end; $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup (no role assigned automatically)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== site_settings =====
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_group text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon;
grant select, insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "Public reads settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins manage settings" on public.site_settings for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ===== site_pages =====
create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  page_type text not null default 'standard',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  meta_title text,
  meta_description text,
  canonical_url text,
  og_image_url text,
  noindex boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index site_pages_status_idx on public.site_pages (status);
grant select on public.site_pages to anon;
grant select, insert, update, delete on public.site_pages to authenticated;
grant all on public.site_pages to service_role;
alter table public.site_pages enable row level security;
create policy "Public reads published pages" on public.site_pages for select to anon, authenticated
  using (status = 'published' or public.is_cms_admin(auth.uid()));
create policy "Admins manage pages" on public.site_pages for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger site_pages_updated_at before update on public.site_pages
  for each row execute function public.set_updated_at();

-- ===== page_sections =====
create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  section_type text not null,
  eyebrow text,
  title text,
  body text,
  media_url text,
  media_type text check (media_type in ('image','video','vimeo')),
  cta_label text,
  cta_url text,
  config jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index page_sections_page_order_idx on public.page_sections (page_id, sort_order);
grant select on public.page_sections to anon;
grant select, insert, update, delete on public.page_sections to authenticated;
grant all on public.page_sections to service_role;
alter table public.page_sections enable row level security;
create policy "Public reads visible sections of published pages" on public.page_sections for select to anon, authenticated
  using (
    public.is_cms_admin(auth.uid())
    or (is_visible and exists (select 1 from public.site_pages p where p.id = page_id and p.status = 'published'))
  );
create policy "Admins manage sections" on public.page_sections for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger page_sections_updated_at before update on public.page_sections
  for each row execute function public.set_updated_at();

-- ===== service_groups =====
create table public.service_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_groups_status_order_idx on public.service_groups (status, sort_order);
grant select on public.service_groups to anon;
grant select, insert, update, delete on public.service_groups to authenticated;
grant all on public.service_groups to service_role;
alter table public.service_groups enable row level security;
create policy "Public reads published groups" on public.service_groups for select to anon, authenticated
  using (status = 'published' or public.is_cms_admin(auth.uid()));
create policy "Admins manage groups" on public.service_groups for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger service_groups_updated_at before update on public.service_groups
  for each row execute function public.set_updated_at();

-- ===== services =====
create table public.services (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.service_groups(id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  hero_media_url text,
  hero_media_type text check (hero_media_type in ('image','video','vimeo')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  meta_title text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  noindex boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_group_idx on public.services (group_id, sort_order);
create index services_status_order_idx on public.services (status, sort_order);
create index services_featured_idx on public.services (sort_order) where featured;
grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "Public reads published services" on public.services for select to anon, authenticated
  using (status = 'published' or public.is_cms_admin(auth.uid()));
create policy "Admins manage services" on public.services for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ===== portfolio_categories =====
create table public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_categories_status_order_idx on public.portfolio_categories (status, sort_order);
grant select on public.portfolio_categories to anon;
grant select, insert, update, delete on public.portfolio_categories to authenticated;
grant all on public.portfolio_categories to service_role;
alter table public.portfolio_categories enable row level security;
create policy "Public reads published categories" on public.portfolio_categories for select to anon, authenticated
  using (status = 'published' or public.is_cms_admin(auth.uid()));
create policy "Admins manage categories" on public.portfolio_categories for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger portfolio_categories_updated_at before update on public.portfolio_categories
  for each row execute function public.set_updated_at();

-- ===== portfolio_projects =====
create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.portfolio_categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  client_name text,
  industry text,
  project_year smallint check (project_year between 1990 and 2100),
  short_description text,
  overview text,
  challenge text,
  approach text,
  execution text,
  result text,
  cover_url text,
  cover_type text check (cover_type in ('image','video','vimeo')),
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  meta_title text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  noindex boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_projects_category_idx on public.portfolio_projects (category_id);
create index portfolio_projects_status_order_idx on public.portfolio_projects (status, sort_order);
create index portfolio_projects_featured_idx on public.portfolio_projects (sort_order) where is_featured;
grant select on public.portfolio_projects to anon;
grant select, insert, update, delete on public.portfolio_projects to authenticated;
grant all on public.portfolio_projects to service_role;
alter table public.portfolio_projects enable row level security;
create policy "Public reads published projects" on public.portfolio_projects for select to anon, authenticated
  using (status = 'published' or public.is_cms_admin(auth.uid()));
create policy "Admins manage projects" on public.portfolio_projects for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger portfolio_projects_updated_at before update on public.portfolio_projects
  for each row execute function public.set_updated_at();

-- ===== portfolio_project_services =====
create table public.portfolio_project_services (
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (project_id, service_id)
);
create index portfolio_project_services_service_idx on public.portfolio_project_services (service_id);
grant select on public.portfolio_project_services to anon;
grant select, insert, update, delete on public.portfolio_project_services to authenticated;
grant all on public.portfolio_project_services to service_role;
alter table public.portfolio_project_services enable row level security;
create policy "Public reads links of published projects" on public.portfolio_project_services for select to anon, authenticated
  using (
    public.is_cms_admin(auth.uid())
    or exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published')
  );
create policy "Admins manage project services" on public.portfolio_project_services for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));

-- ===== portfolio_media =====
create table public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','vimeo')),
  url text not null,
  poster_url text,
  alt_text text,
  caption text,
  orientation text not null default 'auto' check (orientation in ('landscape','portrait','square','auto')),
  width integer check (width > 0),
  height integer check (height > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_media_project_order_idx on public.portfolio_media (project_id, sort_order);
grant select on public.portfolio_media to anon;
grant select, insert, update, delete on public.portfolio_media to authenticated;
grant all on public.portfolio_media to service_role;
alter table public.portfolio_media enable row level security;
create policy "Public reads media of published projects" on public.portfolio_media for select to anon, authenticated
  using (
    public.is_cms_admin(auth.uid())
    or exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published')
  );
create policy "Admins manage project media" on public.portfolio_media for all to authenticated
  using (public.is_cms_admin(auth.uid())) with check (public.is_cms_admin(auth.uid()));
create trigger portfolio_media_updated_at before update on public.portfolio_media
  for each row execute function public.set_updated_at();

-- ===== Storage policies for site-public bucket =====
create policy "Public reads site-public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-public');
create policy "Admins upload site-public" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-public' and public.is_cms_admin(auth.uid()));
create policy "Admins update site-public" on storage.objects for update to authenticated
  using (bucket_id = 'site-public' and public.is_cms_admin(auth.uid()))
  with check (bucket_id = 'site-public' and public.is_cms_admin(auth.uid()));
create policy "Admins delete site-public" on storage.objects for delete to authenticated
  using (bucket_id = 'site-public' and public.is_cms_admin(auth.uid()));

-- ===== Seed: six approved service groups =====
insert into public.service_groups (name, slug, sort_order, status) values
  ('AI Video & Film', 'ai-video-film', 1, 'published'),
  ('AI Photography', 'ai-photography', 2, 'published'),
  ('Brand & Creative', 'brand-creative', 3, 'published'),
  ('UI/UX & Digital Design', 'ui-ux-digital-design', 4, 'published'),
  ('Web & Software', 'web-software', 5, 'published'),
  ('AI Automation', 'ai-automation', 6, 'published');
