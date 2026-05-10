-- Mercado Pago billing: plans, subscriptions, payments

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  price_cents integer not null,
  currency text not null default 'BRL',
  interval text not null default 'month',
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid not null,
  plan_id uuid not null references public.plans(id),
  status text not null default 'pending',
  mp_preapproval_id text,
  mp_payer_email text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_org on public.subscriptions(organization_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid references public.plans(id),
  provider text not null default 'mercadopago',
  mp_payment_id text unique,
  mp_preference_id text,
  mp_preapproval_id text,
  status text not null,
  status_detail text,
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  payment_method text,
  payer_email text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_payments_subscription on public.payments(subscription_id);
create index if not exists idx_payments_status on public.payments(status);

drop trigger if exists trg_plans_updated on public.plans;
create trigger trg_plans_updated before update on public.plans
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.handle_updated_at();

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

drop policy if exists "plans_read_all" on public.plans;
create policy "plans_read_all" on public.plans for select
  using (is_active = true or auth.role() = 'service_role');

drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions for select
  using (user_id = auth.uid());

drop policy if exists "subs_insert_own" on public.subscriptions;
create policy "subs_insert_own" on public.subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select
  using (user_id = auth.uid());

insert into public.plans (slug, name, description, price_cents, interval, features, sort_order) values
  ('starter',      'Starter',      'Para começar: PDV, estoque e clientes',                         4990,  'month', '["PDV","Estoque básico","Até 2 usuários","Suporte por e-mail"]'::jsonb, 1),
  ('professional', 'Profissional', 'CRM + Vendas + Financeiro + Serviços',                         9990,  'month', '["Tudo do Starter","CRM completo","Financeiro (Caixa, DRE)","Serviços/OS","Até 10 usuários","WhatsApp/Instagram"]'::jsonb, 2),
  ('business',     'Business',     'Multiusuário, automações e relatórios avançados',             19990, 'month', '["Tudo do Profissional","Automações ilimitadas","Relatórios avançados","Usuários ilimitados","Suporte prioritário"]'::jsonb, 3)
on conflict (slug) do nothing;
