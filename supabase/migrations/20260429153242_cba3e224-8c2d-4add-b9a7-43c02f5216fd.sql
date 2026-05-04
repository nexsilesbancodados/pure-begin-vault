-- Cria o trigger para novas conversas no WhatsApp
DROP TRIGGER IF EXISTS on_bot_conversation_created ON public.bot_conversations;
CREATE TRIGGER on_bot_conversation_created
AFTER INSERT ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_bot_conversation();

-- Atualiza a função para também lidar com atualizações (novas mensagens)
CREATE OR REPLACE FUNCTION public.handle_bot_conversation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
    v_phone TEXT;
BEGIN
    -- Normaliza o telefone
    v_phone := regexp_replace(NEW.contact_phone, '\D', '', 'g');
    
    -- Busca o lead associado
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE user_id = NEW.user_id 
    AND (regexp_replace(phone, '\D', '', 'g') = v_phone OR phone = NEW.contact_phone)
    LIMIT 1;
    
    -- Se o lead não existe, o trigger de INSERT já deve ter criado, 
    -- mas por segurança garantimos aqui também
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source, status)
        VALUES (NEW.user_id, COALESCE(NEW.contact_name, 'Lead WhatsApp ' || v_phone), NEW.contact_phone, 'whatsapp', 'new')
        RETURNING id INTO v_lead_id;
    END IF;

    -- Busca o primeiro estágio do funil desse usuário
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE user_id = NEW.user_id 
    ORDER BY order_index ASC 
    LIMIT 1;

    -- Se não existir no pipeline, cria
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id AND user_id = NEW.user_id) THEN
        INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
        VALUES (NEW.user_id, v_lead_id, v_stage_id, 0, 'medium');
    END IF;

    -- Opcional: Se quiser que o card suba no topo da lista ou mude de cor, 
    -- podemos adicionar um timestamp de "última interação" na tabela pipeline_leads futuramente.
    
    RETURN NEW;
END;
$$;

-- Adiciona trigger de UPDATE para garantir que mudanças na conversa reflitam no funil
DROP TRIGGER IF EXISTS on_bot_conversation_updated ON public.bot_conversations;
CREATE TRIGGER on_bot_conversation_updated
AFTER UPDATE OF last_message_at, transcript ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_bot_conversation_update();

-- Sincroniza retroativamente todas as conversas existentes que não estão no funil
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM public.bot_conversations LOOP
        PERFORM public.handle_new_bot_conversation_direct(r.user_id, r.contact_phone, r.contact_name);
    END LOOP;
END;
$$;
