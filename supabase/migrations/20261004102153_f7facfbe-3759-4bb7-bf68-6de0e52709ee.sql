insert into public.page_sections (page_id, section_type, sort_order, is_visible, eyebrow, title, body, cta_label, cta_url, config)
select sp.id, v.t, v.o, true, v.e, v.ti, v.b, v.cl, v.cu, v.c::jsonb
from public.site_pages sp,
(values
 ('process', 80, 'HOW WE WORK', 'From Brief to Launch.', 'A simple, collaborative process designed to move from idea to finished work without unnecessary layers.', null, null,
  '{"steps":[{"title":"Discover","body":"Understand the goal, audience, business context and what success should look like."},{"title":"Direction","body":"Define the creative, technical or automation direction before production starts."},{"title":"Create","body":"Design, produce, build or automate the solution."},{"title":"Refine","body":"Review, test and improve the work with focused feedback."},{"title":"Launch","body":"Deliver the final output, publish the experience or deploy the system."}]}'),
 ('client_logos', 90, 'SELECTED CLIENTS', 'Built With Ambitious Brands.', null, null, null, '{"logos":[]}'),
 ('insights_teaser', 100, 'INSIGHTS', 'Ideas, Experiments and What We Learn.', 'Thoughts on AI, creative production, digital products and automation from the Branta team.', 'View Insights', '/insights', '{"max_items":3}'),
 ('careers_teaser', 110, 'CAREERS', 'Build What Comes Next With Us.', 'We work across creative, AI, design, software and automation. If you want to build ambitious work with a fast-moving team, we want to hear from you.', 'Explore Careers', '/careers', '{}'),
 ('final_cta', 120, null, E'Have an Idea?\nBring It.', 'Tell us what you want to create, build or automate.', 'Start a Project', '/contact', '{"secondary_cta_label":"Book a Call","secondary_cta_url":"/book-a-call"}')
) as v(t,o,e,ti,b,cl,cu,c)
where sp.slug = 'home'
and not exists (select 1 from public.page_sections s where s.page_id = sp.id and s.section_type = v.t);