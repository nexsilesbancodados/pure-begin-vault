-- Atualizar funções para definir search_path
ALTER FUNCTION public.ensure_default_funnel_stages(_user_id UUID) SET search_path = public;
ALTER FUNCTION public.ensure_lead_and_pipeline_from_conversation(_user_id UUID, _phone TEXT, _name TEXT, _instance_name TEXT, _avatar_url TEXT) SET search_path = public;
ALTER FUNCTION public.handle_bot_conversation_upsert() SET search_path = public;

-- Revogar acesso public e dar ao service_role/authenticated se necessário
REVOKE EXECUTE ON FUNCTION public.ensure_default_funnel_stages(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_lead_and_pipeline_from_conversation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_bot_conversation_upsert() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_default_funnel_stages(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_lead_and_pipeline_from_conversation(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_bot_conversation_upsert() TO authenticated, service_role;
