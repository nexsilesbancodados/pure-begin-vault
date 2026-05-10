-- Automations infrastructure (user_id-scoped)

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  action_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_automations_lookup
  on public.automations(user_id, trigger_type, is_active);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  automation_id uuid not null references public.automations(id) on delete cascade,
  trigger_type text not null,
  action_type text not null,
  status text not null,
  payload jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_runs_user_created
  on public.automation_runs(user_id, created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'pending',
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_status on public.tasks(user_id, status);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  phone text,
  direction text not null check (direction in ('inbound','outbound')),
  content text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_user_lead_dir_time
  on public.messages(user_id, lead_id, direction, created_at desc);
create index if not exists idx_messages_user_phone_time
  on public.messages(user_id, phone, created_at desc);

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;

create policy "automations owner all" on public.automations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "automation_runs owner select" on public.automation_runs
  for select using (auth.uid() = user_id);

create policy "tasks owner all" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages owner all" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_automations_updated before update on public.automations
  for each row execute function public.handle_updated_at();
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.handle_updated_at();
