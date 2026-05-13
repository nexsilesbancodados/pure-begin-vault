import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

// LGPD Art. 18 VI: portabilidade de dados.
// Retorna todos os dados do usuário em JSON.
export const Route = createFileRoute("/api/export-data")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token)
          return new Response(JSON.stringify({ error: "no_auth" }), {
            status: 401,
            headers: corsHeaders,
          });

        const {
          data: { user },
        } = await (supabaseAdmin as any).auth.getUser(token);
        if (!user)
          return new Response(JSON.stringify({ error: "invalid_token" }), {
            status: 401,
            headers: corsHeaders,
          });

        const userId = user.id;

        const orgIds = (
          (
            await (supabaseAdmin as any)
              .from("user_organizations")
              .select("organization_id")
              .eq("user_id", userId)
          ).data ?? []
        ).map((r: any) => r.organization_id);

        const tables = [
          "profiles",
          "subscriptions",
          "leads",
          "customers",
          "sales_orders",
          "sale_items",
          "sale_payments",
          "service_orders",
          "products",
          "finance_transactions",
          "bot_conversations",
          "messages",
          "notifications",
          "automation_installs",
        ];

        const out: Record<string, any> = {
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            metadata: user.user_metadata,
          },
        };

        for (const t of tables) {
          try {
            let q: any = (supabaseAdmin as any).from(t).select("*");
            if (t === "profiles") q = q.eq("id", userId);
            else if (orgIds.length) q = q.in("organization_id", orgIds);
            else q = q.eq("user_id", userId);
            const { data } = await q.limit(5000);
            out[t] = data ?? [];
          } catch {
            out[t] = [];
          }
        }

        return new Response(JSON.stringify(out, null, 2), {
          headers: {
            ...corsHeaders,
            "Content-Disposition": `attachment; filename="conectaphone-data-${userId.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json"`,
          },
        });
      },
    },
  },
});
