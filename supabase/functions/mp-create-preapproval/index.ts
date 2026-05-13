// deno-lint-ignore-file
// Cria preapproval (assinatura recorrente) no Mercado Pago.
// Usado pra cobrar mensalmente em vez de pagamento único.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const plan_id = body.plan_id as string;
    const back_url = body.back_url as string;

    if (!plan_id) {
      return new Response(JSON.stringify({ error: "plan_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Busca plano
    const { data: plan } = await admin.from("plans").select("*").eq("id", plan_id).eq("is_active", true).maybeSingle();
    if (!plan) {
      return new Response(JSON.stringify({ error: "plan_not_found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const email = u.user.email!;
    const amount = plan.price_cents / 100;
    const frequency = plan.interval === "year" ? 12 : 1; // meses
    const frequency_type = "months";

    // Cria preapproval no MP
    const preapprovalBody = {
      reason: `ConectaCRM ${plan.name}`,
      external_reference: `${u.user.id}:${plan.id}`,
      payer_email: email,
      back_url: back_url || `${req.headers.get("origin") || "https://conectaphone.com"}/minha-conta`,
      auto_recurring: {
        frequency,
        frequency_type,
        transaction_amount: amount,
        currency_id: plan.currency || "BRL",
      },
      status: "pending",
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalBody),
    });

    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP preapproval error", mpJson);
      return new Response(JSON.stringify({ error: "mp_error", details: mpJson }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Pega org_id do user
    const { data: prof } = await admin.from("profiles").select("organization_id").eq("id", u.user.id).maybeSingle();
    const orgId = prof?.organization_id as string | null;

    // Cria/atualiza subscription com status pending → ativo quando o MP enviar webhook
    const start = new Date();
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    await admin.from("subscriptions").upsert({
      user_id: u.user.id,
      organization_id: orgId,
      plan_id: plan.id,
      status: "pending",
      mp_preapproval_id: mpJson.id,
      mp_payer_email: email,
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      metadata: { preapproval_init_point: mpJson.init_point },
    }, { onConflict: "user_id,plan_id" });

    return new Response(JSON.stringify({
      preapproval_id: mpJson.id,
      init_point: mpJson.init_point,
      status: mpJson.status,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
