REVOKE ALL ON FUNCTION public.sync_conversation_to_funnel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_conversation_to_funnel() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_conversation_to_funnel() TO authenticated;
