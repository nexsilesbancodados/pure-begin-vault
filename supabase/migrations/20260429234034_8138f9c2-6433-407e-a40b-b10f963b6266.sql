-- Identifica leads de grupos e apaga em cascata
WITH grp_leads AS (
  SELECT id, user_id FROM public.leads
  WHERE phone LIKE '%-%'
     OR length(regexp_replace(COALESCE(phone,''),'\D','','g')) > 15
)
DELETE FROM public.pipeline_leads pl
USING grp_leads g
WHERE pl.lead_id = g.id;

WITH grp_leads AS (
  SELECT id FROM public.leads
  WHERE phone LIKE '%-%'
     OR length(regexp_replace(COALESCE(phone,''),'\D','','g')) > 15
)
DELETE FROM public.messages m
USING grp_leads g
WHERE m.lead_id = g.id;

DELETE FROM public.leads
WHERE phone LIKE '%-%'
   OR length(regexp_replace(COALESCE(phone,''),'\D','','g')) > 15;

-- Remove conversas de grupo (telefone com '-', remote_jid de grupo, ou número longo)
DELETE FROM public.bot_conversations
WHERE contact_phone LIKE '%-%'
   OR remote_jid LIKE '%@g.us'
   OR remote_jid LIKE '%@broadcast'
   OR length(regexp_replace(COALESCE(contact_phone,''),'\D','','g')) > 15;