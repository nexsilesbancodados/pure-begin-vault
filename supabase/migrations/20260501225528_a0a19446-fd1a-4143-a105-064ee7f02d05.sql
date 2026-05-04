-- Delete pipeline deals without an instance
DELETE FROM public.pipeline_leads 
WHERE instance_name IS NULL OR instance_name = '';

-- Delete bot conversations without an instance
DELETE FROM public.bot_conversations 
WHERE instance_name IS NULL OR instance_name = '';

-- Optional: Delete leads that no longer have a pipeline_lead or bot_conversation 
-- (Keeps the database clean of "instance-less" ghost leads)
DELETE FROM public.leads l
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_leads p WHERE p.lead_id = l.id)
AND NOT EXISTS (SELECT 1 FROM public.bot_conversations c WHERE c.contact_phone = l.phone AND c.user_id = l.user_id)
AND l.source = 'whatsapp';