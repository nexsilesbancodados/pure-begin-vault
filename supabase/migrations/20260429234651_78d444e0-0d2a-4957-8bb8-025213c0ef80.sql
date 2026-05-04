-- Garante que cada lead tem no máximo um card no pipeline por usuário
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_leads_user_lead_unique
ON public.pipeline_leads (user_id, lead_id);