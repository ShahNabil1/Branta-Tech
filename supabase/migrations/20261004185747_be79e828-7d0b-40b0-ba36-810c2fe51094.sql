create table public.job_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  scheduled_at timestamptz not null,
  timezone text not null default 'Asia/Dhaka' check (char_length(timezone) <= 60),
  interview_type text not null default 'video' check (interview_type in ('video','phone','in_person')),
  meeting_url text check (meeting_url is null or (char_length(meeting_url) <= 500 and meeting_url ~ '^https://')),
  location text check (char_length(location) <= 200),
  public_notes text check (char_length(public_notes) <= 2000),
  internal_notes text check (char_length(internal_notes) <= 4000),
  status text not null default 'scheduled' check (status in ('scheduled','rescheduled','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_interviews_application_idx on public.job_interviews(application_id);
grant select, insert, update, delete on public.job_interviews to authenticated;
grant all on public.job_interviews to service_role;
alter table public.job_interviews enable row level security;
create policy "HR manages interviews" on public.job_interviews for all to authenticated using (private.is_hr_admin()) with check (private.is_hr_admin());
create trigger job_interviews_updated_at before update on public.job_interviews for each row execute function public.set_updated_at();

-- Applicants read only public fields of interviews on their own applications.
create or replace function public.my_interviews()
returns table(id uuid, application_id uuid, job_title text, scheduled_at timestamptz, timezone text, interview_type text, meeting_url text, location text, public_notes text, status text)
language sql stable security definer set search_path = public as $$
  select i.id, i.application_id, j.title, i.scheduled_at, i.timezone, i.interview_type,
         case when i.status = 'cancelled' then null else i.meeting_url end,
         i.location, i.public_notes, i.status
  from public.job_interviews i
  join public.job_applications a on a.id = i.application_id
  join public.jobs j on j.id = a.job_id
  where a.applicant_user_id = auth.uid() and a.status <> 'withdrawn'
  order by i.scheduled_at desc
$$;
revoke all on function public.my_interviews() from public, anon;
grant execute on function public.my_interviews() to authenticated;