// Edge function chamada periodicamente (cron Supabase) para disparar mensagens agendadas
// que já passaram do horário scheduled_at e estão com status 'pending'.
//
// Setup do cron (Supabase Dashboard):
//   SELECT cron.schedule('dispatch-scheduled-messages', '* * * * *',
//     $$ SELECT net.http_post(
//       url:='https://<project-ref>.supabase.co/functions/v1/dispatch-scheduled-messages',
//       headers:='{"Authorization":"Bearer <service_role>","Content-Type":"application/json"}'::jsonb
//     ) $$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

interface ScheduledRow {
  id: string;
  organization_id: string;
  to_phone: string;
  body: string;
  instance_name: string | null;
}

async function pickInstance(supa: any, organization_id: string, override: string | null): Promise<string | null> {
  if (override) return override;
  // pega primeira instância ativa do org
  const { data } = await supa
    .from("bot_settings")
    .select("instance_name")
    .eq("organization_id", organization_id)
    .maybeSingle();
  return (data as any)?.instance_name ?? null;
}

async function sendEvo(instance: string, to: string, text: string) {
  if (!EVO_URL || !EVO_KEY) {
    throw new Error("EVOLUTION_API_URL/KEY não configurada");
  }
  const url = `${EVO_URL.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: EVO_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: to,
      text,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Evolution ${res.status}: ${t.slice(0, 200)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const nowIso = new Date().toISOString();

    const { data: due, error } = await supa
      .from("scheduled_messages")
      .select("id, organization_id, to_phone, body, instance_name")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
      .limit(50);
    if (error) throw error;

    const results: any[] = [];
    for (const row of (due ?? []) as ScheduledRow[]) {
      try {
        const instance = await pickInstance(supa, row.organization_id, row.instance_name);
        if (!instance) {
          await supa
            .from("scheduled_messages")
            .update({
              status: "failed",
              error: "sem instância WhatsApp configurada",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: "no instance" });
          continue;
        }
        await sendEvo(instance, row.to_phone, row.body);
        await supa
          .from("scheduled_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            instance_name: instance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        results.push({ id: row.id, ok: true });
      } catch (e) {
        await supa
          .from("scheduled_messages")
          .update({
            status: "failed",
            error: String((e as Error)?.message ?? e).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
