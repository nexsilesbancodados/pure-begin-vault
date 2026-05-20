import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
ALTER TABLE public.purchase_notes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'compra';
ALTER TABLE public.purchase_notes ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.purchase_notes ADD COLUMN IF NOT EXISTS sale_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_notes_kind_check') THEN
    ALTER TABLE public.purchase_notes ADD CONSTRAINT purchase_notes_kind_check CHECK (kind IN ('compra','venda'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_purchase_notes_kind ON public.purchase_notes(organization_id, kind);
NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) return new Response(JSON.stringify({ error: "no SUPABASE_DB_URL" }), { status: 500 });
  const client = new Client(url);
  try {
    await client.connect();
    const errors: string[] = [];
    const stmts = SQL.split(/;\s*\n(?=(?:alter|create|do|notify)\b)/i);
    let ran = 0;
    for (const s of stmts) {
      const sql = s.trim().replace(/;$/, "");
      if (!sql) continue;
      try { await client.queryArray(sql); ran++; }
      catch (e) { errors.push(String((e as Error).message)); }
    }
    return new Response(JSON.stringify({ ok: errors.length === 0, ran, errors }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), { status: 500 });
  } finally { try { await client.end(); } catch { /* noop */ } }
});
