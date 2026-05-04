-- Adiciona colunas de tags e notas à tabela pipeline_leads se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'pipeline_leads' AND COLUMN_NAME = 'tags') THEN
        ALTER TABLE public.pipeline_leads ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'pipeline_leads' AND COLUMN_NAME = 'notes') THEN
        ALTER TABLE public.pipeline_leads ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Cria índice para busca rápida por tags
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_tags ON public.pipeline_leads USING GIN(tags);

-- Atualiza a função RPC para ser mais robusta e garantir que não duplique leads em casos de concorrência extrema
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
  _user_id UUID,
  _phone TEXT,
  _name TEXT DEFAULT NULL,
  _instance_name TEXT DEFAULT NULL,
  _avatar_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_lead_id UUID;
  v_stage_id UUID;
BEGIN
  -- 1. Encontra ou cria o lead
  INSERT INTO public.leads (user_id, phone, name, source, avatar_url)
  VALUES (_user_id, _phone, COALESCE(_name, 'Lead WhatsApp ' || _phone), 'whatsapp', _avatar_url)
  ON CONFLICT (user_id, phone) DO UPDATE 
  SET 
    name = CASE 
      WHEN leads.name IS NULL OR leads.name = leads.phone OR leads.name LIKE 'Lead WhatsApp %' THEN COALESCE(EXCLUDED.name, leads.name)
      ELSE leads.name 
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, leads.avatar_url)
  RETURNING id INTO v_lead_id;

  -- 2. Encontra o primeiro estágio do funil
  SELECT id INTO v_stage_id 
  FROM public.funnel_stages 
  WHERE (user_id = _user_id OR user_id IS NULL)
  ORDER BY order_index ASC 
  LIMIT 1;

  -- 3. Garante que haja um card no pipeline para este lead
  -- Se já existir um card para este lead na mesma instância, não faz nada
  -- Se mudar de estágio manualmente, o update_at mudará, mas o lead_id + instance_name é único no contexto de criação automática
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_leads 
    WHERE lead_id = v_lead_id AND (instance_name = _instance_name OR (instance_name IS NULL AND _instance_name IS NULL))
  ) THEN
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
    VALUES (_user_id, v_lead_id, v_stage_id, _instance_name);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
