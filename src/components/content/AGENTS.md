# Content rules
- Public /team renders a single org chart (buildOrg in src/components/content/TeamStructure.tsx) from manager_id + department + leadership_level only; each person appears once and unlinked members fall under "Other Team Members" — never infer reporting lines from job titles.
