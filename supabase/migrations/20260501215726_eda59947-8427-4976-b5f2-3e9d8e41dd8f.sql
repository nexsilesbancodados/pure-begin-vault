-- Function to handle real-time sync when a conversation is updated (new message)
CREATE OR REPLACE FUNCTION public.trg_bot_conversation_realtime_sync()
RETURNS trigger AS $$
BEGIN
    -- Only sync if it's a new message (transcript or last_message_at changed)
    IF (TG_OP = 'INSERT') OR 
       (NEW.transcript IS DISTINCT FROM OLD.transcript) OR 
       (NEW.last_message_at IS DISTINCT FROM OLD.last_message_at) OR
       (NEW.contact_name IS DISTINCT FROM OLD.contact_name) THEN
        
        PERFORM public.ensure_lead_and_pipeline_from_conversation(
            NEW.user_id,
            NEW.contact_phone,
            NEW.contact_name,
            NEW.instance_name
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers to avoid duplication or conflicts
DROP TRIGGER IF EXISTS trg_bot_conversation_sync_insert ON public.bot_conversations;
DROP TRIGGER IF EXISTS trg_bot_conversation_sync_update ON public.bot_conversations;
DROP TRIGGER IF EXISTS trg_bot_conversation_realtime_sync_trigger ON public.bot_conversations;

-- Create a unified trigger for real-time sync
CREATE TRIGGER trg_bot_conversation_realtime_sync_trigger
AFTER INSERT OR UPDATE ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trg_bot_conversation_realtime_sync();
