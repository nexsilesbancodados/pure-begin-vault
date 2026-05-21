import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
create table if not exists public.recurring_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  title text not null,
  amount numeric(12,2),
  day_of_month integer not null check (day_of_month between 1 and 31),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_reminders_org_idx on public.recurring_reminders(organization_id, active);

create table if not exists public.reminder_completions (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.recurring_reminders(id) on delete cascade,
  organization_id uuid not null,
  year integer not null,
  month integer not null check (month between 1 and 12),
  completed_by uuid not null,
  completed_by_name text,
  completed_at timestamptz not null default now(),
  unique (reminder_id, year, month)
);
create index if not exists reminder_completions_org_idx on public.reminder_completions(organization_id, year, month);

alter table public.recurring_reminders enable row level security;
alter table public.reminder_completions enable row level security;

drop policy if exists "rr select org" on public.recurring_reminders;
drop policy if exists "rr insert org" on public.recurring_reminders;
drop policy if exists "rr update org" on public.recurring_reminders;
drop policy if exists "rr delete org" on public.recurring_reminders;

create policy "rr select org" on public.recurring_reminders for select to authenticated using (
  organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);
create policy "rr insert org" on public.recurring_reminders for insert to authenticated with check (
  user_id = auth.uid()
  and organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);
create policy "rr update org" on public.recurring_reminders for update to authenticated using (
  organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
) with check (
  organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);
create policy "rr delete org" on public.recurring_reminders for delete to authenticated using (
  organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);

drop policy if exists "rc select org" on public.reminder_completions;
drop policy if exists "rc insert org" on public.reminder_completions;
drop policy if exists "rc delete own" on public.reminder_completions;

create policy "rc select org" on public.reminder_completions for select to authenticated using (
  organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);
create policy "rc insert org" on public.reminder_completions for insert to authenticated with check (
  completed_by = auth.uid()
  and organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);
create policy "rc delete own" on public.reminder_completions for delete to authenticated using (
  completed_by = auth.uid()
  and organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
);
`;

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response(JSON.stringify({ error: "SUPABASE_DB_URL ausente" }), { status: 500 });
  const client = new Client(dbUrl);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500, headers: { "Content-Type": "application/json" } });
  } finally {
    try { await client.end(); } catch {}
  }
});
