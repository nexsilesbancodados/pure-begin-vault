// Motor de automações do pipeline.
// Recebe { user_id, trigger_type, payload } e executa toda automação ativa
// correspondente, registrando em automation_runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  user_id: string;
  trigger_type: string;
  payload: Record<string, any>;
};

function interpolate(tpl: string, vars: Record<string, any>) {
  return (tpl || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = k.split(".").reduce((acc: any, p: string) => acc?.[p], vars);
    return v == null ? "" : String(v);
  });
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords?.length) return true;
  const t = (text || "").toLowerCase();
  return keywords.some((k) => t.includes(String(k).toLowerCase()));
}

function isOutsideBusinessHours(start = "08:00", end = "18:00"): boolean {
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return cur < s || cur >= e;
}

async function resolveStageId(
  admin: any,
  user_id: string,
  cfg: Record<string, any>,
): Promise<string | null> {
  if (cfg.stage_id) return cfg.stage_id;
  const name = cfg.target_stage_name || cfg.stage_name;
  if (!name) return null;
  const { data } = await admin
    .from("funnel_stages")
    .select("id")
    .eq("user_id", user_id)
    .ilike("name", name)
    .maybeSingle();
  return data?.id ?? null;
}

async function sendWhatsApp(user_id: string, phone: string, text: string, contactName?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "x-user-id": user_id,
    },
    body: JSON.stringify({ phone, text, contactName }),
  });
  if (!res.ok) throw new Error(`send-whatsapp ${res.status}`);
}

async function sendEmail(user_id: string, to: string, subject: string, html: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) throw new Error(`send-email ${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders });
  }

  const { user_id, trigger_type, payload = {} } = body || ({} as Payload);
  if (!user_id || !trigger_type) {
    return new Response(JSON.stringify({ error: "missing user_id or trigger_type" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Busca automações ativas para este gatilho
  const { data: automations, error: autErr } = await admin
    .from("automations")
    .select("*")
    .eq("user_id", user_id)
    .eq("trigger_type", trigger_type)
    .eq("is_active", true);

  if (autErr) {
    return new Response(JSON.stringify({ error: autErr.message }), { status: 500, headers: corsHeaders });
  }

  if (!automations?.length) {
    return new Response(JSON.stringify({ ok: true, executed: 0 }), { headers: corsHeaders });
  }

  // Carrega lead se houver
  let lead: any = null;
  if (payload.lead_id) {
    const { data } = await admin.from("leads").select("*").eq("id", payload.lead_id).maybeSingle();
    lead = data;
  }

  let executed = 0;
  for (const a of automations) {
    const cfg = (a.config ?? {}) as Record<string, any>;
    const cond = (cfg.condition ?? {}) as Record<string, any>;
    const vars = { ...payload, lead, nome: lead?.name, telefone: lead?.phone, mensagem: payload.content };

    try {
      // ---- Avaliação de condições (skip se não bater) ----
      if (cond.first_message_only && trigger_type === "message_received" && lead?.id) {
        const { count } = await admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user_id)
          .eq("lead_id", lead.id)
          .eq("direction", "inbound");
        if ((count ?? 0) > 1) {
          await admin.from("automation_runs").insert({
            user_id, automation_id: a.id, trigger_type, action_type: a.action_type,
            status: "skipped", payload, error: "not first message",
          });
          continue;
        }
      }

      if (cond.outside_business_hours && !isOutsideBusinessHours(cond.start, cond.end)) {
        await admin.from("automation_runs").insert({
          user_id, automation_id: a.id, trigger_type, action_type: a.action_type,
          status: "skipped", payload, error: "within business hours",
        });
        continue;
      }

      if (Array.isArray(cond.keywords) && cond.keywords.length > 0) {
        if (!matchesKeywords(payload.content ?? "", cond.keywords)) {
          await admin.from("automation_runs").insert({
            user_id, automation_id: a.id, trigger_type, action_type: a.action_type,
            status: "skipped", payload, error: "no keyword match",
          });
          continue;
        }
      }

      if (cond.target_stage_name && trigger_type === "stage_changed" && payload.to_stage_id) {
        const { data: st } = await admin
          .from("funnel_stages").select("name").eq("id", payload.to_stage_id).maybeSingle();
        if (!st || String(st.name).toLowerCase() !== String(cond.target_stage_name).toLowerCase()) {
          await admin.from("automation_runs").insert({
            user_id, automation_id: a.id, trigger_type, action_type: a.action_type,
            status: "skipped", payload, error: "stage mismatch",
          });
          continue;
        }
      }

      // ---- Execução da ação principal ----
      switch (a.action_type) {
        case "send_message": {
          const phone = lead?.phone || payload.phone;
          if (!phone) throw new Error("lead sem telefone");
          const text = interpolate(cfg.message ?? "", vars);
          if (!text.trim()) throw new Error("mensagem vazia");
          await sendWhatsApp(user_id, phone, text, lead?.name);
          break;
        }

        case "create_task": {
          await admin.from("tasks").insert({
            user_id,
            lead_id: lead?.id ?? payload.lead_id ?? null,
            title: interpolate(cfg.task_title ?? cfg.title ?? a.name ?? "Tarefa automática", vars),
            description: interpolate(cfg.task_description ?? cfg.description ?? "", vars),
            priority: cfg.task_priority ?? cfg.priority ?? "medium",
            status: "pending",
            due_date: cfg.due_in_hours
              ? new Date(Date.now() + Number(cfg.due_in_hours) * 3600_000).toISOString()
              : null,
          });
          break;
        }

        case "move_pipeline": {
          if (!lead?.id) throw new Error("lead ausente");
          const stageId = await resolveStageId(admin, user_id, cfg);
          if (!stageId) throw new Error("stage_id/stage_name não configurado");
          await admin.from("pipeline_leads").update({ stage_id: stageId }).eq("user_id", user_id).eq("lead_id", lead.id);
          break;
        }

        case "send_email": {
          const email = lead?.email || payload.email;
          if (!email) throw new Error("lead sem e-mail");
          const subject = interpolate(cfg.subject ?? "Notificação ConectaCRM", vars);
          const html = interpolate(cfg.email_body ?? cfg.message ?? "", vars);
          if (!html.trim()) throw new Error("corpo do e-mail vazio");
          await sendEmail(user_id, email, subject, html);
          break;
        }

        case "notify_team": {
          // Cria uma tarefa de notificação visível no painel
          await admin.from("tasks").insert({
            user_id,
            lead_id: lead?.id ?? payload.lead_id ?? null,
            title: interpolate(cfg.task_title ?? cfg.title ?? `🔔 ${a.name}`, vars),
            description: interpolate(cfg.message ?? "Notificação automática do pipeline", vars),
            priority: "high",
            status: "pending",
          });
          break;
        }

        default:
          throw new Error(`ação desconhecida: ${a.action_type}`);
      }

      // ---- Ações secundárias (also_*) ----
      if (cfg.also_send_message && cfg.message) {
        const phone = lead?.phone || payload.phone;
        if (phone) {
          const text = interpolate(cfg.message, vars);
          if (text.trim()) await sendWhatsApp(user_id, phone, text, lead?.name);
        }
      }
      if (cfg.also_create_task && cfg.task_title) {
        await admin.from("tasks").insert({
          user_id,
          lead_id: lead?.id ?? payload.lead_id ?? null,
          title: interpolate(cfg.task_title, vars),
          description: interpolate(cfg.task_description ?? "", vars),
          priority: cfg.task_priority ?? "medium",
          status: "pending",
        });
      }

      await admin.from("automation_runs").insert({
        user_id,
        automation_id: a.id,
        trigger_type,
        action_type: a.action_type,
        status: "success",
        payload,
      });
      executed++;
    } catch (e) {
      await admin.from("automation_runs").insert({
        user_id,
        automation_id: a.id,
        trigger_type,
        action_type: a.action_type,
        status: "error",
        payload,
        error: (e as Error).message,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, executed }), { headers: corsHeaders });
});