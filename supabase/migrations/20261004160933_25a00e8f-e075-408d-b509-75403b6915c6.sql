ALTER TABLE public.portfolio_projects ADD COLUMN IF NOT EXISTS cover_position text NOT NULL DEFAULT 'center';
ALTER TABLE public.portfolio_projects DROP CONSTRAINT IF EXISTS portfolio_projects_cover_position_check;
ALTER TABLE public.portfolio_projects ADD CONSTRAINT portfolio_projects_cover_position_check CHECK (cover_position IN ('center','top','bottom','left','right'));