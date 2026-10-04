create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Self-only admin check: no target-user argument, so it can't be used to probe other accounts.
create or replace function private.is_cms_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin','admin')
  )
$$;
revoke all on function private.is_cms_admin() from public, anon;
grant execute on function private.is_cms_admin() to authenticated, service_role;

-- Trusted server-only check of any user's role (service role only).
create or replace function private.has_role(_user_id uuid, _role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function private.has_role(uuid, text) from public, anon, authenticated;
grant execute on function private.has_role(uuid, text) to service_role;

-- Repoint policies
alter policy "Users read own roles" on public.user_roles using (user_id = auth.uid() or private.is_cms_admin());
alter policy "Users read own profile" on public.profiles using (id = auth.uid() or private.is_cms_admin());
alter policy "Users update own profile" on public.profiles using (id = auth.uid() or private.is_cms_admin()) with check (id = auth.uid() or private.is_cms_admin());

alter policy "Admins manage settings" on public.site_settings using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads published pages" on public.site_pages using (status = 'published' or private.is_cms_admin());
alter policy "Admins manage pages" on public.site_pages using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads visible sections of published pages" on public.page_sections using (
  private.is_cms_admin() or (is_visible and exists (select 1 from public.site_pages p where p.id = page_id and p.status = 'published')));
alter policy "Admins manage sections" on public.page_sections using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads published groups" on public.service_groups using (status = 'published' or private.is_cms_admin());
alter policy "Admins manage groups" on public.service_groups using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads published services" on public.services using (status = 'published' or private.is_cms_admin());
alter policy "Admins manage services" on public.services using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads published categories" on public.portfolio_categories using (status = 'published' or private.is_cms_admin());
alter policy "Admins manage categories" on public.portfolio_categories using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads published projects" on public.portfolio_projects using (status = 'published' or private.is_cms_admin());
alter policy "Admins manage projects" on public.portfolio_projects using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads links of published projects" on public.portfolio_project_services using (
  private.is_cms_admin() or exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published'));
alter policy "Admins manage project services" on public.portfolio_project_services using (private.is_cms_admin()) with check (private.is_cms_admin());
alter policy "Public reads media of published projects" on public.portfolio_media using (
  private.is_cms_admin() or exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published'));
alter policy "Admins manage project media" on public.portfolio_media using (private.is_cms_admin()) with check (private.is_cms_admin());

alter policy "Admins upload site-public" on storage.objects with check (bucket_id = 'site-public' and private.is_cms_admin());
alter policy "Admins update site-public" on storage.objects using (bucket_id = 'site-public' and private.is_cms_admin()) with check (bucket_id = 'site-public' and private.is_cms_admin());
alter policy "Admins delete site-public" on storage.objects using (bucket_id = 'site-public' and private.is_cms_admin());

-- Profile field protection now uses the self-only check
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_cms_admin() then
    new.status := old.status;
    new.email := old.email;
    new.id := old.id;
  end if;
  return new;
end; $$;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;

-- Remove the exposed helpers
drop function public.has_role(uuid, text);
drop function public.is_cms_admin(uuid);