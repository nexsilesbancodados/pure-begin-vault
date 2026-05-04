-- Triggers de automação (estavam faltando)
DROP TRIGGER IF EXISTS trg_message_inserted ON public.messages;
CREATE TRIGGER trg_message_inserted
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_message_inserted();

DROP TRIGGER IF EXISTS trg_lead_inserted ON public.leads;
CREATE TRIGGER trg_lead_inserted
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_lead_inserted();

DROP TRIGGER IF EXISTS trg_pipeline_stage_changed ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_stage_changed
AFTER UPDATE ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_pipeline_stage_changed();

-- Sync de bot_conversations: garante criação de lead + card no funil
DROP TRIGGER IF EXISTS trg_bot_conversation_sync ON public.bot_conversations;
CREATE TRIGGER trg_bot_conversation_sync
AFTER INSERT OR UPDATE OF contact_phone, contact_name ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trg_bot_conversation_sync();

-- Bump do card sempre que conversa é atualizada (nova mensagem do bot)
DROP TRIGGER IF EXISTS bump_pipeline_on_conv_trigger ON public.bot_conversations;
CREATE TRIGGER bump_pipeline_on_conv_trigger
AFTER UPDATE OF last_message_at, transcript, messages_count ON public.bot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.bump_pipeline_on_conversation();