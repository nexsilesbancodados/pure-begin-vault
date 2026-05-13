import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Orçamento usa sales_orders com status='quote' ou 'orcamento'
async function fetchQuote(id: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const isNumber = /^\d+$/.test(id);

  let query: any = (supabaseAdmin as any).from("sales_orders").select("*");
  if (isUuid) query = query.eq("id", id);
  else if (isNumber) query = query.eq("sale_number", Number(id));
  else return { error: "invalid_id", status: 400 };

  const { data: q, error } = await query.maybeSingle();
  if (error || !q) return { error: "not_found", status: 404 };

  const [{ data: items }, { data: org }, { data: customer }] = await Promise.all([
    (supabaseAdmin as any).from("sale_items").select("*").eq("sale_id", q.id),
    (supabaseAdmin as any)
      .from("organizations")
      .select("name")
      .eq("id", q.organization_id)
      .maybeSingle(),
    q.customer_id
      ? (supabaseAdmin as any)
          .from("customers")
          .select("name, document, phone, email")
          .eq("id", q.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    status: 200,
    quote: { ...q, organization_id: undefined },
    items: items ?? [],
    org_name: org?.name ?? "Loja",
    customer: customer ?? null,
  };
}

export const Route = createFileRoute("/api/quote/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const r = await fetchQuote(String(params.id ?? ""));
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
