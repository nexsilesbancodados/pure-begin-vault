import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

async function fetchOsPublic(id: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const isNumber = /^\d+$/.test(id);

  let query: any = (supabaseAdmin as any)
    .from("service_orders")
    .select(
      "id, os_number, equipment, brand, model, imei, problem_description, diagnosis, solution, status, priority, estimated_cost, total_cost, warranty_days, due_date, delivered_at, created_at, updated_at, organization_id",
    );

  if (isUuid) query = query.eq("id", id);
  else if (isNumber) query = query.eq("os_number", Number(id));
  else return { error: "invalid_id", status: 400 };

  const { data, error } = await query.maybeSingle();
  if (error || !data) return { error: "not_found", status: 404 };

  const { data: org } = await (supabaseAdmin as any)
    .from("organizations")
    .select("name")
    .eq("id", data.organization_id)
    .maybeSingle();

  return {
    status: 200,
    os: {
      ...data,
      organization_id: undefined,
    },
    org_name: org?.name ?? null,
  };
}

export const Route = createFileRoute("/api/os-public/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const result = await fetchOsPublic(String(params.id ?? ""));
        if (result.error) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status,
            headers: corsHeaders,
          });
        }
        return new Response(JSON.stringify({ os: result.os, org_name: result.org_name }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Cache-Control": "public, max-age=30",
          },
        });
      },
    },
  },
});
