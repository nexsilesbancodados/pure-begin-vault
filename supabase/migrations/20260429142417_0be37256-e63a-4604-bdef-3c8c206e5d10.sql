-- Função para garantir que o usuário tenha estágios no funil
CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id UUID)
RETURNS void AS $$
DECLARE
    stage_count INTEGER;
BEGIN
    SELECT count(*) INTO stage_count FROM public.funnel_stages WHERE user_id = _user_id;
    
    IF stage_count = 0 THEN
        INSERT INTO public.funnel_stages (user_id, name, color, order_index)
        VALUES 
            (_user_id, 'Novo Contato', '#3B82F6', 1),
            (_user_id, 'Em Atendimento', '#F59E0B', 2),
            (_user_id, 'Proposta', '#10B981', 3),
            (_user_id, 'Fechado', '#6366F1', 4);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função do gatilho para criar leads e deals a partir de conversas
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_phone TEXT;
BEGIN
    -- Normaliza o telefone
    v_phone := regexp_replace(NEW.contact_phone, '\D', '', 'g');
    
    -- Garante que o usuário tem estágios
    PERFORM public.ensure_default_funnel_stages(NEW.user_id);
    
    -- Busca ou cria o lead
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE user_id = NEW.user_id 
    AND (regexp_replace(phone, '\D', '', 'g') = v_phone OR phone = NEW.contact_phone)
    LIMIT 1;
    
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status)
        VALUES (NEW.user_id, COALESCE(NEW.contact_name, 'Lead WhatsApp ' || v_phone), NEW.contact_phone, 'whatsapp', 'new')
        RETURNING id INTO v_lead_id;
    END IF;
    
    -- Busca o primeiro estágio do funil desse usuário
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE user_id = NEW.user_id 
    ORDER BY order_index ASC 
    LIMIT 1;
    
    -- Se não achou do usuário, tenta um estágio global (user_id IS NULL)
    IF v_stage_id IS NULL THEN
        SELECT id INTO v_stage_id FROM public.funnel_stages WHERE user_id IS NULL ORDER BY order_index ASC LIMIT 1;
    END IF;
    
    -- Cria o card no funil se não existir
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id AND user_id = NEW.user_id) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
        VALUES (NEW.user_id, v_lead_id, v_stage_id, 0, 'medium');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o gatilho
DROP TRIGGER IF EXISTS tr_new_bot_conversation ON public.bot_conversations;
CREATE TRIGGER tr_new_bot_conversation
AFTER INSERT OR UPDATE OF transcript ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_bot_conversation();

-- Backfill: Criar cards para conversas existentes que não têm card
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT * FROM public.bot_conversations LOOP
        -- O gatilho não dispara para registros antigos automaticamente, então chamamos a lógica manualmente para cada um
        INSERT INTO public.leads (user_id, name, phone, source, status)
        SELECT rec.user_id, COALESCE(rec.contact_name, 'Lead WhatsApp'), rec.contact_phone, 'whatsapp', 'new'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.leads 
            WHERE user_id = rec.user_id 
            AND (regexp_replace(phone, '\D', '', 'g') = regexp_replace(rec.contact_phone, '\D', '', 'g') OR phone = rec.contact_phone)
        );

        -- Cria pipeline lead
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
        SELECT 
            rec.user_id, 
            l.id, 
            (SELECT id FROM public.funnel_stages WHERE (user_id = rec.user_id OR user_id IS NULL) ORDER BY order_index LIMIT 1),
            0,
            'medium'
        FROM public.leads l
        WHERE l.user_id = rec.user_id 
        AND (regexp_replace(l.phone, '\D', '', 'g') = regexp_replace(rec.contact_phone, '\D', '', 'g') OR l.phone = rec.contact_phone)
        AND NOT EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.lead_id = l.id AND pl.user_id = rec.user_id);
    END LOOP;
END;
$$;
