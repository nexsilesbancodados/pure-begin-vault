
-- 1) Garante REPLICA IDENTITY FULL para realtime (envia row completo no UPDATE/DELETE)
ALTER TABLE public.bot_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_leads REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- 2) Adiciona tabelas à publicação supabase_realtime (idempotente)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3) (Re)cria triggers de sincronização em bot_conversations
DROP TRIGGER IF EXISTS bot_conversations_sync_insert ON public.bot_conversations;
DROP TRIGGER IF EXISTS bot_conversations_sync_update ON public.bot_conversations;

CREATE TRIGGER bot_conversations_sync_insert
AFTER INSERT ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trg_bot_conversation_sync();

CREATE TRIGGER bot_conversations_sync_update
AFTER UPDATE ON public.bot_conversations
FOR EACH ROW
WHEN (OLD.last_message_at IS DISTINCT FROM NEW.last_message_at
   OR OLD.contact_name IS DISTINCT FROM NEW.contact_name
   OR OLD.transcript IS DISTINCT FROM NEW.transcript)
EXECUTE FUNCTION public.trg_bot_conversation_sync();

-- 4) Atualiza pipeline_leads.updated_at quando a conversa receber nova mensagem,
--    para que o card "suba" automaticamente na ordenação por recência.
CREATE OR REPLACE FUNCTION public.bump_pipeline_on_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_norm text;
BEGIN
  v_norm := regexp_replace(COALESCE(NEW.contact_phone,''), '\D', '', 'g');
  IF length(v_norm) = 0 THEN RETURN NEW; END IF;

  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE user_id = NEW.user_id
    AND regexp_replace(COALESCE(phone,''), '\D', '', 'g') = v_norm
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.pipeline_leads
    SET updated_at = now()
    WHERE user_id = NEW.user_id AND lead_id = v_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_conversations_bump_pipeline ON public.bot_conversations;
CREATE TRIGGER bot_conversations_bump_pipeline
AFTER INSERT OR UPDATE OF last_message_at, transcript ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.bump_pipeline_on_conversation();
