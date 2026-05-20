// Deno - one-off to add kind/customer_name/sale_ids to purchase_notes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key);
  const sql = `
    ALTER TABLE public.purchase_notes
      ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'compra',
      ADD COLUMN IF NOT EXISTS customer_name text,
      ADD COLUMN IF NOT EXISTS sale_ids uuid[] DEFAULT '{}'::uuid[];
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_notes_kind_check') THEN
        ALTER TABLE public.purchase_notes
          ADD CONSTRAINT purchase_notes_kind_check CHECK (kind IN ('compra','venda'));
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_purchase_notes_kind ON public.purchase_notes(organization_id, kind);
    NOTIFY pgrst, 'reload schema';
  `;
  // Use admin.rpc via raw fetch to the SQL endpoint isn't available; use a stored function fallback.
  const resp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: sql }),
  });
  const text = await resp.text();
  return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, body: text }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
