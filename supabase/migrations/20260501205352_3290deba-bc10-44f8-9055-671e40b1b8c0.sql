-- Melhora a função de gatilho para garantir o vínculo com a instância ativa
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    -- Busca o ID do usuário (já deve vir no NEW.user_id, mas garantimos)
    v_user_id := NEW.user_id;

    -- Tenta encontrar um lead existente pelo telefone e usuário
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE user_id = v_user_id 
    AND (phone = NEW.contact_phone OR phone LIKE '%' || NEW.contact_phone);

    -- Se não existir, cria o lead
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source)
        VALUES (v_user_id, COALESCE(NEW.contact_name, 'Lead WhatsApp'), NEW.contact_phone, 'whatsapp')
        RETURNING id INTO v_lead_id;
    END IF;

    -- Busca o ID da primeira etapa do funil para este usuário (ou a padrão)
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE user_id = v_user_id OR user_id IS NULL 
    ORDER BY order_index ASC 
    LIMIT 1;

    -- Se tivermos lead e etapa, garantimos que ele está no pipeline_leads vinculado à instância
    IF v_lead_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
        VALUES (v_user_id, v_lead_id, v_stage_id, NEW.instance_name)
        ON CONFLICT (lead_id) DO UPDATE 
        SET instance_name = EXCLUDED.instance_name,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
