-- Adicionar campos de sincronização na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_message_direction TEXT;

-- Atualizar a função RPC para ser mais robusta e suportar os novos campos
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
  _user_id UUID, 
  _phone TEXT, 
  _name TEXT DEFAULT NULL, 
  _instance_name TEXT DEFAULT NULL, 
  _avatar_url TEXT DEFAULT NULL,
  _whatsapp_tags TEXT[] DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id UUID;
  v_stage_id UUID;
BEGIN
  -- 1. Upsert no Lead: atualiza nome e avatar apenas se forem melhores que os atuais
  INSERT INTO public.leads (user_id, phone, name, source, avatar_url, whatsapp_tags, last_message_direction)
  VALUES (_user_id, _phone, COALESCE(_name, 'Lead WhatsApp ' || _phone), 'whatsapp', _avatar_url, _whatsapp_tags, 'inbound')
  ON CONFLICT (user_id, phone) DO UPDATE 
  SET 
    name = CASE 
      WHEN leads.name IS NULL OR leads.name = leads.phone OR leads.name LIKE 'Lead WhatsApp %' THEN COALESCE(EXCLUDED.name, leads.name)
      ELSE leads.name 
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, leads.avatar_url),
    whatsapp_tags = CASE WHEN array_length(EXCLUDED.whatsapp_tags, 1) > 0 THEN EXCLUDED.whatsapp_tags ELSE leads.whatsapp_tags END,
    last_message_direction = 'inbound',
    updated_at = now()
  RETURNING id INTO v_lead_id;

  -- 2. Encontra o primeiro estágio do funil do usuário
  SELECT id INTO v_stage_id 
  FROM public.funnel_stages 
  WHERE user_id = _user_id
  ORDER BY order_index ASC 
  LIMIT 1;

  -- 3. Garante que haja um card no pipeline
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_leads 
    WHERE lead_id = v_lead_id AND (instance_name = _instance_name OR (instance_name IS NULL AND _instance_name IS NULL))
  ) THEN
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
    VALUES (_user_id, v_lead_id, v_stage_id, _instance_name);
  ELSE
    -- Atualiza a instância se necessário
    UPDATE public.pipeline_leads 
    SET instance_name = _instance_name, updated_at = now()
    WHERE lead_id = v_lead_id AND (instance_name IS NULL OR instance_name = '');
  END IF;
END;
$$;
