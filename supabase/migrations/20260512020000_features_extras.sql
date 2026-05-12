-- Migrations para features avançadas: audit logs, agendamento de mensagens, broadcasts, tags em leads, anexos de OS.
-- Aplicar via supabase db push (precisa DB password) ou Supabase Studio SQL Editor.

------------------------------------------------------------
-- 1. AUDIT LOGS
------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs select own org" on public.audit_logs;
create policy "audit_logs select own org" on public.audit_logs
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "audit_logs insert own" on public.audit_logs;
create policy "audit_logs insert own" on public.audit_logs
  for insert with check (user_id = auth.uid());

------------------------------------------------------------
-- 2. SCHEDULED MESSAGES (agendamento WhatsApp)
------------------------------------------------------------
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  to_phone text not null,
  body text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending', -- pending|sent|failed|cancelled
  error text,
  instance_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scheduled_messages_due_idx on public.scheduled_messages (scheduled_at) where status = 'pending';
create index if not exists scheduled_messages_org_idx on public.scheduled_messages (organization_id, scheduled_at desc);

alter table public.scheduled_messages enable row level security;

drop policy if exists "scheduled_messages select own org" on public.scheduled_messages;
create policy "scheduled_messages select own org" on public.scheduled_messages
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "scheduled_messages insert own" on public.scheduled_messages;
create policy "scheduled_messages insert own" on public.scheduled_messages
  for insert with check (user_id = auth.uid());

drop policy if exists "scheduled_messages update own org" on public.scheduled_messages;
create policy "scheduled_messages update own org" on public.scheduled_messages
  for update using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "scheduled_messages delete own org" on public.scheduled_messages;
create policy "scheduled_messages delete own org" on public.scheduled_messages
  for delete using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

------------------------------------------------------------
-- 3. BROADCASTS (disparo em massa)
------------------------------------------------------------
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  body text not null,
  audience jsonb default '{}'::jsonb,  -- {tag: 'x', stage_id: 'y', filter: '...'}
  total_targets int default 0,
  sent_count int default 0,
  failed_count int default 0,
  status text not null default 'draft', -- draft|scheduled|sending|done|cancelled
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists broadcasts_org_idx on public.broadcasts (organization_id, created_at desc);
alter table public.broadcasts enable row level security;

drop policy if exists "broadcasts select own org" on public.broadcasts;
create policy "broadcasts select own org" on public.broadcasts
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "broadcasts cud own" on public.broadcasts;
create policy "broadcasts cud own" on public.broadcasts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

------------------------------------------------------------
-- 4. TAGS EM LEADS (coluna tags text[])
------------------------------------------------------------
alter table public.leads
  add column if not exists tags text[] default '{}'::text[];

create index if not exists leads_tags_gin_idx on public.leads using gin (tags);

------------------------------------------------------------
-- 5. OS ATTACHMENTS (fotos antes/depois)
------------------------------------------------------------
create table if not exists public.service_order_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null,
  user_id uuid not null,
  storage_path text not null,
  public_url text,
  kind text not null default 'photo', -- photo|video|document
  category text, -- 'antes' | 'depois' | 'evidencia' | 'recibo'
  description text,
  created_at timestamptz default now()
);

create index if not exists service_order_attachments_os_idx
  on public.service_order_attachments (service_order_id, created_at desc);

alter table public.service_order_attachments enable row level security;

drop policy if exists "service_order_attachments select own org" on public.service_order_attachments;
create policy "service_order_attachments select own org" on public.service_order_attachments
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "service_order_attachments cud own" on public.service_order_attachments;
create policy "service_order_attachments cud own" on public.service_order_attachments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

------------------------------------------------------------
-- 6. ORG SETTINGS (extensível, K/V por org)
------------------------------------------------------------
create table if not exists public.organization_settings (
  organization_id uuid primary key,
  pix_key text,
  pix_merchant_name text,
  pix_merchant_city text,
  commission_percent numeric default 3,
  whatsapp_track_base_url text, -- ex: https://conectaphone.com/os-track
  fiscal_provider text, -- focus|enotas|plugnotas|null
  fiscal_token text,
  updated_at timestamptz default now()
);

alter table public.organization_settings enable row level security;

drop policy if exists "org_settings select own" on public.organization_settings;
create policy "org_settings select own" on public.organization_settings
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "org_settings cud own" on public.organization_settings;
create policy "org_settings cud own" on public.organization_settings
  for all using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  ) with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
