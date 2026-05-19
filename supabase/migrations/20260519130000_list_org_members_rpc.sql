create or replace function public.list_organization_members(_org_id uuid)
returns table(user_id uuid, role text, name text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_organizations
    where organization_id = _org_id and user_id = auth.uid()
  ) and not exists (
    select 1 from public.super_admins where user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select uo.user_id,
         uo.role::text,
         coalesce(p.display_name, p.nome)::text as name,
         p.email::text
  from public.user_organizations uo
  left join public.profiles p on p.id = uo.user_id
  where uo.organization_id = _org_id;
end;
$$;

revoke all on function public.list_organization_members(uuid) from public;
grant execute on function public.list_organization_members(uuid) to authenticated;
