-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) automation_runs (log)
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  automation_id uuid,
  trigger_type text NOT NULL,
  action_type text,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_runs_user_idx ON public.automation_runs(user_id, created_at DESC);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their automation_runs" ON public.automation_runs;
CREATE POLICY "Users view their automation_runs"
ON public.automation_runs FOR SELECT
USING (auth.uid() = user_id);

-- 3) app_settings (URL do projeto + anon key) — restrito
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Sem policies: ninguém via API. Só o postgres/triggers acessam.

-- 4) Helper que dispara a edge function automation-runner
CREATE OR REPLACE FUNCTION public.dispatch_automation(
  _user_id uuid,
  _trigger_type text,
  _payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url   text;
  v_anon  text;
BEGIN
  IF _user_id IS NULL OR _trigger_type IS NULL THEN RETURN; END IF;

  SELECT value INTO v_url  FROM public.app_settings WHERE key = 'supabase_url';
  SELECT value INTO v_anon FROM public.app_settings WHERE key = 'anon_key';
  IF v_url IS NULL OR v_anon IS NULL THEN
    -- Configuração ausente; não falha o trigger principal
    INSERT INTO public.automation_runs (user_id, trigger_type, status, payload, error)
    VALUES (_user_id, _trigger_type, 'skipped', _payload, 'app_settings missing');
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/automation-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon,
      'Authorization', 'Bearer ' || v_anon
    ),
    body := jsonb_build_object(
      'user_id', _user_id,
      'trigger_type', _trigger_type,
      'payload', COALESCE(_payload, '{}'::jsonb)
    )
  );
END;
$$;

-- 5) Trigger: novo lead
CREATE OR REPLACE FUNCTION public.trg_lead_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_automation(
    NEW.user_id, 'new_lead',
    jsonb_build_object('lead_id', NEW.id, 'name', NEW.name, 'phone', NEW.phone, 'source', NEW.source)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS leads_dispatch_new_lead ON public.leads;
CREATE TRIGGER leads_dispatch_new_lead
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_lead_inserted();

-- 6) Trigger: mensagem recebida (inbound)
CREATE OR REPLACE FUNCTION public.trg_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  PERFORM public.dispatch_automation(
    NEW.user_id, 'message_received',
    jsonb_build_object('lead_id', NEW.lead_id, 'content', NEW.content, 'created_at', NEW.created_at)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_dispatch_received ON public.messages;
CREATE TRIGGER messages_dispatch_received
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_message_inserted();

-- 7) Trigger: mudança de etapa
CREATE OR REPLACE FUNCTION public.trg_pipeline_stage_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    PERFORM public.dispatch_automation(
      NEW.user_id, 'stage_changed',
      jsonb_build_object(
        'pipeline_lead_id', NEW.id,
        'lead_id', NEW.lead_id,
        'from_stage_id', OLD.stage_id,
        'to_stage_id', NEW.stage_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pipeline_dispatch_stage_changed ON public.pipeline_leads;
CREATE TRIGGER pipeline_dispatch_stage_changed
AFTER UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_pipeline_stage_changed();

-- 8) Cron: varredura "sem resposta há 24h" a cada 15 min
CREATE OR REPLACE FUNCTION public.scan_no_reply_24h()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT pl.user_id, pl.lead_id
    FROM public.pipeline_leads pl
    JOIN public.leads l ON l.id = pl.lead_id
    LEFT JOIN LATERAL (
      SELECT MAX(created_at) AS last_at, MAX(direction) AS last_dir
      FROM public.messages m
      WHERE m.lead_id = pl.lead_id
    ) m ON true
    LEFT JOIN public.bot_conversations bc
      ON bc.user_id = pl.user_id
     AND regexp_replace(COALESCE(bc.contact_phone,''),'\D','','g') =
         regexp_replace(COALESCE(l.phone,''),'\D','','g')
    WHERE COALESCE(bc.last_message_at, m.last_at) < now() - interval '24 hours'
      AND COALESCE(bc.last_message_at, m.last_at) > now() - interval '48 hours'
  LOOP
    PERFORM public.dispatch_automation(
      r.user_id, 'no_reply_24h',
      jsonb_build_object('lead_id', r.lead_id)
    );
  END LOOP;
END;
$$;

-- (Re)agenda o cron
DO $$
BEGIN
  PERFORM cron.unschedule('automation-no-reply-24h');
EXCEPTION WHEN others THEN NULL;
END $$;

SELECT cron.schedule(
  'automation-no-reply-24h',
  '*/15 * * * *',
  $$ SELECT public.scan_no_reply_24h(); $$
);