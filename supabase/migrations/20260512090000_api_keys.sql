-- API keys públicas pra integração externa
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] default array['read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists api_keys_hash_idx on public.api_keys (key_hash) where revoked_at is null;
create index if not exists api_keys_org_idx on public.api_keys (organization_id);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys select org" on public.api_keys;
create policy "api_keys select org" on public.api_keys
  for select using (
    organization_id in (
      select organization_id from public.user_organizations where user_id = auth.uid()
    )
  );

drop policy if exists "api_keys cud own" on public.api_keys;
create policy "api_keys cud own" on public.api_keys
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RPC pra gerar uma key (retorna a chave PLAINTEXT apenas 1x)
create or replace function public.create_api_key(_name text, _scopes text[] default array['read']::text[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_token text;
  v_hash text;
  v_prefix text;
  v_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  if v_org_id is null then raise exception 'sem loja ativa'; end if;

  -- token: cph_<random 32 hex>
  v_token := 'cph_' || replace(md5(random()::text || clock_timestamp()::text || auth.uid()::text), '-', '');
  v_prefix := substring(v_token from 1 for 12);
  v_hash := encode(sha256(v_token::bytea), 'hex');

  insert into public.api_keys (organization_id, user_id, name, key_hash, key_prefix, scopes)
  values (v_org_id, auth.uid(), _name, v_hash, v_prefix, _scopes)
  returning id into v_id;

  return json_build_object('id', v_id, 'token', v_token, 'prefix', v_prefix);
end;
$$;

grant execute on function public.create_api_key(text, text[]) to authenticated;
