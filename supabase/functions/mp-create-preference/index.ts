// deno-lint-ignore-file
// Cria uma Preference no Mercado Pago Checkout Pro para o plano selecionado.
// Auth: usuário precisa estar logado (JWT no header Authorization).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN missing");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const planSlug = body.plan_slug || body.planSlug;
    const successUrl = body.success_url || `${req.headers.get("origin") || ""}/planos?status=success`;
    const failureUrl = body.failure_url || `${req.headers.get("origin") || ""}/planos?status=failure`;
    const pendingUrl = body.pending_url || `${req.headers.get("origin") || ""}/planos?status=pending`;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("*")
      .eq("slug", planSlug)
      .eq("is_active", true)
      .single();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "plan_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cria a subscription pendente
    const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    const { data: sub, error: subErr } = await admin.from("subscriptions").insert({
      user_id: user.id,
      organization_id: profile?.organization_id ?? null,
      plan_id: plan.id,
      status: "pending",
      mp_payer_email: user.email,
    }).select().single();
    if (subErr) throw subErr;

    const preferencePayload = {
      items: [{
        id: plan.slug,
        title: `Plano ${plan.name}`,
        description: plan.description ?? plan.name,
        quantity: 1,
        currency_id: plan.currency || "BRL",
        unit_price: Number((plan.price_cents / 100).toFixed(2)),
      }],
      payer: { email: user.email },
      back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
      auto_return: "approved",
      external_reference: sub.id,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      metadata: { user_id: user.id, plan_slug: plan.slug, subscription_id: sub.id },
      statement_descriptor: "ConectaCRM",
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });
    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP preference error", mpJson);
      return new Response(JSON.stringify({ error: "mp_error", details: mpJson }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("subscriptions").update({
      metadata: { preference_id: mpJson.id },
    }).eq("id", sub.id);

    return new Response(JSON.stringify({
      preference_id: mpJson.id,
      init_point: mpJson.init_point,
      sandbox_init_point: mpJson.sandbox_init_point,
      subscription_id: sub.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("mp-create-preference error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
