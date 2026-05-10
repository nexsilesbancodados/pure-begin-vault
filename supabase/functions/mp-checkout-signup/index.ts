// deno-lint-ignore-file
// Cobra ANTES de criar a conta. Se aprovado, provisiona usuário + organização + subscription
// e devolve magic link para login. Se pendente (PIX/boleto), webhook fará o provisionamento.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function bad(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function provisionAccount(admin: ReturnType<typeof createClient>, opts: {
  email: string; name: string; phone?: string; plan: any; pendingId: string; paymentId: string; redirectTo: string;
}) {
  const { email, name, phone, plan, pendingId, paymentId, redirectTo } = opts;

  // Já existe? — usa o existente (idempotência)
  const { data: existing } = await admin.auth.admin.listUsers();
  let user = existing?.users?.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;

  if (!user) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true, // já confirmado pq pagou
      user_metadata: { full_name: name, phone },
    });
    if (createErr) throw createErr;
    user = created.user;
  }
  if (!user) throw new Error("could_not_create_user");

  // Garante profile (handle_new_user já cria, mas reforçamos)
  await admin.from("profiles").upsert({ id: user.id, email, nome: name }, { onConflict: "id" });

  // Cria organização se ainda não tem
  const { data: prof } = await admin.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  let orgId = prof?.organization_id as string | null | undefined;
  if (!orgId) {
    const { data: org, error: orgErr } = await admin.from("organizations")
      .insert({ name: name || email.split("@")[0], owner_id: user.id })
      .select("id").single();
    if (orgErr) throw orgErr;
    orgId = org.id;
    await admin.from("profiles").update({ organization_id: orgId }).eq("id", user.id);
    await admin.from("user_roles").insert({ user_id: user.id, organization_id: orgId, role: "admin" }).select();
  }

  // Subscription ativa
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  const { data: sub } = await admin.from("subscriptions").insert({
    user_id: user.id,
    organization_id: orgId,
    plan_id: plan.id,
    status: "active",
    mp_payer_email: email,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
  }).select().single();

  // Vincula payment
  await admin.from("payments").update({
    user_id: user.id,
    organization_id: orgId,
    subscription_id: sub?.id ?? null,
  }).eq("mp_payment_id", paymentId);

  // Marca pending como provisionado
  await admin.from("pending_signups").update({
    status: "provisioned",
    user_id: user.id,
    organization_id: orgId,
  }).eq("id", pendingId);

  // Magic link para login imediato
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  return { user_id: user.id, organization_id: orgId, action_link: link?.properties?.action_link ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN missing");
    const body = await req.json();
    const { plan_slug, name, email, phone, formData, redirect_to } = body;
    if (!plan_slug || !email || !name || !formData) return bad(400, { error: "missing_fields" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: plan, error: planErr } = await admin
      .from("plans").select("*").eq("slug", plan_slug).eq("is_active", true).single();
    if (planErr || !plan) return bad(404, { error: "plan_not_found" });

    // Cria pending_signup
    const { data: pending, error: pendErr } = await admin.from("pending_signups").insert({
      email, name, phone, plan_id: plan.id, status: "pending",
    }).select().single();
    if (pendErr) throw pendErr;

    // Cobra no MP
    const idempotency = req.headers.get("x-idempotency-key") || crypto.randomUUID();
    const paymentBody: Record<string, unknown> = {
      transaction_amount: Number((plan.price_cents / 100).toFixed(2)),
      description: `Plano ${plan.name} — ${email}`,
      payment_method_id: formData.payment_method_id,
      payer: {
        email: formData.payer?.email || email,
        identification: formData.payer?.identification,
        first_name: formData.payer?.first_name || name.split(" ")[0],
        last_name: formData.payer?.last_name || name.split(" ").slice(1).join(" "),
      },
      external_reference: pending.id,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      metadata: { pending_signup_id: pending.id, plan_slug: plan.slug, email },
      statement_descriptor: "ConectaCRM",
    };
    if (formData.token) paymentBody.token = formData.token;
    if (formData.installments) paymentBody.installments = Number(formData.installments);
    if (formData.issuer_id) paymentBody.issuer_id = formData.issuer_id;

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
      console.error("MP error", mpJson);
      await admin.from("pending_signups").update({ status: "failed", notes: JSON.stringify(mpJson) }).eq("id", pending.id);
      return bad(502, { error: "mp_error", details: mpJson });
    }

    // Registra payment (sem user_id ainda)
    await admin.from("payments").upsert({
      mp_payment_id: String(mpJson.id),
      provider: "mercadopago",
      status: mpJson.status,
      status_detail: mpJson.status_detail,
      amount_cents: Math.round(Number(mpJson.transaction_amount || 0) * 100),
      currency: mpJson.currency_id || "BRL",
      payment_method: mpJson.payment_method_id,
      payer_email: mpJson.payer?.email || email,
      plan_id: plan.id,
      raw: mpJson,
    }, { onConflict: "mp_payment_id" });

    await admin.from("pending_signups").update({ mp_payment_id: String(mpJson.id) }).eq("id", pending.id);

    let provision: any = null;
    if (mpJson.status === "approved") {
      try {
        provision = await provisionAccount(admin, {
          email, name, phone,
          plan,
          pendingId: pending.id,
          paymentId: String(mpJson.id),
          redirectTo: redirect_to || "https://app.example.com/painel",
        });
        await admin.from("pending_signups").update({ status: "paid" }).eq("id", pending.id);
      } catch (e) {
        console.error("provision error", e);
      }
    }

    return new Response(JSON.stringify({
      pending_id: pending.id,
      payment_id: mpJson.id,
      status: mpJson.status,
      status_detail: mpJson.status_detail,
      qr_code: mpJson.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpJson.point_of_interaction?.transaction_data?.qr_code_base64,
      ticket_url: mpJson.point_of_interaction?.transaction_data?.ticket_url,
      boleto_url: mpJson.transaction_details?.external_resource_url,
      account: provision, // { user_id, organization_id, action_link } se aprovado
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("mp-checkout-signup", e);
    return bad(500, { error: String((e as Error)?.message || e) });
  }
});
