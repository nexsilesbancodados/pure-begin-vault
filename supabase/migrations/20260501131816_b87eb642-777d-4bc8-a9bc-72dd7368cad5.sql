ALTER TABLE public.business_goals 
ADD COLUMN goal_type TEXT DEFAULT 'revenue' CHECK (goal_type IN ('revenue', 'units', 'profit'));

COMMENT ON COLUMN public.business_goals.goal_type IS 'Type of the goal: revenue (Faturamento), units (Aparelhos vendidos), or profit (Lucro)';