-- Corrige search_path para normalize_phone
ALTER FUNCTION public.normalize_phone(TEXT) SET search_path = public;

-- Corrige search_path para handle_new_bot_conversation_direct
ALTER FUNCTION public.handle_new_bot_conversation_direct(UUID, TEXT, TEXT) SET search_path = public;

-- Corrige search_path para handle_new_bot_conversation
ALTER FUNCTION public.handle_new_bot_conversation() SET search_path = public;
