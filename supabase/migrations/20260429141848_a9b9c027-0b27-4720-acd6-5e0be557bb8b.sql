-- 1. Função para normalizar telefones no banco (remove tudo que não é dígito)
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Função auxiliar para a sincronização (definida ANTES de ser usada)
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation_direct(p_user_id UUID, p_phone TEXT, p_name TEXT)
RETURNS VOID AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_first_stage_name TEXT := 'Novo Contato';
BEGIN
    -- Busca lead
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE normalize_phone(phone) = normalize_phone(p_phone) AND user_id = p_user_id 
    LIMIT 1;
    
    -- Cria lead se não existir
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status) 
        VALUES (p_user_id, COALESCE(p_name, 'Lead WhatsApp'), p_phone, 'whatsapp', 'new') 
        RETURNING id INTO v_lead_id;
    END IF;
    
    -- Busca primeiro estágio
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE (user_id = p_user_id OR user_id IS NULL) 
    ORDER BY order_index ASC 
    LIMIT 1;
    
    -- Cria estágio se não existir
    IF v_stage_id IS NULL THEN
        INSERT INTO public.funnel_stages (user_id, name, order_index, color)
        VALUES (p_user_id, v_first_stage_name, 1, '#3b82f6')
        RETURNING id INTO v_stage_id;
    END IF;
    
    -- Garante card no funil
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority) 
        VALUES (p_user_id, v_lead_id, v_stage_id, 0, 'medium');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Melhora a função do gatilho para ser mais resiliente
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    PERFORM public.handle_new_bot_conversation_direct(NEW.user_id, NEW.contact_phone, NEW.contact_name);
    RETURN NEW;
END;
$function$;

-- 4. Remove o gatilho antigo se existir e cria o novo para INSERT e UPDATE
DROP TRIGGER IF EXISTS on_new_bot_conversation ON public.bot_conversations;
CREATE TRIGGER on_new_bot_conversation
AFTER INSERT OR UPDATE OF last_message_at, transcript ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_bot_conversation();

-- 5. Sincronização retroativa: Garante que TODAS as conversas atuais tenham leads e cards
SELECT public.handle_new_bot_conversation_direct(user_id, contact_phone, contact_name) FROM public.bot_conversations;
