CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
  _user_id uuid,
  _phone text,
  _name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id uuid;
  v_stage_id uuid;
  v_deal_id uuid;
  v_normalized_phone text;
BEGIN
  -- Normaliza o telefone
  v_normalized_phone := regexp_replace(_phone, '\D', '', 'g');

  -- 1. Garante o Lead
  SELECT id INTO v_lead_id FROM public.leads 
  WHERE user_id = _user_id 
    AND (phone ILIKE '%' || v_normalized_phone || '%' OR v_normalized_phone ILIKE '%' || regexp_replace(phone, '\D', '', 'g') || '%')
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.leads (user_id, name, phone, source, status)
    VALUES (_user_id, COALESCE(_name, 'Lead via WhatsApp (' || v_normalized_phone || ')'), _phone, 'WhatsApp', 'new')
    RETURNING id INTO v_lead_id;
  END IF;

  -- 2. Garante a etapa inicial (ou pega a primeira disponível)
  SELECT id INTO v_stage_id FROM public.funnel_stages 
  WHERE user_id = _user_id 
  ORDER BY order_index ASC 
  LIMIT 1;

  -- Se não existir etapa, cria uma padrão
  IF v_stage_id IS NULL THEN
    INSERT INTO public.funnel_stages (user_id, name, color, order_index)
    VALUES (_user_id, 'Entrada', '#9b87f5', 0)
    RETURNING id INTO v_stage_id;
  END IF;

  -- 3. Garante o Card no Pipeline (Deal)
  SELECT id INTO v_deal_id FROM public.pipeline_deals 
  WHERE user_id = _user_id AND lead_id = v_lead_id AND status = 'open'
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    INSERT INTO public.pipeline_deals (user_id, lead_id, stage_id, status, deal_value)
    VALUES (_user_id, v_lead_id, v_stage_id, 'open', 0);
  ELSE
    -- Se já existe, apenas garante que está marcado como aberto
    UPDATE public.pipeline_deals 
    SET status = 'open', updated_at = now() 
    WHERE id = v_deal_id;
  END IF;
END;
$$;