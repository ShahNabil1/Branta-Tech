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
    -- The signup portal only picks between the two non-staff roles; staff roles are never assignable here.
    insert into public.user_roles (user_id, role)
    values (new.id, case when new.raw_user_meta_data ->> 'signup_portal' = 'careers' then 'applicant' else 'client' end)
    on conflict do nothing;
  end if;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Adds the applicant role to the caller only; never touches staff accounts or removes roles.
create or replace function public.ensure_applicant_profile()
returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); e text;
begin
  if u is null then return; end if;
  select email into e from auth.users where id = u;
  insert into public.profiles (id, email) values (u, e) on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where user_id = u
                 and role in ('super_admin','admin','content_manager','sales','hr')) then
    insert into public.user_roles (user_id, role) values (u, 'applicant') on conflict do nothing;
  end if;
end; $$;
revoke all on function public.ensure_applicant_profile() from public, anon;
grant execute on function public.ensure_applicant_profile() to authenticated;