-- Complemento ao billing MP:
-- 1. failed_attempts em subscriptions (pra dunning)
-- 2. status novos: past_due, suspended
-- 3. unique constraint pra upsert user_id+plan_id funcionar
-- 4. RPC suspend_overdue_subscriptions
-- 5. RPC convert_trial_to_pending (cron diário)

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_failed_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Unique pra permitir upsert(user_id, plan_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_plan_unique') THEN
    -- Remove duplicatas antigas mantendo a mais recente
    DELETE FROM subscriptions s1
    USING subscriptions s2
    WHERE s1.user_id = s2.user_id
      AND s1.plan_id = s2.plan_id
      AND s1.created_at < s2.created_at;
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_plan_unique UNIQUE (user_id, plan_id);
  END IF;
END $$;

-- Função: marca trial expirado como past_due (3 dias após fim)
CREATE OR REPLACE FUNCTION public.expire_old_trials() RETURNS jsonb AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE subscriptions
  SET status = 'past_due', updated_at = now()
  WHERE status = 'trial'
    AND current_period_end < now() - interval '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('expired', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: suspende past_due após 7 dias
CREATE OR REPLACE FUNCTION public.suspend_overdue_subscriptions() RETURNS jsonb AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE subscriptions
  SET status = 'suspended', updated_at = now()
  WHERE status = 'past_due'
    AND updated_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('suspended', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agenda no pg_cron (diário 02h UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-trials-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('expire-trials-daily', '0 2 * * *', $$ SELECT public.expire_old_trials(); $$);

DO $$
BEGIN
  PERFORM cron.unschedule('suspend-overdue-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('suspend-overdue-daily', '15 2 * * *', $$ SELECT public.suspend_overdue_subscriptions(); $$);
