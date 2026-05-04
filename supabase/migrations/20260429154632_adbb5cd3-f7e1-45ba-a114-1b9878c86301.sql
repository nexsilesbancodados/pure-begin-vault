-- 1. Primeiro criar a função auxiliar para não dar erro de ordem
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation_retroactive(conv_id UUID)
RETURNS VOID AS $$
DECLARE
    v_conv RECORD;
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    SELECT * INTO v_conv FROM public.bot_conversations WHERE id = conv_id;
    
    -- Tentar encontrar ou criar o lead
    SELECT id INTO v_lead_id FROM public.leads 
    WHERE (phone = v_conv.contact_phone OR phone = '+' || v_conv.contact_phone)
    AND user_id = v_conv.user_id 
    LIMIT 1;

    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status)
        VALUES (v_conv.user_id, COALESCE(v_conv.contact_name, 'Lead WhatsApp'), v_conv.contact_phone, 'whatsapp', 'new')
        RETURNING id INTO v_lead_id;
    END IF;

    -- Encontrar a etapa 'Entrada de Leads' ou a primeira
    SELECT id INTO v_stage_id FROM public.funnel_stages 
    WHERE user_id = v_conv.user_id 
    ORDER BY order_index ASC 
    LIMIT 1;

    IF v_stage_id IS NULL THEN
        SELECT id INTO v_stage_id FROM public.funnel_stages 
        WHERE user_id IS NULL 
        ORDER BY order_index ASC 
        LIMIT 1;
    END IF;

    -- Inserir se não existir
    IF NOT EXISTS (
        SELECT 1 FROM public.pipeline_leads 
        WHERE lead_id = v_lead_id AND user_id = v_conv.user_id
    ) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
        VALUES (v_conv.user_id, v_lead_id, v_stage_id, 0, 'medium');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar a função principal do gatilho
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.handle_new_bot_conversation_retroactive(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar o gatilho
DROP TRIGGER IF EXISTS tr_new_bot_conversation ON public.bot_conversations;
CREATE TRIGGER tr_new_bot_conversation
AFTER INSERT ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_bot_conversation();

-- 4. Executar sincronização retroativa
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.bot_conversations LOOP
        PERFORM public.handle_new_bot_conversation_retroactive(r.id);
    END LOOP;
END;
$$;
