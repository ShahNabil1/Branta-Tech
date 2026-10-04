alter table public.job_applications add column if not exists applicant_user_id uuid references auth.users(id) on delete set null;
alter table public.job_applications add column if not exists withdrawn_at timestamptz;
create unique index if not exists job_applications_one_active_per_applicant
  on public.job_applications (job_id, applicant_user_id)
  where applicant_user_id is not null and status <> 'withdrawn';

-- Applicant-facing reads: only the caller's own rows and only non-internal columns.
create or replace function public.my_applications()
returns table(id uuid, job_title text, job_slug text, employment_type text, submitted_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select a.id, j.title, j.slug, j.employment_type, a.submitted_at, a.status
  from public.job_applications a join public.jobs j on j.id = a.job_id
  where a.applicant_user_id = auth.uid()
  order by a.submitted_at desc
$$;
revoke all on function public.my_applications() from public, anon;
grant execute on function public.my_applications() to authenticated;

create or replace function public.my_application(_id uuid)
returns table(id uuid, job_title text, job_slug text, employment_type text, submitted_at timestamptz, status text,
  full_name text, email text, phone text, location text, portfolio_url text, linkedin_url text, cover_note text,
  has_resume boolean, withdrawn_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, j.title, j.slug, j.employment_type, a.submitted_at, a.status, a.full_name, a.email, a.phone, a.location,
    a.portfolio_url, a.linkedin_url, a.cover_note, a.resume_url is not null, a.withdrawn_at
  from public.job_applications a join public.jobs j on j.id = a.job_id
  where a.id = _id and a.applicant_user_id = auth.uid()
$$;
revoke all on function public.my_application(uuid) from public, anon;
grant execute on function public.my_application(uuid) to authenticated;

create or replace function public.withdraw_my_application(_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.job_applications set status = 'withdrawn', withdrawn_at = now()
  where id = _id and applicant_user_id = auth.uid() and status not in ('withdrawn','hired','rejected');
  get diagnostics n = row_count;
  return n > 0;
end; $$;
revoke all on function public.withdraw_my_application(uuid) from public, anon;
grant execute on function public.withdraw_my_application(uuid) to authenticated;