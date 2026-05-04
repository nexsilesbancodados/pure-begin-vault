-- 1. Garantir que existam estágios padrão para o usuário
CREATE OR REPLACE FUNCTION public.ensure_default_funnel_stages(_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.funnel_stages WHERE user_id = _user_id) THEN
    INSERT INTO public.funnel_stages (user_id, name, color, order_index) VALUES
    (_user_id, 'Novo Contato', '#9b87f5', 0),
    (_user_id, 'Qualificando', '#7E69AB', 1),
    (_user_id, 'Proposta Enviada', '#6E59A5', 2),
    (_user_id, 'Negociando', '#D6BCFA', 3),
    (_user_id, 'Aguardando Pagamento', '#F2FCE2', 4),
    (_user_id, 'Finalizado / Ganho', '#0ea5e9', 5);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corrigir a função RPC de sincronização para usar pipeline_leads corretamente
CREATE OR REPLACE FUNCTION public.ensure_lead_and_pipeline_from_conversation(
  _user_id UUID,
  _phone TEXT,
  _name TEXT DEFAULT NULL,
  _instance_name TEXT DEFAULT NULL,
  _avatar_url TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_lead_id UUID;
  v_stage_id UUID;
BEGIN
  -- 1. Upsert no Lead
  INSERT INTO public.leads (user_id, phone, name, source, avatar_url)
  VALUES (_user_id, _phone, COALESCE(_name, 'Lead WhatsApp ' || _phone), 'whatsapp', _avatar_url)
  ON CONFLICT (user_id, phone) DO UPDATE 
  SET 
    name = CASE 
      WHEN leads.name IS NULL OR leads.name = leads.phone OR leads.name LIKE 'Lead WhatsApp %' THEN COALESCE(EXCLUDED.name, leads.name)
      ELSE leads.name 
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, leads.avatar_url),
    updated_at = now()
  RETURNING id INTO v_lead_id;

  -- 2. Garantir estágios e pegar o primeiro
  PERFORM public.ensure_default_funnel_stages(_user_id);
  
  SELECT id INTO v_stage_id 
  FROM public.funnel_stages 
  WHERE user_id = _user_id
  ORDER BY order_index ASC 
  LIMIT 1;

  -- 3. Garantir card no pipeline_leads
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_leads 
    WHERE lead_id = v_lead_id AND (instance_name = _instance_name OR (instance_name IS NULL AND _instance_name IS NULL))
  ) THEN
    INSERT INTO public.pipeline_leads (user_id, lead_id, stage_id, instance_name)
    VALUES (_user_id, v_lead_id, v_stage_id, _instance_name);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar Trigger para automatizar a criação de cards no pipeline ao receber conversa
CREATE OR REPLACE FUNCTION public.handle_bot_conversation_upsert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.ensure_lead_and_pipeline_from_conversation(
    NEW.user_id,
    NEW.contact_phone,
    NEW.contact_name,
    NEW.instance_name,
    NULL -- avatar_url pode ser atualizado depois
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_bot_conversation_upsert ON public.bot_conversations;
CREATE TRIGGER tr_bot_conversation_upsert
AFTER INSERT OR UPDATE ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_bot_conversation_upsert();

-- 4. Limpeza de dados antigos sem instância (conforme solicitado anteriormente)
DELETE FROM public.pipeline_leads WHERE instance_name IS NULL OR instance_name = '';
DELETE FROM public.bot_conversations WHERE instance_name IS NULL OR instance_name = '';
