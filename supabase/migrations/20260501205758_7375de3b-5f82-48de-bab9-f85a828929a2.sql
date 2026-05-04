-- Atualiza a função de gatilho para passar a instância
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
