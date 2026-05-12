-- Multi-loja: 1 user pode ter várias organizations.
-- profiles.organization_id continua sendo a LOJA ATIVA atual (sem refactor RLS).
-- user_organizations = N:N user × organization, com role e is_default.

------------------------------------------------------------
-- 1. tabela user_organizations
------------------------------------------------------------
create table if not exists public.user_organizations (
  user_id uuid not null,
  organization_id uuid not null,
  role text not null default 'owner', -- owner|admin|employee|tecnico
  is_default boolean default false,
  created_at timestamptz default now(),
  primary key (user_id, organization_id)
);

create index if not exists user_organizations_user_idx on public.user_organizations (user_id);
create index if not exists user_organizations_org_idx on public.user_organizations (organization_id);

alter table public.user_organizations enable row level security;

drop policy if exists "user_organizations select own" on public.user_organizations;
create policy "user_organizations select own" on public.user_organizations
  for select using (user_id = auth.uid());

drop policy if exists "user_organizations insert own" on public.user_organizations;
create policy "user_organizations insert own" on public.user_organizations
  for insert with check (user_id = auth.uid());

drop policy if exists "user_organizations update own" on public.user_organizations;
create policy "user_organizations update own" on public.user_organizations
  for update using (user_id = auth.uid());

drop policy if exists "user_organizations delete own" on public.user_organizations;
create policy "user_organizations delete own" on public.user_organizations
  for delete using (user_id = auth.uid());

------------------------------------------------------------
-- 2. seed: popula user_organizations com os pares atuais de profiles
------------------------------------------------------------
insert into public.user_organizations (user_id, organization_id, role, is_default)
select p.id, p.organization_id, 'owner', true
from public.profiles p
where p.organization_id is not null
on conflict (user_id, organization_id) do nothing;

------------------------------------------------------------
-- 3. RPC: switch_organization (troca a loja ativa)
------------------------------------------------------------
create or replace function public.switch_organization(_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_access boolean;
begin
  -- valida que o user tem acesso à org
  select exists(
    select 1 from public.user_organizations
    where user_id = auth.uid() and organization_id = _org_id
  ) into v_has_access;

  if not v_has_access then
    raise exception 'sem acesso a esta loja';
  end if;

  update public.profiles
  set organization_id = _org_id, updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.switch_organization(uuid) to authenticated;

------------------------------------------------------------
-- 4. RPC: create_organization_for_user (cria loja + vincula ao user)
------------------------------------------------------------
create or replace function public.create_organization_for_user(_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if _name is null or length(trim(_name)) = 0 then
    raise exception 'nome obrigatório';
  end if;

  insert into public.organizations (name)
  values (trim(_name))
  returning id into v_org_id;

  insert into public.user_organizations (user_id, organization_id, role, is_default)
  values (auth.uid(), v_org_id, 'owner', false);

  return v_org_id;
end;
$$;

grant execute on function public.create_organization_for_user(text) to authenticated;
