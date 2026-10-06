create table public.pricing_quote_requests (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  requester_user_id uuid references auth.users(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_name text not null check (length(customer_name) between 2 and 120),
  customer_email text not null check (length(customer_email) <= 200),
  customer_whatsapp text not null check (length(customer_whatsapp) <= 40),
  company_name text, project_description text, requested_deadline date,
  video_type_id uuid references public.pricing_video_types(id) on delete set null,
  ai_model_id uuid references public.pricing_ai_models(id) on delete set null,
  production_tier_id uuid references public.pricing_production_tiers(id) on delete set null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  selections jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('custom_quote_requested','new','reviewing','more_info_needed','quoted','accepted','declined','expired','cancelled')),
  estimated_price_minor bigint check (estimated_price_minor is null or estimated_price_minor >= 0),
  estimated_currency text not null default 'BDT',
  original_pricing_snapshot jsonb,
  pricing_version text,
  assigned_to uuid references auth.users(id) on delete set null,
  ip_hash text,
  status_changed_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.pricing_quote_requests (ip_hash, created_at);
create index on public.pricing_quote_requests (status, created_at desc);

create table public.pricing_quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.pricing_quote_requests(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','issued','superseded')),
  line_items jsonb not null default '[]'::jsonb,
  discount_type text not null default 'none' check (discount_type in ('none','fixed','percentage')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  tax_label text not null default 'VAT',
  tax_percentage numeric(6,3) not null default 0 check (tax_percentage >= 0 and tax_percentage <= 100),
  tax_inclusive boolean not null default false,
  currency text not null default 'BDT',
  subtotal_minor bigint not null default 0, discount_minor bigint not null default 0,
  tax_minor bigint not null default 0, total_minor bigint not null default 0 check (total_minor >= 0),
  scope text, deliverables text, revisions integer check (revisions is null or revisions >= 0),
  delivery_timeline text, payment_terms text, valid_until date, customer_notes text,
  access_token_hash text unique, token_revoked_at timestamptz,
  issued_at timestamptz, issued_by uuid references auth.users(id) on delete set null,
  customer_response text check (customer_response in ('accepted','declined','changes_requested')),
  responded_at timestamptz, response_note text, response_terms_accepted boolean,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (quote_id, version)
);

create table public.pricing_quote_activity (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.pricing_quote_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'staff' check (actor_type in ('staff','customer','system')),
  kind text not null, detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.pricing_quote_notes (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.pricing_quote_requests(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  note text not null check (length(note) between 1 and 5000),
  created_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.pricing_quote_requests for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pricing_quote_versions for each row execute function public.set_updated_at();

-- Issued versions are immutable: only supersede, token rotation/revocation and the customer response may change.
create or replace function public.pricing_quote_version_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('issued','superseded') then
    if new.line_items is distinct from old.line_items or new.discount_type is distinct from old.discount_type
      or new.discount_value is distinct from old.discount_value or new.tax_percentage is distinct from old.tax_percentage
      or new.tax_inclusive is distinct from old.tax_inclusive or new.total_minor is distinct from old.total_minor
      or new.subtotal_minor is distinct from old.subtotal_minor or new.discount_minor is distinct from old.discount_minor
      or new.tax_minor is distinct from old.tax_minor or new.scope is distinct from old.scope
      or new.deliverables is distinct from old.deliverables or new.revisions is distinct from old.revisions
      or new.delivery_timeline is distinct from old.delivery_timeline or new.payment_terms is distinct from old.payment_terms
      or new.valid_until is distinct from old.valid_until or new.customer_notes is distinct from old.customer_notes
      or new.version is distinct from old.version or new.quote_id is distinct from old.quote_id or new.issued_at is distinct from old.issued_at
      or (new.status = 'draft') then
      raise exception 'Issued quote versions cannot be edited; create a new version.' using errcode = '23514';
    end if;
    if old.customer_response is not null and (new.customer_response is distinct from old.customer_response or new.responded_at is distinct from old.responded_at) then
      raise exception 'Customer response already recorded.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger pricing_quote_version_guard before update on public.pricing_quote_versions for each row execute function public.pricing_quote_version_guard();
create or replace function public.pricing_quote_version_no_delete() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> 'draft' then raise exception 'Issued quote versions cannot be deleted.' using errcode = '23514'; end if;
  return old;
end $$;
create trigger pricing_quote_version_no_delete before delete on public.pricing_quote_versions for each row execute function public.pricing_quote_version_no_delete();

grant select, update on public.pricing_quote_requests to authenticated;
grant select, insert, update, delete on public.pricing_quote_versions to authenticated;
grant select, insert on public.pricing_quote_activity to authenticated;
grant select, insert, delete on public.pricing_quote_notes to authenticated;
grant all on public.pricing_quote_requests, public.pricing_quote_versions, public.pricing_quote_activity, public.pricing_quote_notes to service_role;
alter table public.pricing_quote_requests enable row level security;
alter table public.pricing_quote_versions enable row level security;
alter table public.pricing_quote_activity enable row level security;
alter table public.pricing_quote_notes enable row level security;

create policy "Sales read quotes" on public.pricing_quote_requests for select to authenticated using (private.is_sales_admin());
create policy "Sales update quotes" on public.pricing_quote_requests for update to authenticated using (private.is_sales_admin()) with check (private.is_sales_admin());
create policy "Sales read versions" on public.pricing_quote_versions for select to authenticated using (private.is_sales_admin());
create policy "Sales create versions" on public.pricing_quote_versions for insert to authenticated with check (private.is_sales_admin() and status = 'draft' and customer_response is null);
create policy "Sales update versions" on public.pricing_quote_versions for update to authenticated using (private.is_sales_admin()) with check (private.is_sales_admin());
create policy "Sales delete draft versions" on public.pricing_quote_versions for delete to authenticated using (private.is_sales_admin() and status = 'draft');
create policy "Sales read activity" on public.pricing_quote_activity for select to authenticated using (private.is_sales_admin());
create policy "Sales log activity" on public.pricing_quote_activity for insert to authenticated with check (private.is_sales_admin() and actor_type = 'staff' and actor_user_id = auth.uid());
create policy "Sales read notes" on public.pricing_quote_notes for select to authenticated using (private.is_sales_admin());
create policy "Sales add notes" on public.pricing_quote_notes for insert to authenticated with check (private.is_sales_admin() and author_user_id = auth.uid());
create policy "Authors delete own notes" on public.pricing_quote_notes for delete to authenticated using (private.is_sales_admin() and author_user_id = auth.uid());