-- Função para processar a sincronização de conversas com o funil
CREATE OR REPLACE FUNCTION public.sync_conversation_to_funnel()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_last_msg JSONB;
BEGIN
    -- 1. Tenta encontrar ou criar o Lead
    INSERT INTO public.leads (user_id, phone, name, source)
    VALUES (NEW.user_id, NEW.contact_phone, COALESCE(NEW.contact_name, 'WhatsApp Lead'), 'whatsapp')
    ON CONFLICT (user_id, phone) DO UPDATE 
    SET name = COALESCE(EXCLUDED.name, leads.name),
        updated_at = now()
    RETURNING id INTO v_lead_id;

    -- 2. Encontra o primeiro estágio do funil para este usuário (ou o padrão)
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE (user_id = NEW.user_id OR user_id IS NULL)
    ORDER BY order_index ASC 
    LIMIT 1;

    -- 3. Garante que existe um card no funil (pipeline_leads)
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value)
    VALUES (NEW.user_id, v_lead_id, v_stage_id, 0)
    ON CONFLICT (user_id, lead_id) DO NOTHING;

    -- 4. Pega a última mensagem do transcript para inserir na tabela de mensagens se necessário
    -- Isso garante que o histórico apareça no Kanban/CRM
    IF NEW.transcript IS NOT NULL AND jsonb_array_length(NEW.transcript) > 0 THEN
        v_last_msg := NEW.transcript -> -1;
        
        INSERT INTO public.messages (
            user_id, 
            lead_id, 
            content, 
            direction, 
            created_at,
            payload
        )
        VALUES (
            NEW.user_id, 
            v_lead_id, 
            v_last_msg->>'content', 
            CASE WHEN v_last_msg->>'role' = 'user' THEN 'inbound' ELSE 'outbound' END,
            COALESCE((v_last_msg->>'at')::timestamp with time zone, now()),
            v_last_msg
        )
        ON CONFLICT DO NOTHING; -- Nota: Sem ID externo único aqui, usamos o timestamps ou deixamos apenas para histórico
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para bot_conversations
DROP TRIGGER IF EXISTS tr_sync_bot_conversation ON public.bot_conversations;
CREATE TRIGGER tr_sync_bot_conversation
AFTER INSERT OR UPDATE ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.sync_conversation_to_funnel();

-- Correção de índices e restrições para evitar duplicatas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_user_id_phone_key') THEN
        ALTER TABLE public.leads ADD CONSTRAINT leads_user_id_phone_key UNIQUE (user_id, phone);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_leads_user_id_lead_id_key') THEN
        ALTER TABLE public.pipeline_leads ADD CONSTRAINT pipeline_leads_user_id_lead_id_key UNIQUE (user_id, lead_id);
    END IF;
END $$;
