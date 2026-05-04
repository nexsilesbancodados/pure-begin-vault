-- 1. Função robusta que garante lead + card no funil a partir de uma conversa
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
  _user_id uuid,
  _phone text,
  _name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_stage_id uuid;
  v_norm text;
BEGIN
  IF _user_id IS NULL OR _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RETURN;
  END IF;

  v_norm := regexp_replace(_phone, '\D', '', 'g');
  IF length(v_norm) = 0 THEN
    RETURN;
  END IF;

  -- Garante etapas padrão do funil
  PERFORM public.ensure_default_funnel_stages(_user_id);

  -- Procura lead existente (por telefone normalizado)
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE user_id = _user_id
    AND regexp_replace(COALESCE(phone,''), '\D', '', 'g') = v_norm
  LIMIT 1;

  -- Cria lead se não existir
  IF v_lead_id IS NULL THEN
    INSERT INTO public.leads (user_id, name, phone, source, status)
    VALUES (_user_id, COALESCE(NULLIF(trim(_name), ''), 'Lead WhatsApp ' || v_norm), _phone, 'whatsapp', 'new')
    RETURNING id INTO v_lead_id;
  ELSE
    -- Atualiza nome se estava vazio/genérico
    UPDATE public.leads
    SET name = COALESCE(NULLIF(trim(_name), ''), name),
        updated_at = now()
    WHERE id = v_lead_id
      AND (name IS NULL OR name = '' OR name LIKE 'Lead WhatsApp%');
  END IF;

  -- Primeiro estágio do funil deste usuário
  SELECT id INTO v_stage_id
  FROM public.funnel_stages
  WHERE user_id = _user_id
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RETURN;
  END IF;

  -- Garante card no pipeline
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_leads
    WHERE user_id = _user_id AND lead_id = v_lead_id
  ) THEN
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, deal_value, priority)
    VALUES (_user_id, v_lead_id, v_stage_id, 0, 'medium');
  END IF;
END;
$$;

-- 2. Trigger function para INSERT e UPDATE em bot_conversations
CREATE OR REPLACE FUNCTION public.trg_bot_conversation_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_lead_and_pipeline_from_conversation(
    NEW.user_id,
    NEW.contact_phone,
    NEW.contact_name
  );
  RETURN NEW;
END;
$$;

-- 3. (Re)criar triggers
DROP TRIGGER IF EXISTS bot_conversations_sync_insert ON public.bot_conversations;
CREATE TRIGGER bot_conversations_sync_insert
  AFTER INSERT ON public.bot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bot_conversation_sync();

DROP TRIGGER IF EXISTS bot_conversations_sync_update ON public.bot_conversations;
CREATE TRIGGER bot_conversations_sync_update
  AFTER UPDATE OF contact_name, contact_phone, last_message_at ON public.bot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bot_conversation_sync();

-- 4. Backfill: processar TODAS as conversas existentes (antigas)
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT user_id, contact_phone, contact_name FROM public.bot_conversations LOOP
    PERFORM public.ensure_lead_and_pipeline_from_conversation(c.user_id, c.contact_phone, c.contact_name);
  END LOOP;
END $$;