-- Redefine a função de forma correta e segura
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

    -- 4. Insere a última mensagem se houver
    IF NEW.transcript IS NOT NULL AND jsonb_array_length(NEW.transcript) > 0 THEN
        v_last_msg := NEW.transcript -> -1;
        
        INSERT INTO public.messages (
            user_id, 
            lead_id, 
            content, 
            direction, 
            created_at
        )
        VALUES (
            NEW.user_id, 
            v_lead_id, 
            v_last_msg->>'content', 
            CASE WHEN v_last_msg->>'role' = 'user' THEN 'inbound' ELSE 'outbound' END,
            COALESCE((v_last_msg->>'at')::timestamp with time zone, now())
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill: Processa conversas existentes
UPDATE public.bot_conversations SET status = status;
