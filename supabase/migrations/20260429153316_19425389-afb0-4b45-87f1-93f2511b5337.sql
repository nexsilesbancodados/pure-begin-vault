-- Remove permissões de execução pública para segurança
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_bot_conversation_update() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation_direct(uuid, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.ensure_default_funnel_stages(uuid) FROM public;

-- Garante que o sistema (service_role) e authenticated possam executar se necessário (triggers rodam como superuser/owner)
GRANT EXECUTE ON FUNCTION public.handle_new_bot_conversation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_bot_conversation_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_bot_conversation_direct(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_funnel_stages(uuid) TO authenticated;
