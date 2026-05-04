-- Função para processar novas conversas do WhatsApp e integrá-las ao Funil
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_first_stage_name TEXT := 'Novo Contato';
BEGIN
    -- 1. Tenta encontrar um lead existente pelo telefone e usuário
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE phone = NEW.contact_phone AND user_id = NEW.user_id 
    LIMIT 1;

    -- 2. Se o lead não existir, cria um novo
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status)
        VALUES (NEW.user_id, COALESCE(NEW.contact_name, 'Lead WhatsApp'), NEW.contact_phone, 'whatsapp', 'new')
        RETURNING id INTO v_lead_id;
    END IF;

    -- 3. Busca o ID do primeiro estágio do funil (ou cria se não existir)
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE (user_id = NEW.user_id OR user_id IS NULL)
    ORDER BY order_index ASC 
    LIMIT 1;

    -- Caso não existam estágios (raro), cria o padrão
    IF v_stage_id IS NULL THEN
        INSERT INTO public.funnel_stages (name, order_index, color)
        VALUES (v_first_stage_name, 1, '#3b82f6')
        RETURNING id INTO v_stage_id;
    END IF;

    -- 4. Garante que exista um registro na tabela pipeline_leads para este lead
    -- Usamos INSERT IGNORE conceitual via ON CONFLICT ou NOT EXISTS
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
        VALUES (NEW.user_id, v_lead_id, v_stage_id, 0, 'medium');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove gatilho antigo se existir para evitar duplicidade
DROP TRIGGER IF EXISTS on_bot_conversation_created ON public.bot_conversations;

-- Aplica o gatilho para novas conversas e atualizações (caso o nome do contato mude)
CREATE TRIGGER on_bot_conversation_created
AFTER INSERT OR UPDATE ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_bot_conversation();

-- Sincronização retroativa: Processa todas as conversas existentes
DO $$
DECLARE
    rec RECORD;
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    FOR rec IN SELECT * FROM public.bot_conversations LOOP
        -- Busca ou Cria Lead
        SELECT id INTO v_lead_id FROM public.leads WHERE phone = rec.contact_phone AND user_id = rec.user_id LIMIT 1;
        
        IF v_lead_id IS NULL THEN
            INSERT INTO public.leads (user_id, name, phone, source, status)
            VALUES (rec.user_id, COALESCE(rec.contact_name, 'Lead WhatsApp'), rec.contact_phone, 'whatsapp', 'new')
            RETURNING id INTO v_lead_id;
        END IF;

        -- Busca Estágio
        SELECT id INTO v_stage_id FROM public.funnel_stages WHERE (user_id = rec.user_id OR user_id IS NULL) ORDER BY order_index LIMIT 1;

        -- Cria Negócio se não existir
        IF v_lead_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
                INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
                VALUES (rec.user_id, v_lead_id, v_stage_id, 0, 'medium');
            END IF;
        END IF;
    END LOOP;
END $$;