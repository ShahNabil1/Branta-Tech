drop policy "Public reads published jobs" on public.jobs;
create policy "Public reads published jobs" on public.jobs for select to anon, authenticated using (status = 'published');
create policy "HR reads all jobs" on public.jobs for select to authenticated using (private.is_hr_admin());