import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
-- ============= ROLES =============
do $$ begin
  create type public.app_role as enum ('admin','vendedor','financeiro','suporte');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, role)
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_user_roles_org on public.user_roles(organization_id);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _org uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.user_roles
    where user_id = _user_id and organization_id = _org and role = _role)
$fn$;

create or replace function public.is_org_member(_user_id uuid, _org uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.profiles
    where id = _user_id and organization_id = _org)
$fn$;

drop policy if exists "user_roles select own org" on public.user_roles;
create policy "user_roles select own org" on public.user_roles
  for select using (public.is_org_member(auth.uid(), organization_id));

drop policy if exists "user_roles admin manage" on public.user_roles;
create policy "user_roles admin manage" on public.user_roles
  for all using (public.has_role(auth.uid(), organization_id, 'admin'))
  with check (public.has_role(auth.uid(), organization_id, 'admin'));

-- Bootstrap: dono da organização vira admin
insert into public.user_roles (user_id, organization_id, role)
select o.owner_id, o.id, 'admin'::public.app_role
from public.organizations o
on conflict do nothing;

-- ============= NOTIFICATIONS =============
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications owner all" on public.notifications;
create policy "notifications owner all" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.notifications;

-- ============= NPS =============
create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  score int not null check (score >= 0 and score <= 10),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_nps_org on public.nps_responses(organization_id, created_at desc);
alter table public.nps_responses enable row level security;
drop policy if exists "nps owner all" on public.nps_responses;
create policy "nps owner all" on public.nps_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "nps org read" on public.nps_responses;
create policy "nps org read" on public.nps_responses
  for select using (public.is_org_member(auth.uid(), organization_id));
`;

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) return new Response(JSON.stringify({ error: "no SUPABASE_DB_URL" }), { status: 500 });
  const client = new Client(url);
  try {
    await client.connect();
    // executa em transação tolerante (alter publication pode falhar se já existe)
    // strip SQL comments to keep splitter reliable
    const cleaned = SQL.replace(/^\s*--[^\n]*\n/gm, "").replace(/\n{2,}/g, "\n");
    const stmts = cleaned.split(/;\s*\n(?=(?:create|alter|drop|insert|do)\b)/i);
    for (const s of stmts) {
      const sql = s.trim();
      if (!sql) continue;
      try { await client.queryArray(sql); }
      catch (e: any) {
        const msg = String(e?.message || e);
        if (!/already exists|is already member of publication/i.test(msg)) throw e;
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  } finally { try { await client.end(); } catch {} }
});
