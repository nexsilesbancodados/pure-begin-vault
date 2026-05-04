revoke all on function public.ensure_default_funnel_stages(uuid) from public;
revoke all on function public.ensure_default_funnel_stages(uuid) from anon;
grant execute on function public.ensure_default_funnel_stages(uuid) to authenticated;