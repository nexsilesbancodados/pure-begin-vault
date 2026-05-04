-- 1. LIMPEZA TOTAL
TRUNCATE TABLE public.automation_runs CASCADE;
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.pipeline_leads CASCADE;
TRUNCATE TABLE public.bot_conversations CASCADE;
TRUNCATE TABLE public.leads CASCADE;
DELETE FROM public.funnel_stages;

-- 2. ESTÁGIOS + AUTOMAÇÕES PADRÃO PARA TODOS OS USUÁRIOS
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.ensure_default_funnel_stages(u.id);
    PERFORM public.seed_default_automations(u.id);
  END LOOP;
END $$;

-- 3. APP SETTINGS
INSERT INTO public.app_settings (key, value) VALUES
  ('supabase_url',  'https://htsjkvczxlrsfapkbidq.supabase.co'),
  ('anon_key',      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2prdmN6eGxyc2ZhcGtiaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDUwOTAsImV4cCI6MjA5Mjg4MTA5MH0.sQroXA9tjLK5vmGzMUb_ShJqo7tG2Uvzis_iTW0kXhQ')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 4. TRIGGERS
DROP TRIGGER IF EXISTS trg_sync_conv_to_funnel ON public.bot_conversations;
DROP TRIGGER IF EXISTS trg_bot_conv_sync ON public.bot_conversations;
DROP TRIGGER IF EXISTS bump_pipeline_on_conv ON public.bot_conversations;
DROP TRIGGER IF EXISTS trg_message_inserted ON public.messages;
DROP TRIGGER IF EXISTS trg_lead_inserted ON public.leads;
DROP TRIGGER IF EXISTS trg_pipeline_stage_changed ON public.pipeline_leads;
DROP TRIGGER IF EXISTS bump_pipeline_on_msg ON public.messages;
DROP TRIGGER IF EXISTS trg_seed_pipeline_on_new_user ON auth.users;
DROP TRIGGER IF EXISTS trg_qualify_on_message ON public.messages;

CREATE TRIGGER trg_bot_conv_sync
AFTER INSERT OR UPDATE OF contact_name, contact_phone ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.trg_bot_conversation_sync();

CREATE TRIGGER bump_pipeline_on_conv
AFTER UPDATE OF last_message_at, transcript ON public.bot_conversations
FOR EACH ROW EXECUTE FUNCTION public.bump_pipeline_on_conversation();

CREATE TRIGGER bump_pipeline_on_msg
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_pipeline_on_message();

CREATE TRIGGER trg_lead_inserted
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_lead_inserted();

CREATE TRIGGER trg_message_inserted
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_message_inserted();

CREATE TRIGGER trg_pipeline_stage_changed
AFTER UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_pipeline_stage_changed();

CREATE OR REPLACE FUNCTION public.on_new_user_setup_pipeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_default_funnel_stages(NEW.id);
  PERFORM public.seed_default_automations(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_pipeline_on_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.on_new_user_setup_pipeline();

-- 5. QUALIFICADOR IA
CREATE OR REPLACE FUNCTION public.call_pipeline_qualifier(_user_id uuid, _lead_id uuid, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_url text; v_anon text;
BEGIN
  IF _user_id IS NULL OR _lead_id IS NULL THEN RETURN; END IF;
  SELECT value INTO v_url  FROM public.app_settings WHERE key = 'supabase_url';
  SELECT value INTO v_anon FROM public.app_settings WHERE key = 'anon_key';
  IF v_url IS NULL OR v_anon IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/pipeline-qualifier',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey', v_anon,
      'Authorization', 'Bearer ' || v_anon
    ),
    body := jsonb_build_object(
      'user_id', _user_id, 'lead_id', _lead_id, 'message', _message
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.trg_qualify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction <> 'inbound' OR NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.call_pipeline_qualifier(NEW.user_id, NEW.lead_id, NEW.content);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_qualify_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_qualify_on_message();

-- 6. REALTIME (idempotente)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pipeline_leads','messages','leads','bot_conversations','funnel_stages']) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 7. REPLICA IDENTITY FULL para realtime entregar updates completos
ALTER TABLE public.pipeline_leads REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.bot_conversations REPLICA IDENTITY FULL;