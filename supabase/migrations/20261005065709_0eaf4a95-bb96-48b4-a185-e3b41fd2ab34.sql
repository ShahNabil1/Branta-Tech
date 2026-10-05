alter table public.jobs
  add column if not exists urgent boolean not null default false,
  add column if not exists job_code text check (job_code is null or length(job_code) <= 60),
  add column if not exists vacancies integer check (vacancies is null or vacancies between 1 and 999),
  add column if not exists open_at timestamptz,
  add column if not exists deadline_at timestamptz,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists seo jsonb not null default '{}'::jsonb;

alter table public.job_applications
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists extra jsonb not null default '{}'::jsonb,
  add column if not exists eligibility_passed boolean;

alter table public.job_applications drop constraint job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check
  check (status = any (array['new','reviewing','shortlisted','interview','assignment','selected','offer','hired','rejected','withdrawn']));

create table public.job_slug_redirects (
  old_slug text primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select on public.job_slug_redirects to anon, authenticated;
grant all on public.job_slug_redirects to service_role;
alter table public.job_slug_redirects enable row level security;
create policy "Anyone can read job redirects" on public.job_slug_redirects for select to anon, authenticated using (true);
create policy "Staff manage job redirects" on public.job_slug_redirects for all to authenticated using (private.is_hr_admin()) with check (private.is_hr_admin());

create or replace function public.jobs_track_slug_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug and old.published_at is not null then
    insert into public.job_slug_redirects(old_slug, job_id) values (old.slug, new.id)
      on conflict (old_slug) do update set job_id = excluded.job_id;
  end if;
  delete from public.job_slug_redirects where old_slug = new.slug;
  return new;
end $$;
revoke execute on function public.jobs_track_slug_change() from public, anon, authenticated;
create trigger jobs_slug_redirect after update of slug on public.jobs for each row execute function public.jobs_track_slug_change();