-- Remove permissão de execução direta para o público e usuários autenticados nas funções de gatilho
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation_direct(UUID, TEXT, TEXT) FROM public, authenticated;

-- Garante que o usuário postgres (e o sistema) ainda possam executar
GRANT EXECUTE ON FUNCTION public.handle_new_bot_conversation() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_bot_conversation_direct(UUID, TEXT, TEXT) TO postgres, service_role;
