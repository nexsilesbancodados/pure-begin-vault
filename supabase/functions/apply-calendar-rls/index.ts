import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
create or replace function public.is_super_calendar_editor()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = 'alfatech791@gmail.com')
$$;

create or replace function public.is_today_brt(_ts timestamptz)
returns boolean language sql immutable as $$
  select _ts is not null and (_ts at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
$$;

drop policy if exists "tasks owner all" on public.tasks;
drop policy if exists "org_members_tasks" on public.tasks;
drop policy if exists "tasks select org members" on public.tasks;
drop policy if exists "tasks insert today or super" on public.tasks;
drop policy if exists "tasks update today or super" on public.tasks;
drop policy if exists "tasks delete today or super" on public.tasks;

create policy "tasks select org members" on public.tasks for select to authenticated using (
  organization_id is null
  or organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
  or user_id = auth.uid()
);
create policy "tasks insert today or super" on public.tasks for insert to authenticated with check (
  user_id = auth.uid() and (public.is_super_calendar_editor() or due_date is null or public.is_today_brt(due_date))
);
create policy "tasks update today or super" on public.tasks for update to authenticated
  using (user_id = auth.uid() and (public.is_super_calendar_editor() or public.is_today_brt(due_date)))
  with check (user_id = auth.uid() and (public.is_super_calendar_editor() or public.is_today_brt(due_date)));
create policy "tasks delete today or super" on public.tasks for delete to authenticated
  using (user_id = auth.uid() and (public.is_super_calendar_editor() or public.is_today_brt(due_date)));

drop policy if exists "members insert completions" on public.daily_task_completions;
drop policy if exists "members delete own completions" on public.daily_task_completions;
drop policy if exists "members insert completions today" on public.daily_task_completions;
drop policy if exists "members delete own completions today" on public.daily_task_completions;

create policy "members insert completions today" on public.daily_task_completions for insert to authenticated with check (
  user_id = auth.uid()
  and (public.is_super_calendar_editor() or date = (now() at time zone 'America/Sao_Paulo')::date)
  and (
    organization_id in (select uo.organization_id from public.user_organizations uo where uo.user_id = auth.uid())
    or organization_id in (select t.organization_id from public.daily_task_templates t where t.created_by = auth.uid())
  )
);
create policy "members delete own completions today" on public.daily_task_completions for delete to authenticated using (
  user_id = auth.uid() and (public.is_super_calendar_editor() or date = (now() at time zone 'America/Sao_Paulo')::date)
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
