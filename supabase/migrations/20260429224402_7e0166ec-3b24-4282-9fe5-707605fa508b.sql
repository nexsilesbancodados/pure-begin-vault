-- 1) Limpa triggers legados/duplicados em bot_conversations
DROP TRIGGER IF EXISTS on_bot_conversation_created ON public.bot_conversations;
DROP TRIGGER IF EXISTS on_bot_conversation_updated ON public.bot_conversations;
DROP TRIGGER IF EXISTS on_new_bot_conversation     ON public.bot_conversations;
DROP TRIGGER IF EXISTS tr_new_bot_conversation     ON public.bot_conversations;
DROP TRIGGER IF EXISTS tr_sync_bot_conversation    ON public.bot_conversations;

-- (Re)garante o par canônico
DROP TRIGGER IF EXISTS bot_conversations_sync_insert ON public.bot_conversations;
DROP TRIGGER IF EXISTS bot_conversations_sync_update ON public.bot_conversations;
DROP TRIGGER IF EXISTS bot_conversations_bump_pipeline ON public.bot_conversations;

CREATE TRIGGER bot_conversations_sync_insert
AFTER INSERT ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trg_bot_conversation_sync();

CREATE TRIGGER bot_conversations_sync_update
AFTER UPDATE ON public.bot_conversations
FOR EACH ROW
WHEN (OLD.last_message_at IS DISTINCT FROM NEW.last_message_at
   OR OLD.contact_name   IS DISTINCT FROM NEW.contact_name
   OR OLD.transcript     IS DISTINCT FROM NEW.transcript)
EXECUTE FUNCTION public.trg_bot_conversation_sync();

CREATE TRIGGER bot_conversations_bump_pipeline
AFTER INSERT OR UPDATE OF last_message_at, transcript ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.bump_pipeline_on_conversation();

-- 2) Sobe o card também quando chega uma nova linha em public.messages
CREATE OR REPLACE FUNCTION public.bump_pipeline_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.pipeline_leads
  SET updated_at = GREATEST(updated_at, NEW.created_at, now())
  WHERE user_id = NEW.user_id AND lead_id = NEW.lead_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_pipeline ON public.messages;
CREATE TRIGGER messages_bump_pipeline
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_pipeline_on_message();

-- 3) Garante REPLICA IDENTITY FULL e publicação realtime (idempotente)
ALTER TABLE public.bot_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_leads    REPLICA IDENTITY FULL;
ALTER TABLE public.messages          REPLICA IDENTITY FULL;
ALTER TABLE public.leads             REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads;    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;          EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;             EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;