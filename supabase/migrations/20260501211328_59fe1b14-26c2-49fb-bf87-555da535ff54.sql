-- Drop all versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS public.ensure_lead_and_pipeline_from_conversation(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ensure_lead_and_pipeline_from_conversation(uuid, text, text, text, text);

-- Create the updated version with _avatar_url support
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
    _user_id UUID,
    _phone TEXT,
    _name TEXT,
    _instance_name TEXT DEFAULT NULL,
    _avatar_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_normalized_phone TEXT;
BEGIN
    -- Normalizar telefone (apenas números)
    v_normalized_phone := REGEXP_REPLACE(_phone, '\D', '', 'g');

    -- Tentar encontrar lead existente pelo telefone (normalizado ou original)
    SELECT id INTO v_lead_id FROM public.leads 
    WHERE user_id = _user_id AND (phone = v_normalized_phone OR phone = _phone);

    -- Se não existir, criar lead
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status, avatar_url)
        VALUES (_user_id, COALESCE(_name, 'Contato WhatsApp'), v_normalized_phone, 'whatsapp', 'active', _avatar_url)
        RETURNING id INTO v_lead_id;
    ELSE
        -- Se já existe, atualizar nome e avatar caso tenham vindo do WhatsApp
        -- O COALESCE garante que não apagamos um nome já salvo se o novo vier nulo
        UPDATE public.leads 
        SET 
            name = CASE 
                WHEN _name IS NOT NULL AND _name <> '' AND (name LIKE 'Lead WhatsApp%' OR name = 'Contato WhatsApp' OR name IS NULL) THEN _name 
                ELSE name 
            END,
            avatar_url = COALESCE(_avatar_url, avatar_url),
            updated_at = now()
        WHERE id = v_lead_id;
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
$$ LANGUAGE plpgsql;