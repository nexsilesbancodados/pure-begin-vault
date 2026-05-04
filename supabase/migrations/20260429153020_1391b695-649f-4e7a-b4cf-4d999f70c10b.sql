CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id UUID)
RETURNS void AS $$
DECLARE
    stage_count INTEGER;
BEGIN
    SELECT count(*) INTO stage_count FROM public.funnel_stages WHERE user_id = _user_id;
    
    IF stage_count = 0 THEN
        INSERT INTO public.funnel_stages (user_id, name, color, order_index)
        VALUES 
            (_user_id, 'Entrada de Leads', '#3B82F6', 1),
            (_user_id, 'Qualificação', '#F59E0B', 2),
            (_user_id, 'Reunião Agendada', '#8B5CF6', 3),
            (_user_id, 'Proposta Enviada', '#EC4899', 4),
            (_user_id, 'Negociação', '#10B981', 5),
            (_user_id, 'Fechado (Ganha)', '#22C55E', 6),
            (_user_id, 'Perdido', '#EF4444', 7);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
