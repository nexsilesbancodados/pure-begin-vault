create or replace function public.list_organization_members(_org_id uuid)
returns table(user_id uuid, role text, name text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.user_organizations as uo_auth
    where uo_auth.organization_id = _org_id
      and uo_auth.user_id = auth.uid()
  ) and not exists (
    select 1
    from public.super_admins as sa
    where sa.user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select uo.user_id,
         uo.role::text,
         coalesce(p.display_name, p.nome)::text as name,
         p.email::text
  from public.user_organizations as uo
  left join public.profiles as p on p.id = uo.user_id
  where uo.organization_id = _org_id

  union

  select p.id as user_id,
         coalesce(uo.role::text, p.role::text, 'member') as role,
         coalesce(p.display_name, p.nome)::text as name,
         p.email::text
  from public.profiles as p
  left join public.user_organizations as uo
    on uo.user_id = p.id and uo.organization_id = _org_id
  where p.organization_id = _org_id;
end;
$$;

revoke all on function public.list_organization_members(uuid) from public;
grant execute on function public.list_organization_members(uuid) to authenticated;
