// One-shot: corrige custo (cost_price/unit_cost) das notas espelhadas de parceiros
// para igualar ao preço de venda registrado no item.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: notes, error } = await supabase
    .from("purchase_notes")
    .select("id, items, fornecedor")
    .ilike("fornecedor", "Atacado Cell%");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  for (const n of notes ?? []) {
    const items = Array.isArray(n.items) ? n.items : [];
    let changed = false;
    const fixed = items.map((it: any) => {
      const price = Number(it?.price ?? 0);
      const cost = Number(it?.cost_price ?? 0);
      if (price > 0 && (!cost || cost === 0)) {
        changed = true;
        return { ...it, cost_price: price, unit_cost: price };
      }
      return it;
    });
    if (changed) {
      const { error: upErr } = await supabase
        .from("purchase_notes")
        .update({ items: fixed })
        .eq("id", n.id);
      if (!upErr) updated += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, updated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
