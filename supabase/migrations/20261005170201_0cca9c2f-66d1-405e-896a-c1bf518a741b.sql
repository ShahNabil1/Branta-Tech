alter table public.chat_visitors
  add column if not exists source_page text,
  add column if not exists referrer text,
  add column if not exists lead_completed_at timestamptz,
  add column if not exists first_conversation_id uuid references public.chat_conversations(id) on delete set null;

create table public.chat_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event text not null check (event in ('widget_opened','lead_started','name_completed','whatsapp_completed','email_completed','lead_completed','chat_started')),
  visitor_id uuid references public.chat_visitors(id) on delete cascade,
  ip_hash text,
  created_at timestamptz not null default now()
);
grant select on public.chat_funnel_events to authenticated;
grant all on public.chat_funnel_events to service_role;
alter table public.chat_funnel_events enable row level security;
create policy "Chat agents read funnel" on public.chat_funnel_events for select to authenticated using (private.is_chat_agent());
create index chat_funnel_events_event_idx on public.chat_funnel_events(event, created_at);
create index chat_funnel_events_ip_idx on public.chat_funnel_events(ip_hash, created_at);