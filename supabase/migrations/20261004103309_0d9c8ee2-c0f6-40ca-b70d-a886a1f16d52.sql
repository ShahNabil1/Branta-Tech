alter table public.portfolio_projects add column if not exists timeline text, add column if not exists cover_poster_url text;

create table public.portfolio_case_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  section_type text not null check (section_type in ('rich_text','full_image','full_video','image_grid','two_column_media','text_media','challenge','solution','process','gallery','before_after','result','quote','credits','key_facts','custom')),
  eyebrow text,
  title text,
  body text,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_case_sections_project_order_idx on public.portfolio_case_sections (project_id, sort_order);
grant select on public.portfolio_case_sections to anon;
grant select, insert, update, delete on public.portfolio_case_sections to authenticated;
grant all on public.portfolio_case_sections to service_role;
alter table public.portfolio_case_sections enable row level security;
create policy "Public reads visible sections of published projects" on public.portfolio_case_sections for select to anon, authenticated
  using (private.is_cms_admin() or (is_visible and exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published')));
create policy "Admins manage case sections" on public.portfolio_case_sections for all to authenticated
  using (private.is_cms_admin()) with check (private.is_cms_admin());
create trigger portfolio_case_sections_updated_at before update on public.portfolio_case_sections
  for each row execute function public.set_updated_at();

create table public.portfolio_project_team (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  member_name text not null check (length(trim(member_name)) > 0),
  role text not null check (length(trim(role)) > 0),
  photo_url text,
  profile_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_project_team_project_order_idx on public.portfolio_project_team (project_id, sort_order);
grant select on public.portfolio_project_team to anon;
grant select, insert, update, delete on public.portfolio_project_team to authenticated;
grant all on public.portfolio_project_team to service_role;
alter table public.portfolio_project_team enable row level security;
create policy "Public reads visible credits of published projects" on public.portfolio_project_team for select to anon, authenticated
  using (private.is_cms_admin() or (is_visible and exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published')));
create policy "Admins manage project team" on public.portfolio_project_team for all to authenticated
  using (private.is_cms_admin()) with check (private.is_cms_admin());
create trigger portfolio_project_team_updated_at before update on public.portfolio_project_team
  for each row execute function public.set_updated_at();