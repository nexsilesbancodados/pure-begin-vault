-- 1. Garante que a função principal de processamento exista e esteja correta
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    -- Busca lead existente por telefone e usuário
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE user_id = NEW.user_id AND phone = NEW.contact_phone
    LIMIT 1;

    -- Cria lead se não existir
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source)
        VALUES (NEW.user_id, COALESCE(NEW.contact_name, NEW.contact_phone), NEW.contact_phone, 'whatsapp')
        RETURNING id INTO v_lead_id;
    END IF;

    -- Pega o primeiro estágio (usuário ou sistema)
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE (user_id = NEW.user_id OR user_id IS NULL)
    ORDER BY (user_id IS NOT NULL) DESC, order_index ASC 
    LIMIT 1;

    -- Cria negociação no pipeline se lead e estágio existirem
    IF v_lead_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
            INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value)
            VALUES (NEW.user_id, v_lead_id, v_stage_id, 0);
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Ativa o gatilho para novas conversas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_new_bot_conversation') THEN
        CREATE TRIGGER on_new_bot_conversation
        AFTER INSERT ON public.bot_conversations
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_bot_conversation();
    END IF;
END $$;

-- 3. Sincroniza conversas que já existem no banco mas não estão no funil
INSERT INTO public.leads (user_id, name, phone, source)
SELECT bc.user_id, COALESCE(bc.contact_name, bc.contact_phone), bc.contact_phone, 'whatsapp'
FROM public.bot_conversations bc
LEFT JOIN public.leads l ON l.user_id = bc.user_id AND l.phone = bc.contact_phone
WHERE l.id IS NULL;

INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value)
SELECT 
    bc.user_id, 
    l.id as lead_id, 
    (SELECT id FROM public.funnel_stages WHERE (user_id = bc.user_id OR user_id IS NULL) ORDER BY (user_id IS NOT NULL) DESC, order_index ASC LIMIT 1) as stage_id,
    0 as deal_value
FROM public.bot_conversations bc
JOIN public.leads l ON l.user_id = bc.user_id AND l.phone = bc.contact_phone
LEFT JOIN public.pipeline_leads pl ON pl.lead_id = l.id
WHERE pl.id IS NULL;
