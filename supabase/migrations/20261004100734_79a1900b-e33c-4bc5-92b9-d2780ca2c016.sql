insert into public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, cta_label, cta_url, config)
select id, 'automation_showcase', 70, true, 'AI AUTOMATION', E'Make the Work Happen\nWithout Doing It Twice.',
 'We connect your tools, automate repetitive workflows and build AI-powered systems around the way your business actually operates.',
 'Explore Automation', '/services/ai-automation',
 '{
  "default_key": "sales",
  "outcomes": ["Fewer manual tasks","Faster response","Cleaner data","Connected teams"],
  "use_cases": [
   {"key":"sales","label":"Sales Automation","description":"Capture, qualify, assign and follow up with leads automatically.","outcome":"Every lead is answered, qualified and booked without manual chasing.",
    "nodes":[{"label":"Lead","kind":"input"},{"label":"AI qualification","kind":"ai"},{"label":"CRM","kind":"system"},{"label":"Sales assignment","kind":"action"},{"label":"Follow-up","kind":"action"},{"label":"Meeting","kind":"result"}]},
   {"key":"marketing","label":"Marketing Automation","description":"Connect campaigns, audiences and follow-ups into one automated system.","outcome":"Campaigns, audiences and reporting stay in sync on their own.",
    "nodes":[{"label":"Campaign","kind":"input"},{"label":"Lead capture","kind":"input"},{"label":"Audience segmentation","kind":"ai"},{"label":"Personalized messaging","kind":"action"},{"label":"CRM","kind":"system"},{"label":"Reporting","kind":"result"}]},
   {"key":"support","label":"Customer Support","description":"Handle common questions instantly and route complex issues to the right person.","outcome":"Customers get fast answers; people handle only what needs them.",
    "nodes":[{"label":"Customer message","kind":"input"},{"label":"AI assistant","kind":"ai"},{"label":"Knowledge base","kind":"system"},{"label":"Resolution","kind":"action"},{"label":"Human escalation if needed","kind":"action"},{"label":"Support log","kind":"result"}]},
   {"key":"operations","label":"Internal Operations","description":"Reduce repetitive admin work and keep teams synchronized automatically.","outcome":"Requests move from intake to approval without re-typing anything.",
    "nodes":[{"label":"Request","kind":"input"},{"label":"Validation","kind":"ai"},{"label":"Database update","kind":"system"},{"label":"Team notification","kind":"action"},{"label":"Approval","kind":"action"},{"label":"Report","kind":"result"}]}
  ]}'::jsonb
from public.site_pages where slug = 'home'
and not exists (select 1 from public.page_sections s join public.site_pages sp on sp.id = s.page_id where sp.slug='home' and s.section_type='automation_showcase');