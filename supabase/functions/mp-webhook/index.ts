// deno-lint-ignore-file
// Webhook MP. Atualiza payment, ativa subscription e — quando vier de um pending_signup —
// provisiona a conta + envia magic link por e-mail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WEBHOOK_SECRET = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") || "";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function verifyMpSignature(req: Request, dataId: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // sem secret configurado, pula validação
  const sigHeader = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  if (!sigHeader || !dataId) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map(p => {
    const [k, v] = p.split("=");
    return [k.trim(), (v || "").trim()];
  }));
  const ts = parts["ts"]; const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === v1;
}

async function fetchPayment(id: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MP fetch payment ${id}: ${r.status}`);
  return r.json();
}

async function provisionFromPending(admin: any, pending: any, plan: any, paymentId: string) {
  const email: string = pending.email;
  const name: string = pending.name;

  const { data: existing } = await admin.auth.admin.listUsers();
  let user = existing?.users?.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email, email_confirm: true,
      user_metadata: { full_name: name, phone: pending.phone },
    });
    if (error) throw error;
    user = created.user;
  }
  await admin.from("profiles").upsert({ id: user.id, email, nome: name }, { onConflict: "id" });

  const { data: prof } = await admin.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  let orgId = prof?.organization_id as string | null;
  if (!orgId) {
    const { data: org } = await admin.from("organizations")
      .insert({ name: name || email.split("@")[0], owner_id: user.id }).select("id").single();
    orgId = org.id;
    await admin.from("profiles").update({ organization_id: orgId }).eq("id", user.id);
    await admin.from("user_roles").insert({ user_id: user.id, organization_id: orgId, role: "admin" });
  }

  const start = new Date();
  const end = new Date(); end.setMonth(end.getMonth() + 1);
  const { data: sub } = await admin.from("subscriptions").insert({
    user_id: user.id, organization_id: orgId, plan_id: plan.id, status: "active",
    mp_payer_email: email,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
  }).select().single();

  await admin.from("payments").update({
    user_id: user.id, organization_id: orgId, subscription_id: sub?.id ?? null,
  }).eq("mp_payment_id", paymentId);

  await admin.from("pending_signups").update({
    status: "provisioned", user_id: user.id, organization_id: orgId,
  }).eq("id", pending.id);

  // Envia e-mail com magic link
  const redirectTo = (Deno.env.get("APP_URL") || "https://app.example.com") + "/painel";
  await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const queryId = url.searchParams.get("id") || url.searchParams.get("data.id");
    let body: any = {};
    try { body = await req.json(); } catch {}
    const type = body?.type || topic;
    const dataId = body?.data?.id || queryId;
    console.log("mp-webhook", { type, dataId });
    if (!dataId) return new Response("ok", { headers: cors });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (type === "payment" || topic === "payment") {
      const payment = await fetchPayment(String(dataId));
      const externalRef = payment.external_reference || null;
      const planSlug = payment.metadata?.plan_slug || null;
      const pendingSignupId = payment.metadata?.pending_signup_id || null;
      const userIdMeta = payment.metadata?.user_id || null;

      let plan: any = null;
      if (planSlug) {
        const { data: p } = await admin.from("plans").select("*").eq("slug", planSlug).maybeSingle();
        plan = p;
      }

      // Se vem de pending_signup, busca o registro
      let pending: any = null;
      if (pendingSignupId) {
        const { data } = await admin.from("pending_signups").select("*").eq("id", pendingSignupId).maybeSingle();
        pending = data;
      } else if (externalRef) {
        const { data } = await admin.from("pending_signups").select("*").eq("id", externalRef).maybeSingle();
        pending = data;
      }

      // Upsert do payment
      await admin.from("payments").upsert({
        mp_payment_id: String(payment.id),
        plan_id: plan?.id ?? null,
        user_id: userIdMeta,
        provider: "mercadopago",
        status: payment.status,
        status_detail: payment.status_detail,
        amount_cents: Math.round(Number(payment.transaction_amount || 0) * 100),
        currency: payment.currency_id || "BRL",
        payment_method: payment.payment_method_id,
        payer_email: payment.payer?.email,
        raw: payment,
      }, { onConflict: "mp_payment_id" });

      if (pending && plan && payment.status === "approved" && pending.status !== "provisioned") {
        try {
          await provisionFromPending(admin, pending, plan, String(payment.id));
        } catch (e) {
          console.error("provision error", e);
        }
      } else if (!pending && externalRef && payment.status === "approved") {
        // Caso de upgrade de usuário já existente: external_reference == subscription.id
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await admin.from("subscriptions").update({
          status: "active",
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
        }).eq("id", externalRef);
      } else if (pending && (payment.status === "rejected" || payment.status === "cancelled")) {
        await admin.from("pending_signups").update({ status: "failed" }).eq("id", pending.id);
      }
    }

    return new Response("ok", { headers: cors });
  } catch (e) {
    console.error("mp-webhook error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
