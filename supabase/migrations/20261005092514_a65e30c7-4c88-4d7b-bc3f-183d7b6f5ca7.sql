create table public.application_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  step smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
grant select, insert, update, delete on public.application_drafts to authenticated;
grant all on public.application_drafts to service_role;
alter table public.application_drafts enable row level security;
create policy "own drafts read" on public.application_drafts for select to authenticated using (user_id = auth.uid());
create policy "own drafts insert" on public.application_drafts for insert to authenticated with check (user_id = auth.uid());
create policy "own drafts update" on public.application_drafts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own drafts delete" on public.application_drafts for delete to authenticated using (user_id = auth.uid());
create trigger application_drafts_updated before update on public.application_drafts for each row execute function public.set_updated_at();