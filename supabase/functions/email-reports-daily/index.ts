// Resumo diário por email: enviado às 8h (cron pg_cron) pra owners de cada organização.
// Coleta vendas/OS/leads/financeiro do dia anterior e formata como HTML.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRL = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

async function buildOrgReport(supa: any, orgId: string, orgName: string) {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const start = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
  const end = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

  const [{ data: sales }, { data: os }, { data: leads }, { data: txs }] = await Promise.all([
    supa.from("sales_orders").select("total_cents, status").eq("organization_id", orgId).gte("created_at", start).lte("created_at", end),
    supa.from("service_orders").select("id, status").eq("organization_id", orgId).gte("created_at", start).lte("created_at", end),
    supa.from("leads").select("id").eq("organization_id", orgId).gte("created_at", start).lte("created_at", end),
    supa.from("finance_transactions").select("amount_cents, type").eq("organization_id", orgId).gte("created_at", start).lte("created_at", end),
  ]);

  const salesTotal = (sales ?? []).reduce((a: number, s: any) => a + (s.total_cents ?? 0), 0);
  const salesCount = (sales ?? []).length;
  const osCount = (os ?? []).length;
  const leadsCount = (leads ?? []).length;
  const receitas = (txs ?? []).filter((t: any) => t.type === "receita").reduce((a: number, t: any) => a + (t.amount_cents ?? 0), 0);
  const despesas = (txs ?? []).filter((t: any) => t.type === "despesa").reduce((a: number, t: any) => a + (t.amount_cents ?? 0), 0);

  if (salesCount === 0 && osCount === 0 && leadsCount === 0 && receitas === 0 && despesas === 0) {
    return null; // skip — nada pra reportar
  }

  return {
    orgName,
    date: yesterday.toLocaleDateString("pt-BR"),
    salesTotal,
    salesCount,
    osCount,
    leadsCount,
    receitas,
    despesas,
    saldo: receitas - despesas,
  };
}

function renderHtml(r: any) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f5f5f5;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
<div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:24px;text-align:center;">
  <h1 style="margin:0;font-size:22px;font-weight:900">ConectaCRM</h1>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Resumo de ${r.date}</p>
</div>
<div style="padding:24px;">
  <h2 style="margin:0 0 16px;font-size:18px">${r.orgName}</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:10px;background:#f8fafc;border-radius:8px">💰 Vendas</td><td style="padding:10px;text-align:right;font-weight:900">${BRL(r.salesTotal)} <span style="color:#64748b;font-weight:400">(${r.salesCount})</span></td></tr>
    <tr><td style="padding:10px">🔧 OS abertas</td><td style="padding:10px;text-align:right;font-weight:900">${r.osCount}</td></tr>
    <tr><td style="padding:10px;background:#f8fafc;border-radius:8px">👥 Novos leads</td><td style="padding:10px;text-align:right;font-weight:900">${r.leadsCount}</td></tr>
    <tr><td style="padding:10px">📈 Receitas</td><td style="padding:10px;text-align:right;color:#10b981;font-weight:900">${BRL(r.receitas)}</td></tr>
    <tr><td style="padding:10px;background:#f8fafc;border-radius:8px">📉 Despesas</td><td style="padding:10px;text-align:right;color:#ef4444;font-weight:900">${BRL(r.despesas)}</td></tr>
    <tr><td style="padding:10px;border-top:2px solid #e2e8f0;font-weight:900">SALDO</td><td style="padding:10px;text-align:right;border-top:2px solid #e2e8f0;font-weight:900;color:${r.saldo >= 0 ? "#10b981" : "#ef4444"}">${BRL(r.saldo)}</td></tr>
  </table>
  <p style="margin-top:24px;text-align:center"><a href="https://app.conectaphone.com/painel" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Ver no painel →</a></p>
</div>
<div style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#64748b">
  ConectaCRM · Resumo diário automático<br/>
  <a href="https://app.conectaphone.com/minha-conta" style="color:#64748b">desativar notificações</a>
</div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: orgs } = await supa
    .from("organizations")
    .select("id, name, owner_id");

  const results: any[] = [];

  for (const org of orgs ?? []) {
    const report = await buildOrgReport(supa, org.id, org.name ?? "Sua loja");
    if (!report) {
      results.push({ org: org.id, skipped: true });
      continue;
    }

    const { data: ownerUser } = await (supa.auth as any).admin.getUserById(org.owner_id);
    const email = ownerUser?.user?.email;
    if (!email) {
      results.push({ org: org.id, error: "no_owner_email" });
      continue;
    }

    if (!RESEND_API_KEY) {
      results.push({ org: org.id, skipped: true, reason: "no_resend_key" });
      continue;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "ConectaCRM <noreply@conectaphone.com>",
        to: [email],
        subject: `📊 Resumo de ${report.date} · ${org.name ?? "ConectaCRM"}`,
        html: renderHtml(report),
      }),
    });

    results.push({ org: org.id, status: res.status, email });
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
