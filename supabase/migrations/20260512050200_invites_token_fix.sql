-- Habilita pgcrypto + recria função de token compatível
create extension if not exists pgcrypto;

-- Fix create_organization_for_user pra setar owner_id (NOT NULL na tabela organizations)
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

  insert into public.organizations (name, owner_id)
  values (trim(_name), auth.uid())
  returning id into v_org_id;

  insert into public.user_organizations (user_id, organization_id, role, is_default)
  values (auth.uid(), v_org_id, 'owner', false);

  return v_org_id;
end;
$$;

create or replace function public.gen_invite_token()
returns text
language sql
volatile
as $$
  select replace(replace(encode(gen_random_bytes(24), 'base64'), '/', '_'), '+', '-')
$$;

-- Cria tabela se ainda não foi criada (migration anterior pode ter falhado)
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invited_by uuid not null,
  email text,
  role text not null default 'employee',
  token text not null unique default public.gen_invite_token(),
  status text not null default 'pending',
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz default now()
);

-- Caso a tabela já tenha sido criada sem o default, força o default agora
alter table public.organization_invites
  alter column token set default public.gen_invite_token();

create index if not exists org_invites_token_idx on public.organization_invites (token);
create index if not exists org_invites_org_idx on public.organization_invites (organization_id, status);

alter table public.organization_invites enable row level security;

drop policy if exists "invites select org members" on public.organization_invites;
create policy "invites select org members" on public.organization_invites
  for select using (
    organization_id in (
      select organization_id from public.user_organizations where user_id = auth.uid()
    )
  );

drop policy if exists "invites insert by member" on public.organization_invites;
create policy "invites insert by member" on public.organization_invites
  for insert with check (
    invited_by = auth.uid()
    and organization_id in (
      select organization_id from public.user_organizations where user_id = auth.uid()
    )
  );

drop policy if exists "invites update own" on public.organization_invites;
create policy "invites update own" on public.organization_invites
  for update using (
    organization_id in (
      select organization_id from public.user_organizations where user_id = auth.uid()
    )
  );

-- RPCs (recria caso não tenham sido criadas pela migration anterior)
create or replace function public.accept_organization_invite(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  select * into v_invite from public.organization_invites
  where token = _token and status = 'pending' and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;

  insert into public.user_organizations (user_id, organization_id, role, is_default)
  values (auth.uid(), v_invite.organization_id, v_invite.role, false)
  on conflict (user_id, organization_id) do nothing;

  update public.organization_invites
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;

grant execute on function public.accept_organization_invite(text) to authenticated;

create or replace function public.remove_organization_member(_org_id uuid, _user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from public.user_organizations
  where organization_id = _org_id and user_id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'sem permissão';
  end if;

  if _user_id = auth.uid() then
    raise exception 'use leave_organization para sair';
  end if;

  delete from public.user_organizations
  where organization_id = _org_id and user_id = _user_id;
end;
$$;

grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;

create or replace function public.leave_organization(_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_organizations
  where organization_id = _org_id and user_id = auth.uid();

  update public.profiles
  set organization_id = (
    select organization_id from public.user_organizations
    where user_id = auth.uid() limit 1
  )
  where id = auth.uid() and organization_id = _org_id;
end;
$$;

grant execute on function public.leave_organization(uuid) to authenticated;

create or replace function public.update_organization_name(_org_id uuid, _name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.user_organizations
  where organization_id = _org_id and user_id = auth.uid();

  if v_role not in ('owner', 'admin') then
    raise exception 'sem permissão';
  end if;

  if _name is null or length(trim(_name)) = 0 then
    raise exception 'nome obrigatório';
  end if;

  update public.organizations
  set name = trim(_name), updated_at = now()
  where id = _org_id;
end;
$$;

grant execute on function public.update_organization_name(uuid, text) to authenticated;
