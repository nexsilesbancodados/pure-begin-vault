-- Garante que a função trg_bot_conversation_sync use todos os argumentos necessários
CREATE OR REPLACE FUNCTION public.trg_bot_conversation_sync()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.ensure_lead_and_pipeline_from_conversation(
    NEW.user_id,
    NEW.contact_phone,
    NEW.contact_name,
    NEW.instance_name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove triggers antigos se existirem para evitar duplicidade ou conflitos
DROP TRIGGER IF EXISTS trg_bot_conversation_sync ON public.bot_conversations;
DROP TRIGGER IF EXISTS trg_bot_conv_sync ON public.bot_conversations;
DROP TRIGGER IF EXISTS bot_conversations_sync_insert ON public.bot_conversations;
DROP TRIGGER IF EXISTS bot_conversations_sync_update ON public.bot_conversations;

-- Cria o trigger unificado para INSERT
CREATE TRIGGER trg_bot_conversation_sync_insert
AFTER INSERT ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trg_bot_conversation_sync();

-- Cria o trigger unificado para UPDATE (quando dados relevantes mudam)
CREATE TRIGGER trg_bot_conversation_sync_update
AFTER UPDATE ON public.bot_conversations
FOR EACH ROW
WHEN (
    OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR 
    OLD.contact_name IS DISTINCT FROM NEW.contact_name OR
    OLD.instance_name IS DISTINCT FROM NEW.instance_name
)
EXECUTE FUNCTION public.trg_bot_conversation_sync();

-- Força a sincronização de conversas existentes que podem estar sem lead/pipeline
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM public.bot_conversations LOOP
        PERFORM public.ensure_lead_and_pipeline_from_conversation(
            r.user_id,
            r.contact_phone,
            r.contact_name,
            r.instance_name
        );
    END LOOP;
END $$;
