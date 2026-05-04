-- Primeiro, vamos atualizar a função que o webhook chama
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
    _user_id UUID, 
    _phone TEXT, 
    _name TEXT, 
    _instance_name TEXT DEFAULT NULL, 
    _avatar_url TEXT DEFAULT NULL
)
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
    
    -- Limpar nome: descartar IDs internos do WhatsApp
    v_clean_name := CASE 
        WHEN _name IS NOT NULL 
             AND _name <> '' 
             AND _name <> _phone 
             AND _name <> v_normalized_phone 
             AND _name !~ '^[a-zA-Z0-9]{15,}$'
             AND _name !~ '^\d+$'
             AND _name !~ '[a-f0-9]{8}-[a-f0-9]{4}'
             AND _name !~* '@g\.us'
             AND _name !~* 'cmonb'
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
        -- Atualizar avatar se fornecido
        IF _avatar_url IS NOT NULL THEN
            UPDATE public.leads SET avatar_url = _avatar_url WHERE id = v_lead_id;
        END IF;

        -- Se já existe, atualizar nome se tivermos um nome LIMPO e VÁLIDO
        IF v_clean_name IS NOT NULL AND (
            v_current_name LIKE 'Lead WhatsApp%' OR 
            v_current_name LIKE 'cmonb%' OR
            v_current_name = 'Contato WhatsApp' OR 
            v_current_name IS NULL OR 
            v_current_name = '' OR
            (v_current_name <> v_clean_name AND LENGTH(v_clean_name) > 2)
        ) THEN
            UPDATE public.leads SET name = v_clean_name WHERE id = v_lead_id;
        END IF;
    END IF;

    -- Pegar a etapa inicial do funil padrão do usuário
    -- (O sistema usa pipeline_leads e funnel_stages)
    SELECT id INTO v_stage_id FROM public.funnel_stages 
    WHERE user_id = _user_id 
    ORDER BY order_index ASC 
    LIMIT 1;

    -- Se não houver etapa, não podemos criar o card ainda
    IF v_stage_id IS NOT NULL THEN
        -- Verificar se já existe um card aberto para este lead
        -- Importante: estamos usando pipeline_leads
        IF NOT EXISTS (
            SELECT 1 FROM public.pipeline_leads 
            WHERE lead_id = v_lead_id AND user_id = _user_id
        ) THEN
            INSERT INTO public.pipeline_leads (
                user_id, 
                lead_id, 
                stage_id, 
                instance_name, 
                priority
            )
            VALUES (
                _user_id, 
                v_lead_id, 
                v_stage_id, 
                _instance_name,
                'medium'
            );
        ELSE
            -- Se o card já existe, apenas atualiza a instância se for nova
            UPDATE public.pipeline_leads 
            SET instance_name = COALESCE(instance_name, _instance_name),
                updated_at = now()
            WHERE lead_id = v_lead_id AND user_id = _user_id;
        END IF;
    END IF;
END;
$function$;
