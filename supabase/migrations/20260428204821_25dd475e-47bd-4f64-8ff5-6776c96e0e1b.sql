ALTER TABLE public.bot_conversations REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bot_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_conversations;
  END IF;
END $$;

ALTER TABLE public.whatsapp_instances REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_instances') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;
  END IF;
END $$;