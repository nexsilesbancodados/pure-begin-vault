// One-shot: para cada produto da organização cujo stock_quantity esteja zerado/nulo,
// soma as quantidades em sale_items e usa esse valor como estoque inicial. Cria também
// um stock_movement de entrada (referência 'backfill').
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pega produtos com estoque zerado/nulo
    const { data: prods, error: pErr } = await sb
      .from("products")
      .select("id,name,stock_quantity")
      .eq("organization_id", organization_id)
      .or("stock_quantity.is.null,stock_quantity.eq.0");
    if (pErr) throw pErr;
    if (!prods?.length) {
      return new Response(JSON.stringify({ updated: 0, message: "Nada para corrigir" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = prods.map((p: any) => p.id);
    // Soma de quantidades vendidas por produto
    const { data: items, error: iErr } = await sb
      .from("sale_items")
      .select("product_id,quantity")
      .in("product_id", ids);
    if (iErr) throw iErr;
    const sumByProduct = new Map<string, number>();
    for (const it of (items || []) as any[]) {
      const q = Number(it.quantity) || 0;
      sumByProduct.set(it.product_id, (sumByProduct.get(it.product_id) || 0) + q);
    }

    let updated = 0;
    const userId = (prods[0] as any).user_id || null;
    for (const p of prods as any[]) {
      const qty = sumByProduct.get(p.id) || 0;
      if (qty <= 0) continue;
      const { error: uErr } = await sb
        .from("products")
        .update({ stock_quantity: qty, status: "in_stock", min_stock: 1 })
        .eq("id", p.id);
      if (uErr) {
        // fallback sem colunas opcionais
        await sb.from("products").update({ stock_quantity: qty }).eq("id", p.id);
      }
      await sb.from("stock_movements").insert({
        organization_id,
        user_id: userId,
        product_id: p.id,
        movement_type: "in",
        quantity: qty,
        reason: "Backfill de estoque (importação)",
        reference_type: "backfill",
      });
      updated++;
    }

    return new Response(JSON.stringify({ updated, scanned: prods.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
