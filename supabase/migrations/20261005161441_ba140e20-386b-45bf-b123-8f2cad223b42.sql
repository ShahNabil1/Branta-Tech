create table public.site_recognitions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'recognition' check (type in ('funding','award','champion','certification','recognition','partnership')),
  label text,
  title text,
  organization text not null,
  description text,
  year text,
  logo_url text,
  external_url text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.site_recognitions to anon;
grant select, insert, update, delete on public.site_recognitions to authenticated;
grant all on public.site_recognitions to service_role;
alter table public.site_recognitions enable row level security;
create policy "Public reads published recognitions" on public.site_recognitions for select to anon, authenticated using (is_published);
create policy "CMS admins read recognitions" on public.site_recognitions for select to authenticated using (private.is_cms_admin());
create policy "CMS admins insert recognitions" on public.site_recognitions for insert to authenticated with check (private.is_cms_admin());
create policy "CMS admins update recognitions" on public.site_recognitions for update to authenticated using (private.is_cms_admin()) with check (private.is_cms_admin());
create policy "CMS admins delete recognitions" on public.site_recognitions for delete to authenticated using (private.is_cms_admin());
create trigger site_recognitions_updated_at before update on public.site_recognitions for each row execute function public.set_updated_at();

insert into public.site_recognitions (type, organization, logo_url, sort_order, is_published) values
  ('funding', 'Bangladesh Hi-Tech Park Authority', '/media/branta/bhtpa-seed-logo.png', 10, true),
  ('champion', 'Open Lab Bangladesh', '/media/branta/open-lab-bangladesh-logo.png', 20, true);

insert into public.page_sections (page_id, section_type, eyebrow, title, body, cta_label, cta_url, sort_order, is_visible, config)
select id, 'recognition', 'RECOGNITION', E'Backed.\nRecognized.\nTrusted.',
  'Milestones, funding and recognition that mark Branta Tech’s journey across innovation, creative technology and digital growth.',
  'Explore Our Work', '/work', 37, true, '{}'::jsonb
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages p on p.id = s.page_id where p.slug='home' and s.section_type='recognition');