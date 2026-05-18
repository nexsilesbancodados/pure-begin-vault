import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

async function fetchReceipt(id: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const isNumber = /^\d+$/.test(id);

  let query: any = (supabaseAdmin as any).from("sales_orders").select(`
      id, sale_number, created_at, status, channel, payment_method,
      subtotal, discount, addition, total_amount,
      customer_id, organization_id, seller_id
    `);

  if (isUuid) query = query.eq("id", id);
  else if (isNumber) query = query.eq("sale_number", Number(id));
  else return { error: "invalid_id", status: 400 };

  const { data: sale, error } = await query.maybeSingle();
  if (error || !sale) return { error: "not_found", status: 404 };

  const [{ data: items }, { data: payments }, { data: org }, { data: orgSettings }, { data: customer }, { data: seller }] =
    await Promise.all([
      (supabaseAdmin as any).from("sale_items").select("*").eq("sale_id", sale.id),
      (supabaseAdmin as any).from("sale_payments").select("*").eq("sale_id", sale.id),
      (supabaseAdmin as any)
        .from("organizations")
        .select("name")
        .eq("id", sale.organization_id)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("organization_settings")
        .select("*")
        .eq("organization_id", sale.organization_id)
        .maybeSingle(),
      sale.customer_id
        ? (supabaseAdmin as any)
            .from("customers")
            .select("*")
            .eq("id", sale.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sale.seller_id
        ? (supabaseAdmin as any)
            .from("profiles")
            .select("full_name, email")
            .eq("id", sale.seller_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const s: any = orgSettings ?? {};
  return {
    status: 200,
    sale: { ...sale, organization_id: undefined },
    items: items ?? [],
    payments: payments ?? [],
    org_name: org?.name ?? "Loja",
    org: {
      address: s.address ?? s.endereco ?? null,
      cnpj: s.cnpj ?? s.document ?? null,
      phone: s.phone ?? s.telefone ?? null,
      website: s.website ?? null,
    },
    seller: seller ? { name: seller.full_name || seller.email } : null,
    customer: customer ?? null,
  };
}

export const Route = createFileRoute("/api/receipt/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const r = await fetchReceipt(String(params.id ?? ""));
        if (r.error) {
          return new Response(JSON.stringify({ error: r.error }), {
            status: r.status,
            headers: corsHeaders,
          });
        }
        return new Response(JSON.stringify(r), {
          status: 200,
          headers: { ...corsHeaders, "Cache-Control": "public, max-age=60" },
        });
      },
    },
  },
});
