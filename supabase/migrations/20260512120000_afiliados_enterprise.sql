-- Programa de afiliados + plano Enterprise + whitelabel
-- Afiliados: cada loja pode gerar link único; quando cliente novo se cadastra via link, comissão recorrente vincula.

create table if not exists public.affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  code text not null unique,
  commission_percent numeric default 30,
  total_referrals int default 0,
  total_paid_cents bigint default 0,
  created_at timestamptz default now()
);

create index if not exists affiliate_codes_user_idx on public.affiliate_codes (user_id);
create unique index if not exists affiliate_codes_code_uniq on public.affiliate_codes (code);

alter table public.affiliate_codes enable row level security;

drop policy if exists "affiliate_codes select own" on public.affiliate_codes;
create policy "affiliate_codes select own" on public.affiliate_codes
  for select using (user_id = auth.uid());

drop policy if exists "affiliate_codes cud own" on public.affiliate_codes;
create policy "affiliate_codes cud own" on public.affiliate_codes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tabela de referrals: quando user X usou código de Y
create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null,
  referred_user_id uuid not null unique,
  affiliate_code_id uuid references public.affiliate_codes(id),
  status text default 'pending', -- pending|active|cancelled
  first_payment_at timestamptz,
  total_paid_cents bigint default 0,
  created_at timestamptz default now()
);

create index if not exists affiliate_referrals_aff_idx on public.affiliate_referrals (affiliate_user_id);

alter table public.affiliate_referrals enable row level security;

drop policy if exists "affiliate_referrals select own" on public.affiliate_referrals;
create policy "affiliate_referrals select own" on public.affiliate_referrals
  for select using (affiliate_user_id = auth.uid());

-- RPC pra gerar código affiliate
create or replace function public.create_affiliate_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  -- Verifica se já tem
  select code into v_code from public.affiliate_codes where user_id = auth.uid() limit 1;
  if v_code is not null then return v_code; end if;

  -- Gera código único 8 chars
  v_code := upper(substring(md5(auth.uid()::text || clock_timestamp()::text) from 1 for 8));

  insert into public.affiliate_codes (user_id, organization_id, code)
  values (auth.uid(), v_org, v_code);

  return v_code;
end;
$$;

grant execute on function public.create_affiliate_code() to authenticated;

------------------------------------------------------------
-- Plano Enterprise (4º tier acima de Business)
------------------------------------------------------------
insert into public.plans (slug, name, description, price_cents, currency, interval, features, sort_order, is_active)
values (
  'enterprise', 'Enterprise',
  'Para redes de lojas. Lojas + WhatsApp + usuários ilimitados, SLA 99,9%, gerente dedicado, multi-CNPJ, whitelabel opcional, SSO, audit trail completo, API priority.',
  99990, 'BRL', 'month',
  '["Lojas/usuários/WhatsApp ilimitados","Multi-CNPJ no mesmo painel","Whitelabel opcional","SSO Google/Microsoft","SLA 99,9% garantido","Gerente de conta dedicado","Audit trail completo","API priority rate limit","Onboarding 1:1","Backup off-site S3"]'::jsonb,
  4, true
)
on conflict (slug) do update set
  features = excluded.features,
  description = excluded.description,
  price_cents = excluded.price_cents,
  is_active = true;

------------------------------------------------------------
-- Whitelabel: branding por org
------------------------------------------------------------
alter table public.organization_settings
  add column if not exists brand_name text,
  add column if not exists brand_logo_url text,
  add column if not exists brand_primary_color text,
  add column if not exists support_email text,
  add column if not exists support_whatsapp text;
