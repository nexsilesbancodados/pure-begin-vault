import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await (supabaseAdmin as any)
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function fetchMetrics() {
  const [{ data: m }, { data: subsBreakdown }, { data: recentOrgs }] = await Promise.all([
    (supabaseAdmin as any).from("admin_metrics").select("*").maybeSingle(),
    (supabaseAdmin as any)
      .from("subscriptions")
      .select("plan_id, status, plans(name, price_cents)")
      .eq("status", "active"),
    (supabaseAdmin as any)
      .from("organizations")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const planRevenue: Record<string, { name: string; count: number; mrr_cents: number }> = {};
  for (const s of (subsBreakdown ?? []) as any[]) {
    const k = s.plan_id;
    const name = s.plans?.name ?? "—";
    const price = s.plans?.price_cents ?? 0;
    if (!planRevenue[k]) planRevenue[k] = { name, count: 0, mrr_cents: 0 };
    planRevenue[k].count += 1;
    planRevenue[k].mrr_cents += price;
  }

  return {
    metrics: m ?? {},
    plan_breakdown: Object.values(planRevenue),
    recent_orgs: recentOrgs ?? [],
  };
}

export const Route = createFileRoute("/api/admin-metrics")({
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

        // valida JWT e pega user
        const {
          data: { user },
        } = await (supabaseAdmin as any).auth.getUser(token);
        if (!user)
          return new Response(JSON.stringify({ error: "invalid_token" }), {
            status: 401,
            headers: corsHeaders,
          });

        const sa = await isSuperAdmin(user.id);
        if (!sa)
          return new Response(JSON.stringify({ error: "not_super_admin" }), {
            status: 403,
            headers: corsHeaders,
          });

        const data = await fetchMetrics();
        return new Response(JSON.stringify(data), { headers: corsHeaders });
      },
    },
  },
});
