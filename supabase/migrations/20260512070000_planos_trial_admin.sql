-- Seed dos planos + trial automático + admin tools
-- Roda idempotente

------------------------------------------------------------
-- 1. Seed planos (3 tiers loja celular)
------------------------------------------------------------
insert into public.plans (slug, name, description, price_cents, currency, interval, features, sort_order, is_active)
values
  ('starter', 'Starter',
   '1 loja · 1 WhatsApp · até 500 contatos · suporte por email',
   4990, 'BRL', 'month',
   '{"lojas":1,"whatsapp_instances":1,"contatos_max":500,"usuarios_max":2,"bot_ia":true,"automacoes":true,"cupons":true,"orcamentos":true,"backup":true}'::jsonb,
   1, true),

  ('pro', 'Pro',
   '3 lojas · 3 WhatsApp · contatos ilimitados · suporte prioritário · API pública',
   9990, 'BRL', 'month',
   '{"lojas":3,"whatsapp_instances":3,"contatos_max":null,"usuarios_max":10,"bot_ia":true,"automacoes":true,"cupons":true,"orcamentos":true,"backup":true,"api_publica":true,"prioridade":true}'::jsonb,
   2, true),

  ('business', 'Business',
   'Lojas ilimitadas · WhatsApp ilimitado · multi-canal · gerente de conta dedicado',
   24990, 'BRL', 'month',
   '{"lojas":null,"whatsapp_instances":null,"contatos_max":null,"usuarios_max":null,"bot_ia":true,"automacoes":true,"cupons":true,"orcamentos":true,"backup":true,"api_publica":true,"prioridade":true,"multi_canal":true,"gerente_dedicado":true}'::jsonb,
   3, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  features = excluded.features,
  sort_order = excluded.sort_order,
  is_active = true;

------------------------------------------------------------
-- 2. Trial automático: trigger ao criar profile com organization_id
------------------------------------------------------------
create or replace function public.grant_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starter_id uuid;
begin
  if new.organization_id is null then return new; end if;

  -- pega o plano starter
  select id into v_starter_id from public.plans where slug = 'starter' and is_active = true limit 1;
  if v_starter_id is null then return new; end if;

  -- evita duplicação se já tem subscription
  if exists (select 1 from public.subscriptions where user_id = new.id) then
    return new;
  end if;

  insert into public.subscriptions (
    user_id, organization_id, plan_id, status,
    current_period_start, current_period_end
  ) values (
    new.id, new.organization_id, v_starter_id, 'trial',
    now(), now() + interval '7 days'
  );

  return new;
end;
$$;

drop trigger if exists trg_grant_trial on public.profiles;
create trigger trg_grant_trial
after insert or update of organization_id on public.profiles
for each row execute function public.grant_trial_subscription();

------------------------------------------------------------
-- 3. Admin view pra SaaS owner — métricas globais
------------------------------------------------------------
create or replace view public.admin_metrics as
select
  (select count(*) from auth.users) as total_users,
  (select count(*) from public.organizations) as total_orgs,
  (select count(*) from public.subscriptions where status = 'active') as active_subs,
  (select count(*) from public.subscriptions where status = 'trial') as trial_subs,
  (select count(*) from public.subscriptions where status = 'cancelled') as cancelled_subs,
  (select coalesce(sum(p.price_cents), 0)
     from public.subscriptions s
     join public.plans p on p.id = s.plan_id
     where s.status = 'active') as mrr_cents,
  (select count(*) from public.sales_orders where created_at > now() - interval '24 hours') as sales_24h,
  (select count(*) from public.service_orders where created_at > now() - interval '24 hours') as os_24h;

-- Só super_admin acessa
revoke all on public.admin_metrics from anon, authenticated;
grant select on public.admin_metrics to service_role;

------------------------------------------------------------
-- 4. Tabela super_admin (sua conta)
------------------------------------------------------------
create table if not exists public.super_admins (
  user_id uuid primary key,
  granted_at timestamptz default now(),
  granted_by uuid
);

alter table public.super_admins enable row level security;

drop policy if exists "super_admins self select" on public.super_admins;
create policy "super_admins self select" on public.super_admins
  for select using (user_id = auth.uid());

-- RPC pra checar se user é super admin (usado no front)
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.super_admins where user_id = auth.uid())
$$;

grant execute on function public.is_super_admin() to authenticated;
