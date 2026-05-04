CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_external_id
  ON public.messages (external_id)
  WHERE external_id IS NOT NULL;