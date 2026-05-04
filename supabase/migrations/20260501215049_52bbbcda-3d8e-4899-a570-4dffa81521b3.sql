CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(_user_id uuid, _phone text, _name text, _instance_name text, _avatar_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_normalized_phone TEXT;
    v_clean_name TEXT;
    v_current_name TEXT;
BEGIN
    -- Normalizar telefone (apenas números)
    v_normalized_phone := REGEXP_REPLACE(_phone, '\D', '', 'g');
    
    -- Limpar nome: descartar IDs internos do WhatsApp (contêm números ou são hashes longos sem espaços)
    -- Ou nomes que são idênticos ao telefone
    v_clean_name := CASE 
        WHEN _name IS NOT NULL 
             AND _name <> '' 
             AND _name <> _phone 
             AND _name <> v_normalized_phone 
             AND _name !~ '^[a-zA-Z0-9]{15,}$' -- Descarta IDs longos alfanuméricos
             AND _name !~ '^\d+$'              -- Descarta se for apenas números (como ID)
        THEN _name 
        ELSE NULL 
    END;

    -- Tentar encontrar lead existente pelo telefone (normalizado ou original)
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
        -- Se já existe, atualizar nome apenas se tivermos um nome LIMPO e VÁLIDO
        -- que seja melhor do que o atual (especialmente se o atual for o padrão "Lead WhatsApp...")
        IF v_clean_name IS NOT NULL AND (
            v_current_name LIKE 'Lead WhatsApp%' OR 
            v_current_name = 'Contato WhatsApp' OR 
            v_current_name IS NULL OR 
            v_current_name = '' OR
            v_current_name <> v_clean_name
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
        VALUES (_user_id, 'Novos Leads', '#9b87f5', 0)
        RETURNING id INTO v_stage_id;
    END IF;

    -- Verificar se já existe no pipeline_leads
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
        VALUES (_user_id, v_lead_id, v_stage_id, _instance_name);
    ELSE
        -- Se já existe, garante que a instância está preenchida
        UPDATE public.pipeline_leads 
        SET instance_name = COALESCE(_instance_name, instance_name)
        WHERE lead_id = v_lead_id;
    END IF;
END;
$function$
;