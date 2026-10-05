create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'text' check (kind in ('text','video')),
  client_name text not null,
  client_role text,
  company text,
  photo_url text,
  quote text,
  video_type text check (video_type in ('vimeo','video')),
  video_url text,
  video_poster_url text,
  project_id uuid references public.portfolio_projects(id) on delete set null,
  service_label text,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;
grant all on public.testimonials to service_role;
alter table public.testimonials enable row level security;
create policy "Public reads published testimonials" on public.testimonials for select to anon, authenticated using (status = 'published');
create policy "CMS admins read testimonials" on public.testimonials for select to authenticated using (private.is_cms_admin());
create policy "CMS admins insert testimonials" on public.testimonials for insert to authenticated with check (private.is_cms_admin());
create policy "CMS admins update testimonials" on public.testimonials for update to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin());
create policy "CMS admins delete testimonials" on public.testimonials for delete to authenticated using (private.is_cms_admin());
create index testimonials_public_idx on public.testimonials (status, kind, sort_order);

insert into public.page_sections (page_id, section_type, eyebrow, title, body, sort_order, is_visible, config)
select id, 'client_stories', 'CLIENT STORIES', E'What People Say\nAbout Working With Branta.',
  'Real experiences from clients we''ve worked with across creative, AI and technology.', 35, true,
  '{"video_eyebrow":"VIDEO STORIES","video_body":"Hear directly from the people we''ve worked with.","speed":48}'::jsonb
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages p on p.id = s.page_id where p.slug='home' and s.section_type='client_stories');