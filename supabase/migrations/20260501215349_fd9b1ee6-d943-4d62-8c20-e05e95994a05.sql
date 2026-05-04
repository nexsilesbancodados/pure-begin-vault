CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
    _user_id UUID,
    _phone TEXT,
    _name TEXT,
    _instance_name TEXT,
    _avatar_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_normalized_phone TEXT;
    v_clean_name TEXT;
    v_current_name TEXT;
BEGIN
    -- Normalizar telefone (apenas números)
    v_normalized_phone := REGEXP_REPLACE(_phone, '\D', '', 'g');
    
    -- Limpar nome: descartar IDs internos do WhatsApp, nomes "bugados" e lixo técnico
    v_clean_name := CASE 
        WHEN _name IS NOT NULL 
             AND _name <> '' 
             AND _name <> _phone 
             AND _name <> v_normalized_phone 
             AND _name !~ '^[a-zA-Z0-9]{15,}$'           -- Descarta IDs longos alfanuméricos (ex: hashes)
             AND _name !~ '^\d+$'                        -- Descarta se for apenas números (como ID)
             AND _name !~ '[a-f0-9]{8}-[a-f0-9]{4}'      -- Descarta UUIDs parciais
             AND _name !~* '@g\.us'                      -- Descarta referências a grupos
             AND _name !~* 'cmonb'                       -- Descarta IDs que começam com cmonb (visto no log)
        THEN _name 
        ELSE NULL 
    END;

    -- Tentar encontrar lead existente pelo telefone
    SELECT id, name INTO v_lead_id, v_current_name FROM public.leads 
    WHERE user_id = _user_id AND (phone = v_normalized_phone OR phone = _phone)
    LIMIT 1;

    -- Se não existir, criar lead
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status, avatar_url)
        VALUES (
            _user_id, 
            COALESCE(v_clean_name, 'Lead WhatsApp ' || v_normalized_phone), 
            v_normalized_phone, 
            'whatsapp', 
            'active', 
            _avatar_url
        )
        RETURNING id INTO v_lead_id;
    ELSE
        -- Se já existe, atualizar nome se tivermos um nome LIMPO e VÁLIDO
        -- Prioriza nomes reais sobre o padrão "Lead WhatsApp..." ou nomes bugados conhecidos
        IF v_clean_name IS NOT NULL AND (
            v_current_name LIKE 'Lead WhatsApp%' OR 
            v_current_name LIKE 'cmonb%' OR
            v_current_name = 'Contato WhatsApp' OR 
            v_current_name IS NULL OR 
            v_current_name = '' OR
            (v_current_name <> v_clean_name AND LENGTH(v_clean_name) > 2)
        ) THEN
            UPDATE public.leads 
            SET 
                name = v_clean_name,
                avatar_url = COALESCE(_avatar_url, avatar_url),
                updated_at = now()
            WHERE id = v_lead_id;
        ELSIF _avatar_url IS NOT NULL THEN
            UPDATE public.leads 
            SET avatar_url = _avatar_url, updated_at = now()
            WHERE id = v_lead_id;
        END IF;
    END IF;

    -- Tentar encontrar o primeiro estágio do funil para o usuário
    SELECT id INTO v_stage_id FROM public.funnel_stages 
    WHERE user_id = _user_id 
    ORDER BY order_index ASC LIMIT 1;

    -- Se não houver estágios, criar um padrão
    IF v_stage_id IS NULL THEN
        INSERT INTO public.funnel_stages (user_id, name, color, order_index)
        VALUES (_user_id, 'Entrada', '#9b87f5', 0)
        RETURNING id INTO v_stage_id;
    END IF;

    -- Garantir o Card no Pipeline (pipeline_leads)
    -- Usamos INSERT ... ON CONFLICT se houver restrição, ou verificação manual
    IF NOT EXISTS (
        SELECT 1 FROM public.pipeline_leads 
        WHERE user_id = _user_id AND lead_id = v_lead_id
    ) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name, deal_value)
        VALUES (_user_id, v_lead_id, v_stage_id, _instance_name, 0);
    ELSE
        -- Se já existe, garante que a instância está correta
        UPDATE public.pipeline_leads
        SET instance_name = COALESCE(_instance_name, instance_name),
            updated_at = now()
        WHERE user_id = _user_id AND lead_id = v_lead_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;