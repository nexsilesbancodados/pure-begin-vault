-- Função para garantir estágios padrão para o usuário
CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Se o usuário já tiver estágios, não faz nada
    IF EXISTS (SELECT 1 FROM public.funnel_stages WHERE user_id = _user_id) THEN
        RETURN;
    END IF;

    -- Copia os estágios padrão (onde user_id IS NULL) para o usuário
    INSERT INTO public.funnel_stages (user_id, name, color, order_index)
    SELECT _user_id, name, color, order_index
    FROM public.funnel_stages
    WHERE user_id IS NULL;

    -- Se não houver estágios globais (NULL), cria os básicos
    IF NOT FOUND THEN
        INSERT INTO public.funnel_stages (user_id, name, color, order_index) VALUES
        (_user_id, 'Novo Contato', '#3b82f6', 1),
        (_user_id, 'Em Atendimento', '#8b5cf6', 2),
        (_user_id, 'Proposta', '#f59e0b', 3),
        (_user_id, 'Fechado', '#10b981', 4);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função do gatilho para criar Lead e Negócio automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_bot_conversation()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_id UUID;
    v_stage_id UUID;
BEGIN
    -- Verifica se já existe um lead com este telefone para este usuário
    SELECT id INTO v_lead_id 
    FROM public.leads 
    WHERE user_id = NEW.user_id AND phone = NEW.contact_phone
    LIMIT 1;

    -- Se não existe lead, cria um
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (user_id, name, phone, source)
        VALUES (NEW.user_id, COALESCE(NEW.contact_name, NEW.contact_phone), NEW.contact_phone, 'whatsapp')
        RETURNING id INTO v_lead_id;
    END IF;

    -- Garante que o usuário tenha estágios
    PERFORM public.ensure_default_funnel_stages(NEW.user_id);

    -- Pega o primeiro estágio do funil do usuário
    SELECT id INTO v_stage_id 
    FROM public.funnel_stages 
    WHERE user_id = NEW.user_id 
    ORDER BY order_index ASC 
    LIMIT 1;

    -- Se não encontrar estágio do usuário, tenta pegar um global
    IF v_stage_id IS NULL THEN
        SELECT id INTO v_stage_id 
        FROM public.funnel_stages 
        WHERE user_id IS NULL 
        ORDER BY order_index ASC 
        LIMIT 1;
    END IF;

    -- Se tivermos lead e estágio, verifica se já existe uma negociação
    IF v_lead_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
            INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value)
            VALUES (NEW.user_id, v_lead_id, v_stage_id, 0);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho para novas conversas
DROP TRIGGER IF EXISTS on_new_bot_conversation ON public.bot_conversations;
CREATE TRIGGER on_new_bot_conversation
AFTER INSERT ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_bot_conversation();
