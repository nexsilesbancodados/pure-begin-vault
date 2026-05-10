import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
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
create index if not exists idx_automations_lookup on public.automations(user_id, trigger_type, is_active);

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
create index if not exists idx_automation_runs_user_created on public.automation_runs(user_id, created_at desc);

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
create index if not exists idx_messages_user_lead_dir_time on public.messages(user_id, lead_id, direction, created_at desc);
create index if not exists idx_messages_user_phone_time on public.messages(user_id, phone, created_at desc);

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;

drop policy if exists "automations owner all" on public.automations;
create policy "automations owner all" on public.automations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "automation_runs owner select" on public.automation_runs;
create policy "automation_runs owner select" on public.automation_runs for select using (auth.uid() = user_id);
drop policy if exists "tasks owner all" on public.tasks;
create policy "tasks owner all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "messages owner all" on public.messages;
create policy "messages owner all" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_automations_updated on public.automations;
create trigger trg_automations_updated before update on public.automations for each row execute function public.handle_updated_at();
drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks for each row execute function public.handle_updated_at();

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.dispatch_no_reply_24h()
returns void language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  fn_url text := 'https://irjzfrhvjrvvwnxygufo.supabase.co/functions/v1/automation-runner';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyanpmcmh2anJ2dndueHlndWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjMwOTAsImV4cCI6MjA5MzQ5OTA5MH0.sAikO8-diO61Aimk49hd9mAIxcwrULPzrU0pKqUFXTs';
begin
  for r in
    with last_msg as (
      select distinct on (user_id, phone) user_id, phone, lead_id, direction, created_at
      from public.messages where phone is not null
      order by user_id, phone, created_at desc
    )
    select lm.user_id, lm.phone, lm.lead_id from last_msg lm
    where lm.direction = 'inbound' and lm.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.automation_runs ar
        where ar.user_id = lm.user_id and ar.trigger_type = 'no_reply_24h'
          and (ar.payload->>'phone') = lm.phone and ar.created_at > lm.created_at)
  loop
    perform net.http_post(url := fn_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey',anon,'Authorization','Bearer '||anon),
      body := jsonb_build_object('user_id', r.user_id, 'trigger_type','no_reply_24h',
        'payload', jsonb_build_object('phone', r.phone, 'lead_id', r.lead_id)));
  end loop;
end;
$fn$;

do $cron$ begin perform cron.unschedule('automation-no-reply-24h'); exception when others then null; end $cron$;
select cron.schedule('automation-no-reply-24h','0 * * * *', $sched$ select public.dispatch_no_reply_24h(); $sched$);
`;

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) return new Response(JSON.stringify({ error: "no SUPABASE_DB_URL" }), { status: 500 });
  const client = new Client(url);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  } finally {
    try { await client.end(); } catch {}
  }
});
