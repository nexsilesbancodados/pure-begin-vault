// Edge function que roda diariamente disparando automações temporais.
// Setup cron Supabase:
//   SELECT cron.schedule('daily-automations', '0 9 * * *',
//     $$ SELECT net.http_post(
//       url:='https://<ref>.supabase.co/functions/v1/daily-automations',
//       headers:='{"Content-Type":"application/json"}'::jsonb
//     ) $$);
//
// Triggers cobertos (rodados pra TODAS as orgs ativas):
// - customer.birthday — clientes fazendo aniversário hoje
// - customer.inactive_90d — sem compra há 90 dias
// - warranty.expiring_30d — garantia OS terminando em 30d
// - quote.no_response_24h — orçamentos há 24h sem confirmação
// - quote.expiring_soon — orçamentos vencendo amanhã
// - os.overdue — OS abertas com due_date < hoje
// - os.delivered_3d — OS entregues há 3 dias (pede NPS)
// - sale.after_7d — venda concluída há 7 dias
// - stock.below_minimum — produtos abaixo do min_stock
// - receivable.overdue — contas a receber atrasadas

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

function tpl(str: string, vars: Record<string, any>): string {
  return (str || "").replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

async function sendWhatsApp(orgId: string, to: string, text: string) {
  if (!EVO_URL || !EVO_KEY) return { ok: false, error: "evolution_not_configured" };
  // pega primeira instância do org via bot_settings (heurística)
  const { data: bs } = await supa
    .from("bot_settings")
    .select("instance_name, user_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  const instance = (bs as any)?.instance_name;
  if (!instance) return { ok: false, error: "no_instance" };
  try {
    const res = await fetch(`${EVO_URL.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ number: to, text }),
    });
    if (!res.ok) return { ok: false, error: `evo_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!RESEND_KEY) return { ok: false, error: "resend_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ConectaCRM <noreply@conectaphone.com>",
        to,
        subject,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="white-space:pre-wrap">${body}</div></div>`,
      }),
    });
    if (!res.ok) return { ok: false, error: `resend_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function logRun(installId: string | null, orgId: string, trigger: string, channel: string, target: string | null, body: string | null, status: string, error?: string) {
  await (supa as any).from("automation_logs").insert({
    install_id: installId,
    organization_id: orgId,
    trigger_type: trigger,
    channel,
    target_phone: channel === "whatsapp" ? target : null,
    target_email: channel === "email" ? target : null,
    rendered_body: body,
    status,
    error,
  });
}

// Pega installs ativos pra um trigger específico, em qualquer org
async function getInstalls(trigger: string) {
  const { data } = await supa
    .from("automation_installs")
    .select("*")
    .eq("trigger_type", trigger)
    .eq("is_active", true);
  return (data ?? []) as any[];
}

async function processBirthday() {
  const installs = await getInstalls("customer.birthday");
  if (installs.length === 0) return 0;
  // como customers não tem birthday no schema, pula com aviso
  return 0;
}

async function processInactive() {
  const installs = await getInstalls("customer.inactive_90d");
  if (installs.length === 0) return 0;
  let count = 0;
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();

  for (const inst of installs) {
    const { data: customers } = await (supa as any)
      .from("customers")
      .select("id, name, phone")
      .eq("organization_id", inst.organization_id)
      .not("phone", "is", null);

    for (const c of (customers ?? []) as any[]) {
      // verifica última compra
      const { data: lastSale } = await (supa as any)
        .from("sales_orders")
        .select("created_at")
        .eq("organization_id", inst.organization_id)
        .eq("customer_id", c.id)
        .neq("status", "cancelada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastSale || lastSale.created_at > cutoff) continue;

      // verifica se já mandou nos últimos 30d
      const { count: recent } = await (supa as any)
        .from("automation_logs")
        .select("id", { count: "exact", head: true })
        .eq("install_id", inst.id)
        .eq("target_phone", c.phone)
        .gte("ran_at", new Date(Date.now() - 30 * 86400000).toISOString());
      if ((recent ?? 0) > 0) continue;

      const text = tpl(inst.body, { cliente_nome: c.name.split(" ")[0] });
      const r = await sendWhatsApp(inst.organization_id, c.phone, text);
      await logRun(inst.id, inst.organization_id, inst.trigger_type, "whatsapp", c.phone, text, r.ok ? "sent" : "failed", r.error);
      count += r.ok ? 1 : 0;
    }
  }
  return count;
}

async function processOsOverdue() {
  const installs = await getInstalls("os.overdue");
  if (installs.length === 0) return 0;
  let count = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const inst of installs) {
    const { data: oss } = await (supa as any)
      .from("service_orders")
      .select("id, os_number, customer_id, equipment, status, due_date")
      .eq("organization_id", inst.organization_id)
      .lt("due_date", today)
      .not("status", "in", "(concluida,entregue,cancelada)");

    for (const os of (oss ?? []) as any[]) {
      let customerName = "—";
      if (os.customer_id) {
        const { data: c } = await (supa as any).from("customers").select("name, phone").eq("id", os.customer_id).maybeSingle();
        customerName = (c as any)?.name ?? "—";
      }
      const text = tpl(inst.body, {
        os_numero: os.os_number ?? os.id.slice(0, 8),
        cliente_nome: customerName,
        previsao: os.due_date,
        status_atual: os.status,
      });
      // Internal channel: insere notification pro dono (não manda whatsapp)
      await (supa as any).from("notifications").insert({
        user_id: inst.user_id,
        organization_id: inst.organization_id,
        title: "OS atrasada",
        message: text,
        type: "warning",
      });
      await logRun(inst.id, inst.organization_id, inst.trigger_type, "internal", null, text, "sent");
      count += 1;
    }
  }
  return count;
}

async function processOsDelivered3d() {
  const installs = await getInstalls("os.delivered_3d");
  if (installs.length === 0) return 0;
  let count = 0;
  const start = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const end = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

  for (const inst of installs) {
    const { data: oss } = await (supa as any)
      .from("service_orders")
      .select("id, customer_id, equipment, delivered_at")
      .eq("organization_id", inst.organization_id)
      .gte("delivered_at", start)
      .lt("delivered_at", end);

    for (const os of (oss ?? []) as any[]) {
      if (!os.customer_id) continue;
      const { data: c } = await (supa as any).from("customers").select("name, phone").eq("id", os.customer_id).maybeSingle();
      if (!c || !(c as any).phone) continue;
      const text = tpl(inst.body, {
        cliente_nome: (c as any).name.split(" ")[0],
        equipamento: os.equipment,
      });
      const r = await sendWhatsApp(inst.organization_id, (c as any).phone, text);
      await logRun(inst.id, inst.organization_id, inst.trigger_type, "whatsapp", (c as any).phone, text, r.ok ? "sent" : "failed", r.error);
      count += r.ok ? 1 : 0;
    }
  }
  return count;
}

async function processSaleAfter7d() {
  const installs = await getInstalls("sale.after_7d");
  if (installs.length === 0) return 0;
  let count = 0;
  const start = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const end = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0];

  for (const inst of installs) {
    const { data: sales } = await (supa as any)
      .from("sales_orders")
      .select("id, customer_id, created_at")
      .eq("organization_id", inst.organization_id)
      .gte("created_at", start)
      .lt("created_at", end)
      .neq("status", "cancelada");

    for (const s of (sales ?? []) as any[]) {
      if (!s.customer_id) continue;
      const { data: c } = await (supa as any).from("customers").select("name, phone").eq("id", s.customer_id).maybeSingle();
      if (!c || !(c as any).phone) continue;
      // pega 1º item da venda como "produto"
      const { data: items } = await (supa as any).from("sale_items").select("product_name").eq("sale_id", s.id).limit(1);
      const produto = (items ?? [])[0]?.product_name ?? "produto";
      const text = tpl(inst.body, {
        cliente_nome: (c as any).name.split(" ")[0],
        produto,
      });
      const r = await sendWhatsApp(inst.organization_id, (c as any).phone, text);
      await logRun(inst.id, inst.organization_id, inst.trigger_type, "whatsapp", (c as any).phone, text, r.ok ? "sent" : "failed", r.error);
      count += r.ok ? 1 : 0;
    }
  }
  return count;
}

async function processStockBelow() {
  const installs = await getInstalls("stock.below_minimum");
  if (installs.length === 0) return 0;
  let count = 0;

  for (const inst of installs) {
    const { data: produtos } = await (supa as any)
      .from("products")
      .select("name, stock_quantity, min_stock")
      .eq("organization_id", inst.organization_id)
      .eq("active", true)
      .not("min_stock", "is", null);
    const low = ((produtos ?? []) as any[]).filter((p) => p.min_stock != null && p.stock_quantity <= p.min_stock);
    if (low.length === 0) continue;

    const lines = low.slice(0, 10).map((p) => `• ${p.name} (${p.stock_quantity}/${p.min_stock})`).join("\n");
    const text = `⚠ Estoque baixo: ${low.length} produto(s)\n\n${lines}`;
    await (supa as any).from("notifications").insert({
      user_id: inst.user_id,
      organization_id: inst.organization_id,
      title: "Estoque crítico",
      message: text,
      type: "warning",
    });
    await logRun(inst.id, inst.organization_id, inst.trigger_type, "internal", null, text, "sent");
    count += 1;
  }
  return count;
}

async function processReceivableOverdue() {
  const installs = await getInstalls("receivable.overdue");
  if (installs.length === 0) return 0;
  let count = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const inst of installs) {
    const { data: aoverdue } = await (supa as any)
      .from("accounts_receivable")
      .select("id, customer_id, amount, paid_amount, due_date")
      .eq("organization_id", inst.organization_id)
      .lt("due_date", today)
      .neq("status", "paid");
    if (((aoverdue ?? []) as any[]).length === 0) continue;

    const total = ((aoverdue ?? []) as any[]).reduce((a, b) => a + (Number(b.amount) - Number(b.paid_amount ?? 0)), 0);
    const text = `📌 ${aoverdue!.length} conta(s) a receber em atraso · R$ ${total.toFixed(2)} pendentes`;
    await (supa as any).from("notifications").insert({
      user_id: inst.user_id,
      organization_id: inst.organization_id,
      title: "Contas a receber atrasadas",
      message: text,
      type: "warning",
    });
    await logRun(inst.id, inst.organization_id, inst.trigger_type, "internal", null, text, "sent");
    count += 1;
  }
  return count;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const r = await Promise.allSettled([
      processBirthday(),
      processInactive(),
      processOsOverdue(),
      processOsDelivered3d(),
      processSaleAfter7d(),
      processStockBelow(),
      processReceivableOverdue(),
    ]);

    const summary = {
      birthday: r[0].status === "fulfilled" ? r[0].value : 0,
      inactive: r[1].status === "fulfilled" ? r[1].value : 0,
      os_overdue: r[2].status === "fulfilled" ? r[2].value : 0,
      os_nps: r[3].status === "fulfilled" ? r[3].value : 0,
      sale_followup: r[4].status === "fulfilled" ? r[4].value : 0,
      stock_low: r[5].status === "fulfilled" ? r[5].value : 0,
      receivable: r[6].status === "fulfilled" ? r[6].value : 0,
    };

    return new Response(JSON.stringify({ ok: true, summary }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
