import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Content-Type": "application/json",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(request: Request): Promise<{ orgId: string; scopes: string[] } | null> {
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!apiKey || !apiKey.startsWith("cph_")) return null;
  const hash = await sha256Hex(apiKey);
  const { data } = await (supabaseAdmin as any)
    .from("api_keys")
    .select("organization_id, scopes, id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  // atualiza last_used_at (fire-and-forget)
  (supabaseAdmin as any).from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { orgId: data.organization_id, scopes: data.scopes ?? ["read"] };
}

const ENDPOINTS: Record<string, { method: string; handler: (orgId: string, params: any) => Promise<any> }> = {
  "v1/customers": {
    method: "GET",
    handler: async (orgId) => {
      const { data } = await (supabaseAdmin as any)
        .from("customers").select("id, name, phone, email, document, created_at")
        .eq("organization_id", orgId).limit(1000);
      return { data: data ?? [] };
    },
  },
  "v1/products": {
    method: "GET",
    handler: async (orgId) => {
      const { data } = await (supabaseAdmin as any)
        .from("products").select("id, name, sku, ean, price, stock_quantity, category")
        .eq("organization_id", orgId).eq("active", true).limit(1000);
      return { data: data ?? [] };
    },
  },
  "v1/sales": {
    method: "GET",
    handler: async (orgId) => {
      const { data } = await (supabaseAdmin as any)
        .from("sales_orders").select("id, sale_number, total_amount, status, payment_method, created_at, customer_id")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(500);
      return { data: data ?? [] };
    },
  },
  "v1/orders": {
    method: "GET",
    handler: async (orgId) => {
      const { data } = await (supabaseAdmin as any)
        .from("service_orders").select("id, os_number, equipment, status, customer_id, created_at, total_cost")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(500);
      return { data: data ?? [] };
    },
  },
  "v1/stats": {
    method: "GET",
    handler: async (orgId) => {
      const [{ count: customers }, { count: products }, { count: sales }, { count: orders }] = await Promise.all([
        (supabaseAdmin as any).from("customers").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        (supabaseAdmin as any).from("products").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("active", true),
        (supabaseAdmin as any).from("sales_orders").select("id", { count: "exact", head: true }).eq("organization_id", orgId).neq("status", "cancelada"),
        (supabaseAdmin as any).from("service_orders").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      ]);
      return { data: { customers, products, sales, orders } };
    },
  },
};

export const Route = createFileRoute("/api/public/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (!auth) return new Response(JSON.stringify({ error: "invalid_api_key" }), { status: 401, headers: corsHeaders });

        const path = params._splat ?? "";
        const ep = ENDPOINTS[path];
        if (!ep) {
          return new Response(JSON.stringify({
            error: "not_found",
            available: Object.keys(ENDPOINTS).map((k) => `/api/public/${k}`),
          }), { status: 404, headers: corsHeaders });
        }
        try {
          const r = await ep.handler(auth.orgId, null);
          return new Response(JSON.stringify(r), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: corsHeaders });
        }
      },
    },
  },
});
