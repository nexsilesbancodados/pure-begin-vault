-- Adiciona coluna instance_name na tabela bot_conversations se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_conversations' AND column_name = 'instance_name') THEN
        ALTER TABLE public.bot_conversations ADD COLUMN instance_name TEXT;
    END IF;
END $$;

-- Adiciona coluna instance_name na tabela pipeline_leads se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipeline_leads' AND column_name = 'instance_name') THEN
        ALTER TABLE public.pipeline_leads ADD COLUMN instance_name TEXT;
    END IF;
END $$;

-- Criar índice para performance de filtragem
CREATE INDEX IF NOT EXISTS idx_bot_conversations_instance ON public.bot_conversations(instance_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_instance ON public.pipeline_leads(instance_name);

-- Atualiza a função rpc ensure_lead_and_pipeline_from_conversation para aceitar e salvar a instância
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
  _user_id UUID,
  _phone TEXT,
  _name TEXT,
  _instance_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_lead_id UUID;
  v_stage_id UUID;
BEGIN
  -- Tenta encontrar o lead pelo telefone e user_id
  SELECT id INTO v_lead_id FROM public.leads 
  WHERE user_id = _user_id AND (phone = _phone OR phone LIKE '%' || RIGHT(_phone, 8));

  -- Se não existir, cria o lead
  IF v_lead_id IS NULL THEN
    INSERT INTO public.leads (user_id, name, phone, source)
    VALUES (_user_id, COALESCE(_name, 'Lead WhatsApp'), _phone, 'whatsapp')
    RETURNING id INTO v_lead_id;
  END IF;

  -- Tenta encontrar o primeiro estágio do funil
  SELECT id INTO v_stage_id FROM public.funnel_stages 
  WHERE (user_id = _user_id OR user_id IS NULL)
  ORDER BY order_index ASC LIMIT 1;

  -- Se não existir negociação para este lead, cria uma
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_leads WHERE lead_id = v_lead_id) THEN
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
    VALUES (_user_id, v_lead_id, v_stage_id, _instance_name);
  ELSE
    -- Se já existe, garante que a instância está preenchida se informada
    IF _instance_name IS NOT NULL THEN
        UPDATE public.pipeline_leads 
        SET instance_name = _instance_name 
        WHERE lead_id = v_lead_id AND (instance_name IS NULL OR instance_name = '');
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
