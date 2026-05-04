-- Add missing updated_at column to funnel_stages
ALTER TABLE public.funnel_stages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update the RPC function for future users
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing stages for the current user to the new names/colors
-- We try to map old names to new ones to avoid data loss
UPDATE public.funnel_stages SET name = 'Entrada de Leads', color = '#3B82F6', updated_at = now() WHERE name = 'Novo Contato' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET name = 'Qualificação', color = '#F59E0B', updated_at = now() WHERE name = 'Em Atendimento' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET name = 'Proposta Enviada', color = '#EC4899', updated_at = now() WHERE name = 'Proposta' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET name = 'Fechado (Ganha)', color = '#22C55E', updated_at = now() WHERE name = 'Fechado' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';

-- Add missing stages for the current user
INSERT INTO public.funnel_stages (user_id, name, color, order_index)
SELECT '133da88b-f929-4891-a1a7-50a8abb69554', 'Reunião Agendada', '#8B5CF6', 3
WHERE NOT EXISTS (SELECT 1 FROM public.funnel_stages WHERE user_id = '133da88b-f929-4891-a1a7-50a8abb69554' AND name = 'Reunião Agendada');

INSERT INTO public.funnel_stages (user_id, name, color, order_index)
SELECT '133da88b-f929-4891-a1a7-50a8abb69554', 'Negociação', '#10B981', 5
WHERE NOT EXISTS (SELECT 1 FROM public.funnel_stages WHERE user_id = '133da88b-f929-4891-a1a7-50a8abb69554' AND name = 'Negociação');

INSERT INTO public.funnel_stages (user_id, name, color, order_index)
SELECT '133da88b-f929-4891-a1a7-50a8abb69554', 'Perdido', '#EF4444', 7
WHERE NOT EXISTS (SELECT 1 FROM public.funnel_stages WHERE user_id = '133da88b-f929-4891-a1a7-50a8abb69554' AND name = 'Perdido');

-- Fix order indexes
UPDATE public.funnel_stages SET order_index = 1 WHERE name = 'Entrada de Leads' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET order_index = 2 WHERE name = 'Qualificação' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET order_index = 3 WHERE name = 'Reunião Agendada' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET order_index = 4 WHERE name = 'Proposta Enviada' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET order_index = 5 WHERE name = 'Negociação' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET order_index = 6 WHERE name = 'Fechado (Ganha)' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
UPDATE public.funnel_stages SET order_index = 7 WHERE name = 'Perdido' AND user_id = '133da88b-f929-4891-a1a7-50a8abb69554';
