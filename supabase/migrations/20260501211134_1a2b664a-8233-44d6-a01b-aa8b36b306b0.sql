CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
    _user_id uuid, 
    _phone text, 
    _name text DEFAULT NULL::text, 
    _instance_name text DEFAULT NULL::text, 
    _avatar_url text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_normalized_phone TEXT;
BEGIN
    -- Normalizar telefone
    v_normalized_phone := REGEXP_REPLACE(_phone, '\D', '', 'g');

    -- Tentar encontrar lead existente
    SELECT id INTO v_lead_id FROM public.leads 
    WHERE user_id = _user_id AND (phone = v_normalized_phone OR phone = _phone);

    -- Se não existir, criar lead
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status, avatar_url)
        VALUES (_user_id, COALESCE(_name, 'Contato WhatsApp'), v_normalized_phone, 'whatsapp', 'active', _avatar_url)
        RETURNING id INTO v_lead_id;
    ELSE
        -- Se já existe, atualizar nome e avatar caso tenham mudado/vindo novos do WhatsApp
        UPDATE public.leads 
        SET 
            name = COALESCE(_name, name),
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
$function$;