// pipeline-qualifier — classifica mensagem do lead com IA e move para o estágio
// adequado do funil (atualiza leads.stage_id).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { user_id, lead_id, message } = await req.json();
    if (!user_id || !lead_id) return j({ error: "missing user_id or lead_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Lead + organization
    const { data: lead } = await supabase
      .from("leads")
      .select("id, organization_id, stage_id, status, name")
      .eq("id", lead_id)
      .maybeSingle();
    if (!lead) return j({ error: "lead not found" }, 404);

    // 2) Estágios do funil dessa organização
    const { data: stages } = await supabase
      .from("funnel_stages")
      .select("id, name, order")
      .eq("organization_id", lead.organization_id)
      .order("order");
    if (!stages || stages.length === 0) return j({ ok: true, no_stages: true });

    // 3) Histórico recente
    const { data: history } = await supabase
      .from("messages")
      .select("content, direction, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const transcript = (history ?? [])
      .reverse()
      .map((m: any) => `${m.direction === "inbound" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    const stageList = stages.map((s: any) => `- ${s.name}`).join("\n");

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return j({ error: "no AI key" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você qualifica leads de um CRM analisando a conversa em português. " +
              "Escolha o estágio do funil que melhor representa o estado atual do lead. " +
              "Também classifique o status comercial (new, contacted, qualified, won, lost). " +
              "Responda APENAS chamando a função qualify_lead.",
          },
          {
            role: "user",
            content:
              `Estágios disponíveis:\n${stageList}\n\n` +
              `Conversa recente:\n${transcript || "(sem histórico)"}\n\n` +
              (message ? `Última mensagem do cliente: "${message}"\n\n` : "") +
              `Qualifique o lead "${lead.name}".`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "qualify_lead",
            description: "Classifica o lead",
            parameters: {
              type: "object",
              properties: {
                stage_name: { type: "string", enum: stages.map((s: any) => s.name) },
                status: { type: "string", enum: ["new", "contacted", "qualified", "won", "lost"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" },
                summary: { type: "string", description: "Resumo curto da intenção do lead" },
              },
              required: ["stage_name", "status", "confidence", "reason"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "qualify_lead" } },
      }),
    });

    if (!aiRes.ok) {
      console.error("AI err", aiRes.status, await aiRes.text());
      return j({ error: "ai failed" }, 500);
    }
    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return j({ ok: true, no_classification: true });

    const args = JSON.parse(toolCall.function.arguments);
    const target = stages.find((s: any) => s.name === args.stage_name);

    if ((args.confidence ?? 0) < 0.55) {
      return j({ ok: true, low_confidence: args.confidence, reason: args.reason });
    }

    const update: any = { updated_at: new Date().toISOString() };
    if (target && target.id !== lead.stage_id) update.stage_id = target.id;
    if (args.status && args.status !== lead.status) update.status = args.status;

    if (Object.keys(update).length > 1) {
      await supabase.from("leads").update(update).eq("id", lead_id);
    }

    // Notifica o dono se virou qualificado/ganho
    if (args.status === "qualified" || args.status === "won") {
      await supabase.from("notifications").insert({
        user_id,
        organization_id: lead.organization_id,
        type: "lead_qualified",
        title: `IA qualificou: ${lead.name}`,
        body: args.summary ?? args.reason,
        link: `/leads`,
      });
    }

    return j({ ok: true, moved_to: args.stage_name, status: args.status, reason: args.reason, confidence: args.confidence });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
