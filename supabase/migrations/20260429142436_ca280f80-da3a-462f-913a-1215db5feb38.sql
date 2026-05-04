-- Ajusta search_path para segurança
ALTER FUNCTION public.ensure_default_funnel_stages(UUID) SET search_path = public;
ALTER FUNCTION public.handle_new_bot_conversation() SET search_path = public;
