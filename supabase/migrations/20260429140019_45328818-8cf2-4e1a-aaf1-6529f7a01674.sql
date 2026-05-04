-- Atualiza a função de gatilho para ser mais robusta e garantir a criação de negociações
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    -- 1. Busca lead existente por telefone e usuário
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE user_id = NEW.user_id AND phone = NEW.contact_phone
    LIMIT 1;

    -- 2. Cria lead se não existir
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status)
        VALUES (NEW.user_id, COALESCE(NEW.contact_name, NEW.contact_phone), NEW.contact_phone, 'whatsapp', 'new')
        RETURNING id INTO v_lead_id;
    END IF;

    -- 3. Pega o primeiro estágio (prioriza os do usuário, depois sistema)
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE (user_id = NEW.user_id OR user_id IS NULL)
    ORDER BY (user_id IS NOT NULL) DESC, order_index ASC 
    LIMIT 1;

    -- 4. Cria negociação no pipeline se lead e estágio existirem e ainda não houver uma
    IF v_lead_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
            INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
            VALUES (NEW.user_id, v_lead_id, v_stage_id, 0, 'medium');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronização Retroativa: Garante que conversas atuais sem cards no funil sejam criadas
DO $$
DECLARE
    r RECORD;
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    FOR r IN SELECT * FROM public.bot_conversations LOOP
        -- Busca ou cria lead
        SELECT id INTO v_lead_id FROM public.leads WHERE user_id = r.user_id AND phone = r.contact_phone LIMIT 1;
        
        IF v_lead_id IS NULL THEN
            INSERT INTO public.leads (user_id, name, phone, source, status)
            VALUES (r.user_id, COALESCE(r.contact_name, r.contact_phone), r.contact_phone, 'whatsapp', 'new')
            RETURNING id INTO v_lead_id;
        END IF;

        -- Pega estágio inicial
        SELECT id INTO v_stage_id 
        FROM public.funnel_stages 
        WHERE (user_id = r.user_id OR user_id IS NULL)
        ORDER BY (user_id IS NOT NULL) DESC, order_index ASC 
        LIMIT 1;

        -- Cria card no funil se não existir
        IF v_lead_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
                INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
                VALUES (r.user_id, v_lead_id, v_stage_id, 0, 'medium');
            END IF;
        END IF;
    END LOOP;
END $$;
