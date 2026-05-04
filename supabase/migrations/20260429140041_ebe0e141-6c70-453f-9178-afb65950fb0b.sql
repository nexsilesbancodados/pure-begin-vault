-- Define o search_path para evitar mutabilidade e ataques de path hijacking
ALTER FUNCTION public.handle_new_bot_conversation() SET search_path = public;

-- Revoga execução pública e garante apenas para roles autenticadas/postgres
REVOKE EXECUTE ON FUNCTION public.handle_new_bot_conversation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_bot_conversation() TO postgres, authenticated, service_role;
