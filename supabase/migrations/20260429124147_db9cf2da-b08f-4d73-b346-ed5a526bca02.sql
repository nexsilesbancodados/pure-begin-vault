CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id UUID)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.funnel_stages WHERE user_id = _user_id OR user_id IS NULL) THEN
        INSERT INTO public.funnel_stages (user_id, name, color, order_index)
        VALUES 
            (_user_id, 'Lead', '#3b82f6', 1),
            (_user_id, 'Contato', '#f59e0b', 2),
            (_user_id, 'Proposta', '#8b5cf6', 3),
            (_user_id, 'Negociação', '#ec4899', 4),
            (_user_id, 'Fechado', '#10b981', 5);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.pipeline_leads ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE public.pipeline_leads ALTER COLUMN deal_value SET DEFAULT 0;
