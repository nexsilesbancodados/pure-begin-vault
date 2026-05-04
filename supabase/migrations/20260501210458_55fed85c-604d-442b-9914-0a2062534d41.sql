-- Adicionar coluna avatar_url se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.leads ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Atualizar a função RPC para incluir avatar_url
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
    _user_id UUID,
    _phone TEXT,
    _name TEXT DEFAULT NULL,
    _instance_name TEXT DEFAULT NULL,
    _avatar_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_normalized_phone TEXT;
BEGIN
    -- Normalizar telefone
    v_normalized_phone := REGEXP_REPLACE(_phone, '\D', '', 'g');

    -- Tentar encontrar lead existente
    SELECT id INTO v_lead_id FROM public.leads 
    WHERE user_id = _user_id AND phone = v_normalized_phone;

    -- Se não existir, criar lead
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status, avatar_url)
        VALUES (_user_id, COALESCE(_name, 'Contato WhatsApp'), v_normalized_phone, 'whatsapp', 'active', _avatar_url)
        RETURNING id INTO v_lead_id;
    ELSE
        -- Se existir mas não tiver nome ou avatar, atualizar
        UPDATE public.leads 
        SET 
            name = COALESCE(NULLIF(name, 'Contato WhatsApp'), NULLIF(_name, 'Contato WhatsApp'), name),
            avatar_url = COALESCE(avatar_url, _avatar_url)
        WHERE id = v_lead_id;
    END IF;

    -- Garantir estágio padrão (Novo Lead)
    SELECT id INTO v_stage_id FROM public.funnel_stages 
    WHERE (user_id = _user_id OR user_id IS NULL) 
    ORDER BY order_index LIMIT 1;

    -- Garantir card no pipeline_leads
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, instance_name)
        VALUES (_user_id, v_lead_id, v_stage_id, 0, _instance_name);
    ELSE
        -- Garantir que a instância esteja correta no pipeline_leads
        UPDATE public.pipeline_leads 
        SET instance_name = COALESCE(instance_name, _instance_name)
        WHERE lead_id = v_lead_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar o gatilho de bot_conversations para capturar avatar_url se disponível no futuro ou melhorar a sincronização
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
BEGIN
    -- Chama a função de sincronização
    PERFORM public.ensure_lead_and_pipeline_from_conversation(
        NEW.user_id,
        NEW.contact_phone,
        NEW.contact_name,
        NEW.instance_name,
        NULL -- avatar_url ainda não está em bot_conversations, mas a estrutura está pronta
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
