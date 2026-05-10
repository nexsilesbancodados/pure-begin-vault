// deno-lint-ignore-file
// Webhook do Mercado Pago. Recebe notificações IPN/Webhook e atualiza payments + subscriptions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function fetchPayment(id: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MP fetch payment ${id} failed: ${r.status}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const queryId = url.searchParams.get("id") || url.searchParams.get("data.id");

    let body: any = {};
    try { body = await req.json(); } catch { /* MP às vezes envia GET vazio */ }

    const type = body?.type || topic;
    const dataId = body?.data?.id || queryId;

    console.log("mp-webhook in", { type, dataId, query: Object.fromEntries(url.searchParams) });

    if (!dataId) return new Response("ok", { headers: cors });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (type === "payment" || topic === "payment") {
      const payment = await fetchPayment(String(dataId));
      const subscriptionId = payment.external_reference || null;
      const userId = payment.metadata?.user_id || null;
      const planSlug = payment.metadata?.plan_slug || null;

      let planId: string | null = null;
      if (planSlug) {
        const { data: p } = await admin.from("plans").select("id").eq("slug", planSlug).maybeSingle();
        planId = p?.id ?? null;
      }

      await admin.from("payments").upsert({
        mp_payment_id: String(payment.id),
        subscription_id: subscriptionId,
        plan_id: planId,
        user_id: userId,
        provider: "mercadopago",
        status: payment.status,
        status_detail: payment.status_detail,
        amount_cents: Math.round(Number(payment.transaction_amount || 0) * 100),
        currency: payment.currency_id || "BRL",
        payment_method: payment.payment_method_id,
        payer_email: payment.payer?.email,
        mp_preference_id: payment.order?.id ? String(payment.order.id) : null,
        raw: payment,
      }, { onConflict: "mp_payment_id" });

      if (subscriptionId && payment.status === "approved") {
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await admin.from("subscriptions").update({
          status: "active",
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
        }).eq("id", subscriptionId);
      } else if (subscriptionId && (payment.status === "rejected" || payment.status === "cancelled")) {
        await admin.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", subscriptionId);
      }
    }

    return new Response("ok", { headers: cors });
  } catch (e) {
    console.error("mp-webhook error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
