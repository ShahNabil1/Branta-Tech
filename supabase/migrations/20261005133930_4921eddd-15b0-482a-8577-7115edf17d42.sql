DELETE FROM public.page_sections WHERE id IN (
'f5316d51-db22-4b75-bd35-c71bf0697f2e','7669115b-dee0-4191-b95d-91561eb425a2','2550805a-f76d-48ae-be95-28a9e0046cc4',
'4a8b145a-cf99-40b0-84df-90d5136b92d3','b3b8728b-762b-4437-9014-23909656e09b','59f817a1-328f-4d28-9dca-ab1eeeb18c86',
'13e987dd-7b9f-4789-bba0-166e8ac98287','68796e89-dff2-4531-995c-a15e8e8ae136','aaf5e9a3-b1b1-44da-afb4-8f91752aa88e')
AND section_type IN ('featured_work','ai_film_showcase','ai_image_showcase','web_software_showcase','automation_showcase','process','insights_teaser','careers_teaser','final_cta');