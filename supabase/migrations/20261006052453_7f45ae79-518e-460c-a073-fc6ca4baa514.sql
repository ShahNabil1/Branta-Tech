alter table public.pricing_quote_requests
  add column if not exists chat_conversation_id uuid references public.chat_conversations(id) on delete set null,
  add column if not exists follow_up_at date,
  add column if not exists follow_up_assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists follow_up_status text not null default 'none' check (follow_up_status in ('none','pending','done')),
  add column if not exists follow_up_note text;
create index if not exists pqr_follow_up_idx on public.pricing_quote_requests(follow_up_status, follow_up_at);
create index if not exists pqr_lead_idx on public.pricing_quote_requests(lead_id);

alter table public.bookings add column if not exists quote_request_id uuid references public.pricing_quote_requests(id) on delete set null;

create table public.pricing_quote_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  video_type_slug text,
  scope text, deliverables text, revisions integer, delivery_timeline text, payment_terms text, conditions text,
  charge_presets jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pricing_quote_templates to authenticated;
grant all on public.pricing_quote_templates to service_role;
alter table public.pricing_quote_templates enable row level security;
create policy "Sales manage quote templates" on public.pricing_quote_templates for all to authenticated
  using (private.is_sales_admin()) with check (private.is_sales_admin());
create trigger set_updated_at before update on public.pricing_quote_templates for each row execute function public.set_updated_at();
insert into public.pricing_quote_templates (name, video_type_slug, sort_order) values
 ('AI Motion','ai-motion',1),('AI Product Video','ai-product-video',2),('AI Commercial','ai-commercial',3),
 ('AI OVC','ai-ovc',4),('AI TVC','ai-tvc',5),('AI UGC','ai-ugc',6),('Custom Production',null,7);

create table public.pricing_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('calculator_start','quote_modal_open')),
  ip_hash text,
  created_at timestamptz not null default now()
);
grant select on public.pricing_events to authenticated;
grant all on public.pricing_events to service_role;
alter table public.pricing_events enable row level security;
create policy "Sales read pricing events" on public.pricing_events for select to authenticated using (private.is_sales_admin());
create index pricing_events_idx on public.pricing_events(event, created_at);

create or replace function private.reconcile_quote_expiry()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with due as (
    select distinct r.id, v.version from public.pricing_quote_requests r
    join public.pricing_quote_versions v on v.quote_id = r.id and v.status = 'issued' and v.customer_response is null and v.token_revoked_at is null
    where r.status = 'quoted' and v.valid_until is not null and v.valid_until < (now() at time zone 'Asia/Dhaka')::date
  ), upd as (
    update public.pricing_quote_requests r set status = 'expired', status_changed_at = now()
    from due where r.id = due.id and r.status = 'quoted' returning r.id, due.version
  ), act as (
    insert into public.pricing_quote_activity (quote_id, actor_type, kind, detail)
    select id, 'system', 'quote_expired', jsonb_build_object('version', version, 'source', 'scheduler') from upd returning 1
  )
  select count(*) into n from act;
  return n;
end $$;
revoke all on function private.reconcile_quote_expiry() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('branta-quote-expiry', '15 18 * * *', $$select private.reconcile_quote_expiry()$$);