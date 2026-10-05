create or replace function public.my_applications_full()
returns table(id uuid, job_title text, job_slug text, department text, employment_type text, location text, work_mode text, submitted_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select a.id, j.title, j.slug, j.department, j.employment_type, j.location, j.work_mode, a.submitted_at, a.status
  from public.job_applications a join public.jobs j on j.id = a.job_id
  where a.applicant_user_id = auth.uid() order by a.submitted_at desc
$$;
create or replace function public.my_application_extra(_id uuid)
returns table(department text, job_location text, work_mode text, answers jsonb, extra jsonb)
language sql stable security definer set search_path = public as $$
  select j.department, j.location, j.work_mode, a.answers, a.extra
  from public.job_applications a join public.jobs j on j.id = a.job_id
  where a.id = _id and a.applicant_user_id = auth.uid()
$$;
revoke all on function public.my_applications_full() from public, anon;
revoke all on function public.my_application_extra(uuid) from public, anon;
grant execute on function public.my_applications_full() to authenticated;
grant execute on function public.my_application_extra(uuid) to authenticated;