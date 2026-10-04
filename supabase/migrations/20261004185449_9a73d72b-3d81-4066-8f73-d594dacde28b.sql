create table public.applicant_resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text not null check (char_length(file_name) <= 200),
  file_size integer not null,
  content_type text not null,
  uploaded_at timestamptz not null default now()
);
grant select on public.applicant_resumes to authenticated;
grant all on public.applicant_resumes to service_role;
alter table public.applicant_resumes enable row level security;
create policy "Applicants read own resume record" on public.applicant_resumes for select to authenticated using (auth.uid() = user_id);
create policy "HR reads applicant resume records" on public.applicant_resumes for select to authenticated using (private.is_hr_admin());