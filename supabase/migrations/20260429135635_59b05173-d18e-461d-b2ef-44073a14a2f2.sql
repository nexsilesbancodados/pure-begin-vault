-- Revoga acesso público às funções SECURITY DEFINER criadas
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation() FROM anon, authenticated;

-- Garante que o sistema possa executar (necessário para triggers)
GRANT EXECUTE ON FUNCTION public.handle_new_bot_conversation() TO postgres, service_role;
