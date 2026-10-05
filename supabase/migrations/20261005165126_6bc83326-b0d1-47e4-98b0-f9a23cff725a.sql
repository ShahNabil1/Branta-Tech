alter table public.bookings
  add column if not exists service_group_id uuid references public.service_groups(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null;

alter table public.chat_intents
  add column if not exists topic text not null default 'Other',
  add column if not exists question text,
  add column if not exists lang text not null default 'any' check (lang in ('any','en','bn','banglish')),
  add column if not exists service_group_id uuid references public.service_groups(id) on delete set null,
  add column if not exists suggested_actions jsonb not null default '[]'::jsonb,
  add column if not exists admin_notes text;

update public.chat_intents set topic = case
  when key like 'service_%' then 'Services' when key = 'pricing_request' then 'Pricing' when key = 'portfolio_request' then 'Portfolio'
  when key = 'booking_request' then 'Booking' when key = 'human_request' then 'Support' when key = 'careers_request' then 'Careers'
  when key = 'contact_request' then 'Company' else 'Other' end;
update public.chat_intents set suggested_actions = '["view_work","book_call"]' where key like 'service_%';