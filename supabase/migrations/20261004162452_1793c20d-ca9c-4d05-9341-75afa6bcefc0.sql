alter table public.team_members
  add column if not exists department text,
  add column if not exists leadership_level smallint not null default 2 check (leadership_level between 0 and 2),
  add column if not exists manager_id uuid references public.team_members(id) on delete set null,
  add constraint team_members_not_self_manager check (manager_id is null or manager_id <> id);
create index if not exists team_members_manager_idx on public.team_members(manager_id);
grant select (department, leadership_level, manager_id) on public.team_members to anon;