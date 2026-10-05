create or replace function private.is_chat_agent()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('super_admin','admin','sales','content_manager'))
$$;
revoke all on function private.is_chat_agent() from public, anon;
grant execute on function private.is_chat_agent() to authenticated, service_role;

create table public.chat_visitors (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  name text, email text, whatsapp text,
  ip_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.chat_visitors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','waiting_for_agent','human_active','closed')),
  mode text not null default 'assistant' check (mode in ('assistant','human')),
  assigned_agent_id uuid references auth.users(id) on delete set null,
  handoff_topic text,
  interested_service text,
  booking_id uuid references public.bookings(id) on delete set null,
  source_page text,
  channel_key uuid not null default gen_random_uuid(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_conversations_status_idx on public.chat_conversations (status, last_message_at desc);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor','assistant','agent','system')),
  sender_id uuid,
  message text not null default '' check (char_length(message) <= 4000),
  message_type text not null default 'text' check (message_type in ('text','quick_replies','service_card','portfolio_card','booking','contact_form','system')),
  payload jsonb,
  intent_key text,
  created_at timestamptz not null default now()
);
create index chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);
create table public.chat_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  status text not null default 'offline' check (status in ('online','busy','offline')),
  updated_at timestamptz not null default now()
);
create table public.chat_intents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  answer text not null default '',
  answer_bn text,
  follow_up text,
  service_id uuid references public.services(id) on delete set null,
  category_id uuid references public.portfolio_categories(id) on delete set null,
  quick_replies jsonb not null default '[]'::jsonb,
  ctas jsonb not null default '[]'::jsonb,
  action text,
  priority integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chat_intent_phrases (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.chat_intents(id) on delete cascade,
  phrase text not null check (char_length(phrase) between 1 and 200),
  lang text not null default 'en' check (lang in ('en','bn','banglish')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.chat_quick_actions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  action_type text not null check (action_type in ('intent','message','link','booking','human','portfolio')),
  target text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chat_unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  normalized_question text not null unique,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  count integer not null default 1,
  last_asked_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_intent_id uuid references public.chat_intents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Visitors never touch these tables directly: all guest traffic goes through server functions.
grant select, insert, update, delete on public.chat_visitors, public.chat_conversations, public.chat_messages, public.chat_agents,
  public.chat_intents, public.chat_intent_phrases, public.chat_quick_actions, public.chat_unanswered_questions to authenticated;
grant all on public.chat_visitors, public.chat_conversations, public.chat_messages, public.chat_agents,
  public.chat_intents, public.chat_intent_phrases, public.chat_quick_actions, public.chat_unanswered_questions to service_role;

alter table public.chat_visitors enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_agents enable row level security;
alter table public.chat_intents enable row level security;
alter table public.chat_intent_phrases enable row level security;
alter table public.chat_quick_actions enable row level security;
alter table public.chat_unanswered_questions enable row level security;

create policy "Agents read visitors" on public.chat_visitors for select to authenticated using (private.is_chat_agent());
create policy "Agents update visitors" on public.chat_visitors for update to authenticated using (private.is_chat_agent()) with check (private.is_chat_agent());
create policy "Agents read conversations" on public.chat_conversations for select to authenticated using (private.is_chat_agent());
create policy "Agents update conversations" on public.chat_conversations for update to authenticated using (private.is_chat_agent()) with check (private.is_chat_agent());
create policy "Agents read messages" on public.chat_messages for select to authenticated using (private.is_chat_agent());
create policy "Agents send messages" on public.chat_messages for insert to authenticated
  with check (private.is_chat_agent() and sender_id = auth.uid() and sender_type in ('agent','system'));
create policy "Agents read agents" on public.chat_agents for select to authenticated using (private.is_chat_agent());
create policy "Agents manage own status" on public.chat_agents for insert to authenticated with check (private.is_chat_agent() and user_id = auth.uid());
create policy "Agents update own status" on public.chat_agents for update to authenticated using (private.is_chat_agent() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Agents manage intents" on public.chat_intents for all to authenticated using (private.is_chat_agent()) with check (private.is_chat_agent());
create policy "Agents manage phrases" on public.chat_intent_phrases for all to authenticated using (private.is_chat_agent()) with check (private.is_chat_agent());
create policy "Agents manage quick actions" on public.chat_quick_actions for all to authenticated using (private.is_chat_agent()) with check (private.is_chat_agent());
create policy "Agents manage unanswered" on public.chat_unanswered_questions for all to authenticated using (private.is_chat_agent()) with check (private.is_chat_agent());

create trigger chat_conversations_updated_at before update on public.chat_conversations for each row execute function public.set_updated_at();
create trigger chat_intents_updated_at before update on public.chat_intents for each row execute function public.set_updated_at();
create trigger chat_quick_actions_updated_at before update on public.chat_quick_actions for each row execute function public.set_updated_at();

create or replace function public.chat_touch_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.chat_conversations set last_message_at = new.created_at where id = new.conversation_id; return new; end $$;
revoke all on function public.chat_touch_conversation() from public, anon, authenticated;
create trigger chat_messages_touch after insert on public.chat_messages for each row execute function public.chat_touch_conversation();

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_conversations;

-- Starter knowledge (editable in Control Centre). No prices, clients or availability are stated.
insert into public.chat_intents (key, name, answer, answer_bn, follow_up, quick_replies, action, priority) values
 ('greeting','Greeting','Hi. What are you looking to create?','হ্যালো। আপনি কী তৈরি করতে চান?',null,'["AI Commercial","Website","Software","Book a Call"]',null,1),
 ('service_ai_commercial','AI Commercial','Branta creates AI commercials, product films and campaign videos for brands.','Branta ব্র্যান্ডের জন্য AI কমার্শিয়াল, প্রোডাক্ট ভিডিও ও ক্যাম্পেইন ভিডিও তৈরি করে।','What would you like to promote?','["View AI Commercial work","Book a Call","Talk to a Human"]',null,5),
 ('service_ai_photography','AI Photography','Branta produces AI product photography and campaign visuals.','Branta AI প্রোডাক্ট ফটোগ্রাফি ও ক্যাম্পেইন ভিজ্যুয়াল তৈরি করে।','What products do you need visuals for?','["View Work","Book a Call"]',null,5),
 ('service_brand','Brand & Creative','Branta designs brand identities, social content and campaign creative.','Branta ব্র্যান্ড আইডেন্টিটি, সোশ্যাল কনটেন্ট ও ক্যাম্পেইন ক্রিয়েটিভ ডিজাইন করে।','Is this a new brand or a refresh?','["View Work","Book a Call"]',null,5),
 ('service_website','Website','Yes. Branta designs and develops websites, e-commerce platforms and custom digital products.','হ্যাঁ। Branta ওয়েবসাইট, ই-কমার্স ও কাস্টম ডিজিটাল প্রোডাক্ট ডিজাইন ও ডেভেলপ করে।','What are you looking to build?','["Company Website","E-commerce","Landing Page","Custom Web App","Book a Call"]',null,5),
 ('service_software','Software','Branta builds custom software, SaaS products and internal tools.','Branta কাস্টম সফটওয়্যার, SaaS প্রোডাক্ট ও ইন্টারনাল টুল তৈরি করে।','What problem should the software solve?','["Book a Call","Talk to a Human"]',null,5),
 ('service_automation','AI Automation','Branta designs AI automation and workflow systems that save teams time.','Branta AI অটোমেশন ও ওয়ার্কফ্লো সিস্টেম তৈরি করে।','Which process would you like to automate?','["Book a Call","Talk to a Human"]',null,5),
 ('portfolio_request','Portfolio','Here is some selected work.','এখানে আমাদের কিছু কাজ দেখুন।',null,'["Book a Call","Talk to a Human"]','portfolio',4),
 ('pricing_request','Pricing','Pricing depends on scope, so every project gets a custom quote. A short call is the fastest way to get one.','প্রজেক্টের পরিসর অনুযায়ী দাম নির্ধারণ হয়। একটি ছোট কলে দ্রুত কোট পাওয়া যায়।',null,'["Book a Call","Talk to a Human"]',null,4),
 ('booking_request','Book a Call','Let''s book a call.','চলুন একটি কল বুক করি।',null,'[]','booking',6),
 ('human_request','Talk to a Human','I can connect you with the Branta team.','আমি আপনাকে Branta টিমের সাথে যুক্ত করতে পারি।',null,'[]','human',10),
 ('careers_request','Careers','You can see open roles and apply on our Careers page.','খোলা পদ ও আবেদন Careers পেজে দেখুন।',null,'[]',null,3),
 ('contact_request','Contact','You can book a call, start a project, or talk to our team here.','আপনি কল বুক করতে, প্রজেক্ট শুরু করতে বা টিমের সাথে কথা বলতে পারেন।',null,'["Book a Call","Talk to a Human"]',null,3);

update public.chat_intents set ctas = '[{"label":"Open Careers","url":"/careers"}]' where key = 'careers_request';
update public.chat_intents set ctas = '[{"label":"Start a Project","url":"/start-a-project"}]' where key = 'contact_request';

insert into public.chat_intent_phrases (intent_id, phrase, lang)
select i.id, p.phrase, p.lang from public.chat_intents i join (values
 ('greeting','hi','en'),('greeting','hello','en'),('greeting','hey','en'),('greeting','assalamu alaikum','banglish'),('greeting','salam','banglish'),('greeting','হ্যালো','bn'),('greeting','আসসালামু আলাইকুম','bn'),
 ('service_ai_commercial','ai commercial','en'),('service_ai_commercial','ai video','en'),('service_ai_commercial','product video','en'),('service_ai_commercial','video ad','en'),('service_ai_commercial','tvc','en'),('service_ai_commercial','commercial','en'),('service_ai_commercial','ad video','en'),('service_ai_commercial','social media ad','en'),('service_ai_commercial','video lagbe','banglish'),('service_ai_commercial','ভিডিও','bn'),('service_ai_commercial','বিজ্ঞাপন','bn'),
 ('service_ai_photography','ai photography','en'),('service_ai_photography','product photo','en'),('service_ai_photography','product photoshoot','en'),('service_ai_photography','photoshoot','en'),('service_ai_photography','photo lagbe','banglish'),('service_ai_photography','ছবি','bn'),('service_ai_photography','ফটোশুট','bn'),
 ('service_brand','branding','en'),('service_brand','brand identity','en'),('service_brand','logo','en'),('service_brand','social media design','en'),('service_brand','social media post','en'),('service_brand','creative','en'),('service_brand','লোগো','bn'),('service_brand','ব্র্যান্ডিং','bn'),
 ('service_website','website','en'),('service_website','web development','en'),('service_website','company website','en'),('service_website','ecommerce website','en'),('service_website','e-commerce','en'),('service_website','landing page','en'),('service_website','custom website','en'),('service_website','need a website','en'),('service_website','do you make websites','en'),('service_website','website lagbe','banglish'),('service_website','web banabo','banglish'),('service_website','website বানাতে চাই','bn'),('service_website','web বানাবো','bn'),('service_website','ওয়েবসাইট','bn'),
 ('service_software','software','en'),('service_software','saas','en'),('service_software','app development','en'),('service_software','mobile app','en'),('service_software','web app','en'),('service_software','erp','en'),('service_software','crm','en'),('service_software','software lagbe','banglish'),('service_software','সফটওয়্যার','bn'),('service_software','অ্যাপ','bn'),
 ('service_automation','automation','en'),('service_automation','ai automation','en'),('service_automation','workflow','en'),('service_automation','chatbot','en'),('service_automation','automate','en'),('service_automation','অটোমেশন','bn'),
 ('portfolio_request','portfolio','en'),('portfolio_request','your work','en'),('portfolio_request','show me work','en'),('portfolio_request','case study','en'),('portfolio_request','projects','en'),('portfolio_request','view work','en'),('portfolio_request','kaj dekhan','banglish'),('portfolio_request','কাজ দেখান','bn'),('portfolio_request','পোর্টফোলিও','bn'),
 ('pricing_request','price','en'),('pricing_request','pricing','en'),('pricing_request','cost','en'),('pricing_request','how much','en'),('pricing_request','budget','en'),('pricing_request','quote','en'),('pricing_request','dam koto','banglish'),('pricing_request','koto taka','banglish'),('pricing_request','খরচ','bn'),('pricing_request','দাম','bn'),('pricing_request','কত টাকা','bn'),
 ('booking_request','book a call','en'),('booking_request','book call','en'),('booking_request','schedule a call','en'),('booking_request','meeting','en'),('booking_request','appointment','en'),('booking_request','call book','banglish'),('booking_request','মিটিং','bn'),('booking_request','কল বুক','bn'),
 ('human_request','talk to a human','en'),('human_request','human','en'),('human_request','real person','en'),('human_request','agent','en'),('human_request','employee','en'),('human_request','support','en'),('human_request','talk to team','en'),('human_request','support lagbe','banglish'),('human_request','মানুষের সাথে কথা বলতে চাই','bn'),('human_request','কাউকে কথা বলতে চাই','bn'),
 ('careers_request','job','en'),('careers_request','career','en'),('careers_request','hiring','en'),('careers_request','vacancy','en'),('careers_request','internship','en'),('careers_request','chakri','banglish'),('careers_request','চাকরি','bn'),
 ('contact_request','contact','en'),('contact_request','phone number','en'),('contact_request','email address','en'),('contact_request','office','en'),('contact_request','যোগাযোগ','bn')
) as p(key, phrase, lang) on p.key = i.key;

insert into public.chat_quick_actions (label, action_type, target, sort_order) values
 ('AI Commercial','intent','service_ai_commercial',10),('AI Photography','intent','service_ai_photography',20),
 ('Brand & Creative','intent','service_brand',30),('Website','intent','service_website',40),('Software','intent','service_software',50),
 ('AI Automation','intent','service_automation',60),('View Work','portfolio',null,70),('Book a Call','booking',null,80),('Talk to a Human','human',null,90);