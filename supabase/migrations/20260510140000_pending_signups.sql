create table if not exists public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  phone text,
  plan_id uuid not null references public.plans(id),
  status text not null default 'pending', -- pending | paid | failed | provisioned
  mp_payment_id text,
  mp_preference_id text,
  organization_id uuid,
  user_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pending_signups_email on public.pending_signups(email);
create index if not exists idx_pending_signups_payment on public.pending_signups(mp_payment_id);
create index if not exists idx_pending_signups_status on public.pending_signups(status);

drop trigger if exists trg_pending_signups_updated on public.pending_signups;
create trigger trg_pending_signups_updated before update on public.pending_signups
  for each row execute function public.handle_updated_at();

-- Sem RLS pública: somente service_role acessa (RLS habilitada sem policies = nega tudo)
alter table public.pending_signups enable row level security;
