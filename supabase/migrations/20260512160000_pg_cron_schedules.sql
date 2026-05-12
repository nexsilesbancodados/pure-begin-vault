-- pg_cron schedules para edge functions diárias.
-- Requer pg_cron extension (já disponível em Supabase Pro/Free).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Guarda config compartilhada (URL + service key) — só para uso interno do cron
CREATE TABLE IF NOT EXISTS internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Helper: chama edge function via pg_net
CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text) RETURNS bigint AS $$
DECLARE
  base_url text;
  service_key text;
  req_id bigint;
BEGIN
  SELECT value INTO base_url FROM internal_config WHERE key = 'supabase_url';
  SELECT value INTO service_key FROM internal_config WHERE key = 'service_role_key';

  IF base_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Cron skipped: internal_config not set';
    RETURN NULL;
  END IF;

  SELECT extensions.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancela schedules antigos (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-automations');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-scheduled-messages');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('email-reports-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda novos: todos os dias 8h BRT (= 11h UTC)
SELECT cron.schedule(
  'daily-automations',
  '0 11 * * *',
  $$ SELECT public.invoke_edge_function('daily-automations'); $$
);

-- Mensagens agendadas: a cada 5 min
SELECT cron.schedule(
  'dispatch-scheduled-messages',
  '*/5 * * * *',
  $$ SELECT public.invoke_edge_function('dispatch-scheduled-messages'); $$
);

-- Email diário: 8h BRT
SELECT cron.schedule(
  'email-reports-daily',
  '0 11 * * *',
  $$ SELECT public.invoke_edge_function('email-reports-daily'); $$
);
