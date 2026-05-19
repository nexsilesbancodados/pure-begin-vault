// One-shot: para uma loja (organization_id), percorre todas as purchase_notes
// e, para cada item que aponta para um produto de outra loja, clona o produto
// dentro da loja atual, reescreve os items da nota e registra a entrada no
// estoque (stock_movements). Idempotente — itens já pertencentes à loja são
// mantidos inalterados.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SENTINEL_PREFIX = "__";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Descobre um user_id válido da loja (owner/admin) para FKs
    const { data: members } = await sb
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", organization_id);
    const owner = (members || []).find((m: any) => m.role === "owner") || (members || [])[0];
    const v_user = owner?.user_id ?? null;

    const { data: notes, error: nErr } = await sb
      .from("purchase_notes")
      .select("id, items")
      .eq("organization_id", organization_id);
    if (nErr) throw nErr;

    let cloned = 0;
    let kept = 0;

    for (const n of notes || []) {
      const rawItems: any[] = Array.isArray(n.items) ? n.items : [];
      const newItems: any[] = [];
      let changed = false;

      for (const it of rawItems) {
        const idStr = typeof it?.id === "string" ? it.id : "";
        const nameStr = typeof it?.name === "string" ? it.name : "";
        if (idStr.startsWith(SENTINEL_PREFIX) || nameStr.startsWith(SENTINEL_PREFIX)) {
          newItems.push(it);
          continue;
        }

        const { data: prod } = await sb
          .from("products")
          .select("*")
          .eq("id", idStr)
          .maybeSingle();

        if (!prod) {
          newItems.push(it);
          continue;
        }

        if (prod.organization_id === organization_id) {
          kept++;
          newItems.push(it);
          continue;
        }

        // Clona produto na loja atual
        const newId = crypto.randomUUID();
        const { error: insErr } = await sb.from("products").insert({
          id: newId,
          organization_id,
          user_id: v_user ?? prod.user_id,
          name: prod.name,
          sku: prod.sku,
          price: prod.price,
          cost_price: prod.cost_price,
          stock_quantity: 1,
          active: true,
          metadata: prod.metadata,
        });
        if (insErr) {
          newItems.push(it);
          continue;
        }

        await sb.from("stock_movements").insert({
          organization_id,
          user_id: v_user ?? prod.user_id,
          product_id: newId,
          movement_type: "in",
          quantity: 1,
          unit_cost: prod.cost_price,
          reason: "compra",
          reference_type: "purchase_note",
          reference_id: n.id,
        });

        const { id: _omitId, organization_id: _omitOrg, ...rest } = it;
        newItems.push({
          ...rest,
          id: newId,
          organization_id,
          stock_quantity: 1,
        });
        changed = true;
        cloned++;
      }

      if (changed) {
        await sb
          .from("purchase_notes")
          .update({ items: newItems, updated_at: new Date().toISOString() })
          .eq("id", n.id);
      }
    }

    return new Response(JSON.stringify({ cloned, kept, notes: notes?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
