insert into public.page_sections (page_id, section_type, eyebrow, title, body, config, is_visible, sort_order)
select p.id, 'pricing_notes', 'PRICING NOTES', 'About your estimate', null,
  jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('title','This is an estimate','body','The calculator gives an estimated price based on your selections.','enabled',true),
    jsonb_build_object('title','Custom work may cost more','body','Custom production may require additional charges.','enabled',true),
    jsonb_build_object('title','Final quote needs approval','body','Final scope and quote require approval by our team.','enabled',true),
    jsonb_build_object('title','Revisions and deliverables','body','Revisions and deliverables depend on the selected package.','enabled',true))),
  true, 90
from public.site_pages p
where p.slug = 'pricing' and not exists (select 1 from public.page_sections s where s.page_id = p.id and s.section_type = 'pricing_notes');