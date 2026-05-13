// deno-lint-ignore-file
// Webhook MP. Atualiza payment, ativa subscription e — quando vier de um pending_signup —
// provisiona a conta + envia magic link por e-mail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function fetchPreapproval(id: string) {
  const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MP fetch preapproval ${id}: ${r.status}`);
  return r.json();
}

async function sendBillingEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "ConectaCRM <billing@conectaphone.com>",
        to: [to], subject, html,
      }),
    });
  } catch (e) { console.warn("resend err", e); }
}

const tmplApproved = (plan: string, amount: number) => `
<div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;padding:24px;border-radius:16px;text-align:center;">
<h1 style="margin:0;font-size:22px;font-weight:900">✓ Pagamento confirmado</h1>
<p style="margin:6px 0 0;opacity:.9;font-size:13px">ConectaCRM · ${plan}</p>
</div>
<div style="padding:24px 0;">
<p>Olá! Seu pagamento de <strong>R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> foi aprovado.</p>
<p>Sua assinatura está ativa e renova automaticamente todo mês. Você pode acessar agora:</p>
<p style="text-align:center;margin:24px 0"><a href="https://conectaphone.com/painel" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Ir pro painel →</a></p>
</div>
<div style="border-top:1px solid #e2e8f0;padding-top:16px;text-align:center;color:#64748b;font-size:11px">
ConectaCRM · <a href="https://conectaphone.com/minha-conta" style="color:#64748b">gerenciar assinatura</a>
</div></div>`;

const tmplFailed = (plan: string, attempts: number) => `
<div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:20px;">
<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:24px;border-radius:16px;">
<h1 style="margin:0;font-size:20px;font-weight:900">⚠ Falha no pagamento</h1>
<p style="margin:8px 0 0;font-size:13px">Tentativa ${attempts} · ${plan}</p>
</div>
<div style="padding:20px 0;">
<p>Não conseguimos cobrar sua assinatura. Pode ser:</p>
<ul><li>Cartão sem saldo</li><li>Cartão expirado</li><li>Limite atingido</li></ul>
<p>Atualize o método de pagamento pra evitar suspensão:</p>
<p style="text-align:center;margin:20px 0"><a href="https://conectaphone.com/minha-conta" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Atualizar pagamento</a></p>
<p style="font-size:12px;color:#64748b">Vamos tentar mais 2 vezes nos próximos dias. Após isso, a assinatura fica suspensa.</p>
</div></div>`;

const tmplCanceled = (plan: string) => `
<div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:20px;">
<h2>Assinatura cancelada · ${plan}</h2>
<p>Sua assinatura foi cancelada. O acesso continua até o fim do período pago.</p>
<p>Se mudar de ideia: <a href="https://conectaphone.com/assinar">reativar agora</a></p>
</div>`;

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

    const ok = await verifyMpSignature(req, String(dataId));
    if (!ok) {
      console.warn("mp-webhook invalid signature");
      return new Response("invalid signature", { status: 401, headers: cors });
    }
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
          await sendBillingEmail(pending.email, "Pagamento confirmado", tmplApproved(plan.name, payment.transaction_amount));
        } catch (e) {
          console.error("provision error", e);
        }
      } else if (!pending && externalRef && payment.status === "approved") {
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await admin.from("subscriptions").update({
          status: "active",
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
          failed_attempts: 0,
        }).eq("id", externalRef);
      } else if (pending && (payment.status === "rejected" || payment.status === "cancelled")) {
        await admin.from("pending_signups").update({ status: "failed" }).eq("id", pending.id);
      }
    }

    // ===== Preapproval (assinatura recorrente) =====
    if (type === "subscription_preapproval" || type === "preapproval" || topic === "preapproval") {
      const pre = await fetchPreapproval(String(dataId));
      // external_reference format: "{user_id}:{plan_id}"
      const [userId, planId] = (pre.external_reference || "").split(":");

      // Busca subscription
      const { data: sub } = await admin.from("subscriptions")
        .select("*, plan:plans(name)")
        .eq("mp_preapproval_id", String(dataId)).maybeSingle();

      const newStatus = pre.status === "authorized" ? "active"
        : pre.status === "paused" ? "past_due"
        : pre.status === "cancelled" ? "canceled" : "pending";

      if (sub) {
        const update: any = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === "active") {
          const end = new Date(); end.setMonth(end.getMonth() + 1);
          update.current_period_end = end.toISOString();
          update.failed_attempts = 0;
        }
        if (newStatus === "canceled") update.canceled_at = new Date().toISOString();
        await admin.from("subscriptions").update(update).eq("id", sub.id);

        // Email pro evento
        if (pre.payer_email) {
          if (newStatus === "active" && sub.status !== "active") {
            await sendBillingEmail(pre.payer_email, "✓ Assinatura ativa", tmplApproved(sub.plan?.name || "Plano", (pre.auto_recurring?.transaction_amount || 0)));
          } else if (newStatus === "canceled") {
            await sendBillingEmail(pre.payer_email, "Assinatura cancelada", tmplCanceled(sub.plan?.name || "Plano"));
          }
        }
      }
    }

    // ===== authorized_payment (cobrança recorrente que rolou ou falhou) =====
    if (type === "authorized_payment") {
      const r = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
      });
      const auth = await r.json();
      const preapprovalId = auth.preapproval_id;
      const status = auth.status; // "processed" | "rejected" | "scheduled"

      const { data: sub } = await admin.from("subscriptions")
        .select("*, plan:plans(name)")
        .eq("mp_preapproval_id", String(preapprovalId)).maybeSingle();

      if (!sub) return new Response("ok", { headers: cors });

      if (status === "processed" || status === "approved") {
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await admin.from("subscriptions").update({
          status: "active", current_period_end: end.toISOString(), failed_attempts: 0, last_failed_at: null,
        }).eq("id", sub.id);
        if (auth.payer_email) {
          await sendBillingEmail(auth.payer_email, "✓ Cobrança recorrente confirmada",
            tmplApproved(sub.plan?.name || "Plano", auth.transaction_amount || 0));
        }
      } else if (status === "rejected") {
        const attempts = (sub.failed_attempts || 0) + 1;
        const next = new Date(); next.setDate(next.getDate() + 3);
        await admin.from("subscriptions").update({
          status: attempts >= 3 ? "suspended" : "past_due",
          failed_attempts: attempts,
          last_failed_at: new Date().toISOString(),
          next_retry_at: next.toISOString(),
        }).eq("id", sub.id);
        if (auth.payer_email) {
          await sendBillingEmail(auth.payer_email, "⚠ Falha no pagamento",
            tmplFailed(sub.plan?.name || "Plano", attempts));
        }
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
