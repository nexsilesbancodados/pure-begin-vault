-- Corrige o acesso multi-loja da usuária Rafaela Financeiro.
-- Idempotente: pode rodar mais de uma vez sem duplicar vínculos.

do $$
declare
  v_user_id uuid;
  v_primary_org_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('faela_holanda@hotmail.com')
  limit 1;

  if v_user_id is null then
    return;
  end if;

  select id into v_primary_org_id
  from public.organizations
  where name = 'Atacado Cell'
  limit 1;

  update public.user_organizations
  set is_default = false
  where user_id = v_user_id;

  insert into public.user_organizations (user_id, organization_id, role, is_default)
  select
    v_user_id,
    o.id,
    'financeiro',
    o.id = coalesce(v_primary_org_id, o.id)
  from public.organizations o
  where o.name in ('Atacado Cell', 'AlfaTech Curuçá', 'Premier Castanhal', 'Phone Atacado')
  on conflict (user_id, organization_id)
  do update set
    role = excluded.role,
    is_default = excluded.is_default;

  update public.profiles
  set
    organization_id = coalesce(v_primary_org_id, organization_id),
    role = 'financeiro',
    updated_at = now()
  where id = v_user_id;

  update public.organization_invites
  set
    role = 'financeiro',
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = coalesce(accepted_at, now()),
    organization_id = coalesce(v_primary_org_id, organization_id)
  where lower(email) = lower('faela_holanda@hotmail.com');
end $$;
