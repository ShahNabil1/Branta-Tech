
create or replace function private.is_hr_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('super_admin','admin','hr'))
$$;
revoke all on function private.is_hr_admin() from public, anon;
grant execute on function private.is_hr_admin() to authenticated, service_role;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- Authors
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  role text, photo_url text, bio text, profile_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select on public.authors to anon, authenticated;
grant insert, update, delete on public.authors to authenticated;
grant all on public.authors to service_role;
alter table public.authors enable row level security;
create policy "Public reads active authors" on public.authors for select to anon, authenticated using (is_active or private.is_cms_admin());
create policy "Admins manage authors" on public.authors for all to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin());
create trigger authors_touch before update on public.authors for each row execute function public.touch_updated_at();

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text,
  content_json jsonb not null default '{"blocks":[]}'::jsonb,
  content_html text,
  cover_url text, cover_alt text,
  author_id uuid references public.authors(id) on delete set null,
  category text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  published_at timestamptz,
  sort_order int not null default 0,
  meta_title text, meta_description text, canonical_url text, og_image_url text,
  noindex boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index posts_public_idx on public.posts (status, published_at desc);
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "Public reads published posts" on public.posts for select to anon, authenticated using (status = 'published' or private.is_cms_admin());
create policy "Admins manage posts" on public.posts for all to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin());
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- Team
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  role text, photo_url text, short_bio text, full_bio text, linkedin_url text, email text,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select on public.team_members to anon, authenticated;
grant insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
create policy "Public reads published team" on public.team_members for select to anon, authenticated using (status = 'published' or private.is_cms_admin());
create policy "Admins manage team" on public.team_members for all to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin());
create trigger team_touch before update on public.team_members for each row execute function public.touch_updated_at();

-- Jobs
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  department text, employment_type text, location text, work_mode text, summary text,
  description_json jsonb not null default '{"blocks":[]}'::jsonb,
  description_html text,
  requirements_json jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  featured boolean not null default false,
  published_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "Public reads published jobs" on public.jobs for select to anon, authenticated using (status = 'published' or private.is_hr_admin());
create policy "HR manages jobs" on public.jobs for all to authenticated using (private.is_hr_admin()) with check (private.is_hr_admin());
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

-- Applications (inserted only by the server; HR/admin read and update)
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  full_name text not null, email text not null, phone text not null,
  location text, portfolio_url text, linkedin_url text, cover_note text not null,
  resume_url text,
  ip_hash text,
  status text not null default 'new' check (status in ('new','reviewing','shortlisted','interview','offer','hired','rejected','withdrawn')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index job_applications_job_idx on public.job_applications (job_id, submitted_at desc);
create index job_applications_rate_idx on public.job_applications (email, submitted_at desc);
grant select, update, delete on public.job_applications to authenticated;
grant all on public.job_applications to service_role;
alter table public.job_applications enable row level security;
create policy "HR reads applications" on public.job_applications for select to authenticated using (private.is_hr_admin());
create policy "HR updates applications" on public.job_applications for update to authenticated using (private.is_hr_admin()) with check (private.is_hr_admin());
create policy "HR deletes applications" on public.job_applications for delete to authenticated using (private.is_hr_admin());
create trigger applications_touch before update on public.job_applications for each row execute function public.touch_updated_at();

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete set null,
  note text not null check (length(trim(note)) > 0),
  created_at timestamptz not null default now()
);
alter table public.application_notes alter column author_user_id drop not null;
grant select, insert, delete on public.application_notes to authenticated;
grant all on public.application_notes to service_role;
alter table public.application_notes enable row level security;
create policy "HR reads notes" on public.application_notes for select to authenticated using (private.is_hr_admin());
create policy "HR adds notes" on public.application_notes for insert to authenticated with check (private.is_hr_admin() and author_user_id = auth.uid());
create policy "HR deletes notes" on public.application_notes for delete to authenticated using (private.is_hr_admin());

-- Private resume files: HR/admin read/delete only; uploads happen server-side.
create policy "HR reads career-private" on storage.objects for select to authenticated using (bucket_id = 'career-private' and private.is_hr_admin());
create policy "HR deletes career-private" on storage.objects for delete to authenticated using (bucket_id = 'career-private' and private.is_hr_admin());

-- HR may read their own role rows already; nothing else changes.
-- Company pages (published shells; content added in Control Centre)
insert into public.site_pages (slug, title, page_type, status) values
  ('about','About','standard','published'),
  ('team','Team','standard','published'),
  ('careers','Careers','standard','published')
on conflict (slug) do nothing;
