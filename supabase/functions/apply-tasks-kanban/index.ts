import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) return new Response(JSON.stringify({ error: "no SUPABASE_DB_URL" }), { status: 500 });
  const client = new Client(url);
  const errors: string[] = [];
  try {
    await client.connect();
    const stmts = [
      `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to uuid`,
      `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS board_order int NOT NULL DEFAULT 0`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_org_due ON public.tasks(organization_id, due_date)`,
      `NOTIFY pgrst, 'reload schema'`,
    ];
    let ran = 0;
    for (const s of stmts) {
      try { await client.queryArray(s); ran++; }
      catch (e) { errors.push(String((e as Error).message)); }
    }
    return new Response(JSON.stringify({ ok: errors.length === 0, ran, errors }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), { status: 500 });
  } finally { try { await client.end(); } catch { /* noop */ } }
});
