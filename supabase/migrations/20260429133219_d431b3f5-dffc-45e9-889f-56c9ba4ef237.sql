-- Correção de segurança para as funções
ALTER FUNCTION public.ensure_default_funnel_stages(_user_id UUID) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.ensure_default_funnel_stages(UUID) FROM PUBLIC;

ALTER FUNCTION public.handle_new_bot_conversation() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation() FROM PUBLIC;
