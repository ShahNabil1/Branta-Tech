create or replace function private.is_sales_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('super_admin','admin','sales'))
$$;
revoke all on function private.is_sales_admin() from public, anon;
grant execute on function private.is_sales_admin() to authenticated, service_role;

alter table public.profiles add column if not exists company text;
create policy "Sales read profiles" on public.profiles for select to authenticated using (private.is_sales_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, company)
  values (new.id, new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    left(new.raw_user_meta_data ->> 'phone', 40),
    left(new.raw_user_meta_data ->> 'company', 120))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where user_id = new.id) then
    insert into public.user_roles (user_id, role) values (new.id, 'client') on conflict do nothing;
  end if;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.ensure_client_profile()
returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); e text;
begin
  if u is null then return; end if;
  select email into e from auth.users where id = u;
  insert into public.profiles (id, email) values (u, e) on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where user_id = u) then
    insert into public.user_roles (user_id, role) values (u, 'client') on conflict do nothing;
  end if;
end; $$;
revoke all on function public.ensure_client_profile() from public, anon;
grant execute on function public.ensure_client_profile() to authenticated;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid references auth.users(id) on delete set null,
  name text not null, email text not null, phone text, company text, website text,
  service_interest text[] not null default '{}',
  project_summary text not null,
  budget_range text, timeline text,
  reference_links text[] not null default '{}',
  attachment_path text, attachment_name text,
  status text not null default 'new' check (status in ('new','contacted','qualified','proposal','won','lost','archived')),
  source text not null default 'start_a_project',
  assigned_to uuid references auth.users(id) on delete set null,
  internal_notes text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "Sales read leads" on public.leads for select to authenticated using (private.is_sales_admin());
create policy "Sales update leads" on public.leads for update to authenticated using (private.is_sales_admin()) with check (private.is_sales_admin());
create policy "Sales delete leads" on public.leads for delete to authenticated using (private.is_sales_admin());
create trigger leads_updated_at before update on public.leads for each row execute function public.touch_updated_at();
create index leads_created_idx on public.leads (created_at desc);
create index leads_client_idx on public.leads (client_user_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid references auth.users(id) on delete set null,
  name text not null, email text not null, phone text, company text,
  topic text not null,
  requested_start_at timestamptz not null,
  timezone text not null,
  notes text,
  status text not null default 'requested' check (status in ('requested','confirmed','reschedule_requested','completed','cancelled','no_show')),
  internal_notes text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "Sales read bookings" on public.bookings for select to authenticated using (private.is_sales_admin());
create policy "Sales update bookings" on public.bookings for update to authenticated using (private.is_sales_admin()) with check (private.is_sales_admin());
create policy "Sales delete bookings" on public.bookings for delete to authenticated using (private.is_sales_admin());
create trigger bookings_updated_at before update on public.bookings for each row execute function public.touch_updated_at();
create index bookings_client_idx on public.bookings (client_user_id);

create or replace function public.my_requests()
returns table (id uuid, created_at timestamptz, service_interest text[], project_summary text, status text)
language sql stable security definer set search_path = public as $$
  select id, created_at, service_interest, left(project_summary, 280), status
  from public.leads where client_user_id = auth.uid() order by created_at desc
$$;
create or replace function public.my_bookings()
returns table (id uuid, created_at timestamptz, topic text, requested_start_at timestamptz, timezone text, status text)
language sql stable security definer set search_path = public as $$
  select id, created_at, topic, requested_start_at, timezone, status
  from public.bookings where client_user_id = auth.uid() order by requested_start_at desc
$$;
revoke all on function public.my_requests() from public, anon;
revoke all on function public.my_bookings() from public, anon;
grant execute on function public.my_requests() to authenticated;
grant execute on function public.my_bookings() to authenticated;

create or replace function public.list_sales_staff()
returns table (id uuid, full_name text, email text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.full_name, p.email from public.profiles p
  join public.user_roles r on r.user_id = p.id
  where r.role in ('super_admin','admin','sales') and private.is_sales_admin()
$$;
revoke all on function public.list_sales_staff() from public, anon;
grant execute on function public.list_sales_staff() to authenticated;

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text,
  storage_path text not null unique,
  file_name text not null, mime_type text, file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_files to authenticated;
grant all on public.client_files to service_role;
alter table public.client_files enable row level security;
create policy "Clients read own files" on public.client_files for select to authenticated using (client_user_id = auth.uid() or private.is_sales_admin());
create policy "Sales add files" on public.client_files for insert to authenticated with check (private.is_sales_admin() and uploaded_by = auth.uid());
create policy "Sales update files" on public.client_files for update to authenticated using (private.is_sales_admin()) with check (private.is_sales_admin());
create policy "Sales delete files" on public.client_files for delete to authenticated using (private.is_sales_admin());

create policy "client-private read" on storage.objects for select to authenticated using (
  bucket_id = 'client-private' and (private.is_sales_admin() or ((storage.foldername(name))[1] = 'files' and (storage.foldername(name))[2] = auth.uid()::text)));
create policy "client-private sales insert" on storage.objects for insert to authenticated with check (bucket_id = 'client-private' and private.is_sales_admin());
create policy "client-private sales delete" on storage.objects for delete to authenticated using (bucket_id = 'client-private' and private.is_sales_admin());

insert into public.user_roles (user_id, role)
select p.id, 'client' from public.profiles p where not exists (select 1 from public.user_roles r where r.user_id = p.id)
on conflict do nothing;