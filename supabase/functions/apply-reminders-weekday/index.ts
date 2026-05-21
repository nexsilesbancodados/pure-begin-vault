import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
alter table public.recurring_reminders
  add column if not exists frequency text not null default 'monthly',
  add column if not exists days_of_week integer[] not null default '{}';

alter table public.recurring_reminders
  alter column day_of_month drop not null;
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
