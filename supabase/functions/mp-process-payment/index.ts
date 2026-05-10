// deno-lint-ignore-file
// Checkout Transparente: recebe token gerado pelo Payment Brick (frontend) e cria
// o pagamento direto via API do Mercado Pago, sem redirecionar o usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN missing");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json();
    const { plan_slug, formData } = body;
    if (!plan_slug || !formData) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: plan, error: planErr } = await admin
      .from("plans").select("*").eq("slug", plan_slug).eq("is_active", true).single();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "plan_not_found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Garante uma subscription pendente
    const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    const { data: sub, error: subErr } = await admin.from("subscriptions").insert({
      user_id: user.id,
      organization_id: profile?.organization_id ?? null,
      plan_id: plan.id,
      status: "pending",
      mp_payer_email: user.email,
    }).select().single();
    if (subErr) throw subErr;

    // Monta payload conforme retorno do Payment Brick (cartão | pix | boleto)
    const paymentBody: Record<string, unknown> = {
      transaction_amount: Number((plan.price_cents / 100).toFixed(2)),
      description: `Plano ${plan.name}`,
      payment_method_id: formData.payment_method_id,
      payer: {
        email: formData.payer?.email || user.email,
        identification: formData.payer?.identification,
        first_name: formData.payer?.first_name,
        last_name: formData.payer?.last_name,
      },
      external_reference: sub.id,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      metadata: { user_id: user.id, plan_slug: plan.slug, subscription_id: sub.id },
      statement_descriptor: "ConectaCRM",
    };
    if (formData.token) paymentBody.token = formData.token;
    if (formData.installments) paymentBody.installments = Number(formData.installments);
    if (formData.issuer_id) paymentBody.issuer_id = formData.issuer_id;

    const idempotency = req.headers.get("x-idempotency-key") || crypto.randomUUID();

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotency,
      },
      body: JSON.stringify(paymentBody),
    });
    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP /payments error", mpJson);
      return new Response(JSON.stringify({ error: "mp_error", details: mpJson }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Registra pagamento
    await admin.from("payments").upsert({
      mp_payment_id: String(mpJson.id),
      subscription_id: sub.id,
      plan_id: plan.id,
      user_id: user.id,
      provider: "mercadopago",
      status: mpJson.status,
      status_detail: mpJson.status_detail,
      amount_cents: Math.round(Number(mpJson.transaction_amount || 0) * 100),
      currency: mpJson.currency_id || "BRL",
      payment_method: mpJson.payment_method_id,
      payer_email: mpJson.payer?.email,
      raw: mpJson,
    }, { onConflict: "mp_payment_id" });

    if (mpJson.status === "approved") {
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      await admin.from("subscriptions").update({
        status: "active",
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
      }).eq("id", sub.id);
    }

    return new Response(JSON.stringify({
      payment_id: mpJson.id,
      status: mpJson.status,
      status_detail: mpJson.status_detail,
      subscription_id: sub.id,
      // Para PIX:
      qr_code: mpJson.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpJson.point_of_interaction?.transaction_data?.qr_code_base64,
      ticket_url: mpJson.point_of_interaction?.transaction_data?.ticket_url,
      // Para Boleto:
      boleto_url: mpJson.transaction_details?.external_resource_url,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("mp-process-payment error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
