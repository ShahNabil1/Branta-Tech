create table public.applicant_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  photo_path text check (photo_path is null or length(photo_path) <= 300),
  current_location text check (length(current_location) <= 120),
  institute text check (length(institute) <= 160),
  study_department text check (length(study_department) <= 160),
  study_status text check (study_status in ('studying','final_year','graduated','not_studying')),
  graduation_year smallint check (graduation_year between 1960 and 2100),
  semester text check (length(semester) <= 40),
  short_bio text check (length(short_bio) <= 1000),
  linkedin_url text check (length(linkedin_url) <= 300),
  portfolio_url text check (length(portfolio_url) <= 300),
  behance_url text check (length(behance_url) <= 300),
  github_url text check (length(github_url) <= 300),
  website_url text check (length(website_url) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.applicant_profiles to authenticated;
grant all on public.applicant_profiles to service_role;
alter table public.applicant_profiles enable row level security;
create policy "Applicants read own profile" on public.applicant_profiles for select to authenticated using (user_id = auth.uid());
create policy "Applicants create own profile" on public.applicant_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Applicants update own profile" on public.applicant_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger applicant_profiles_updated_at before update on public.applicant_profiles
  for each row execute function public.set_updated_at();

create policy "Applicants read own media" on storage.objects for select to authenticated
  using (bucket_id = 'applicant-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Applicants upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'applicant-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Applicants update own media" on storage.objects for update to authenticated
  using (bucket_id = 'applicant-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Applicants delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'applicant-media' and (storage.foldername(name))[1] = auth.uid()::text);