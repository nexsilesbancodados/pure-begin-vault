-- Atualiza a função para reconciliar instâncias órfãs
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(_user_id uuid, _phone text, _name text DEFAULT NULL::text, _instance_name text DEFAULT NULL::text, _avatar_url text DEFAULT NULL::text, _whatsapp_tags text[] DEFAULT '{}'::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_lead_id UUID;
  v_stage_id UUID;
BEGIN
  -- 1. Upsert no Lead
  INSERT INTO public.leads (user_id, phone, name, source, avatar_url, whatsapp_tags, last_message_direction)
  VALUES (_user_id, _phone, COALESCE(_name, 'Lead WhatsApp ' || _phone), 'whatsapp', _avatar_url, _whatsapp_tags, 'inbound')
  ON CONFLICT (user_id, phone) DO UPDATE 
  SET 
    name = CASE 
      WHEN (leads.name IS NULL OR leads.name = leads.phone OR leads.name LIKE 'Lead WhatsApp %' OR length(leads.name) > 30) 
           AND _name IS NOT NULL AND length(_name) <= 30 THEN _name
      ELSE leads.name 
    END,
    avatar_url = COALESCE(_avatar_url, leads.avatar_url),
    whatsapp_tags = CASE WHEN _whatsapp_tags IS NOT NULL AND array_length(_whatsapp_tags, 1) > 0 THEN _whatsapp_tags ELSE leads.whatsapp_tags END,
    last_message_direction = 'inbound',
    updated_at = now()
  RETURNING id INTO v_lead_id;

  -- 2. Encontra o primeiro estágio do funil do usuário
  SELECT id INTO v_stage_id 
  FROM public.funnel_stages 
  WHERE user_id = _user_id
  ORDER BY order_index ASC 
  LIMIT 1;

  -- 3. Garante que haja um card no pipeline para este lead
  -- Primeiro, verifica se já existe um card para este lead sem instância (legado/órfão)
  -- Se existir, associa ele à instância atual
  UPDATE public.pipeline_leads
  SET instance_name = _instance_name
  WHERE lead_id = v_lead_id 
    AND (instance_name IS NULL OR instance_name = '')
    AND _instance_name IS NOT NULL;

  -- Se ainda não existir nenhum card para este lead, cria um novo
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_leads 
    WHERE lead_id = v_lead_id
  ) THEN
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
    VALUES (_user_id, v_lead_id, v_stage_id, _instance_name);
  END IF;
END;
$function$;

-- Adiciona índice para melhorar performance de filtro por instância
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_instance_name ON public.pipeline_leads(instance_name);
