// Recebe { user_id, lead_id, message } e usa Lovable AI para classificar
// a intenção da mensagem e mover o card para o estágio correto.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  "Novo Contato": "primeiro contato, saudação, pergunta genérica",
  "Qualificando": "demonstra interesse, pergunta preço, valores, condições, modelo",
  "Proposta Enviada": "pediu/recebeu proposta, orçamento, cotação formal",
  "Negociando": "discute desconto, parcelamento, contraproposta, objeção sobre preço",
  "Aguardando Pagamento": "informou que pagou, enviou comprovante, pix, transferência feita",
  "Concluído": "agradeceu, confirmou recebimento, finalizou compra com sucesso",
  "Não qualificado": "desistiu, não tem interesse, número errado, spam",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { user_id, lead_id, message } = await req.json();
    if (!user_id || !lead_id || !message) return j({ error: "missing fields" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carrega estágios disponíveis para esse usuário
    const { data: stages } = await supabase
      .from("funnel_stages")
      .select("id, name, order_index")
      .eq("user_id", user_id)
      .order("order_index");
    if (!stages || stages.length === 0) return j({ ok: true, no_stages: true });

    // Carrega últimas mensagens do lead para contexto
    const { data: history } = await supabase
      .from("messages")
      .select("content, direction, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(8);

    const transcript = (history ?? [])
      .reverse()
      .map((m) => `${m.direction === "inbound" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    const stageList = stages
      .map((s) => `- ${s.name}: ${STAGE_DESCRIPTIONS[s.name] ?? ""}`)
      .join("\n");

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
              "Você classifica leads de WhatsApp em estágios de funil de vendas. " +
              "Analise a conversa e escolha o estágio que MELHOR representa o estado atual do lead. " +
              "Responda APENAS chamando a função classify_lead.",
          },
          {
            role: "user",
            content:
              `Estágios disponíveis:\n${stageList}\n\n` +
              `Conversa recente:\n${transcript}\n\n` +
              `Última mensagem do cliente: "${message}"\n\n` +
              `Em qual estágio o lead deve estar agora?`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_lead",
              description: "Classifica o lead no estágio mais adequado",
              parameters: {
                type: "object",
                properties: {
                  stage_name: {
                    type: "string",
                    enum: stages.map((s) => s.name),
                  },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  reason: { type: "string" },
                },
                required: ["stage_name", "confidence", "reason"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_lead" } },
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
    const targetStage = stages.find((s) => s.name === args.stage_name);
    if (!targetStage) return j({ ok: true, unknown_stage: args.stage_name });

    // Só move se confiança >= 0.6
    if ((args.confidence ?? 0) < 0.6) {
      return j({ ok: true, low_confidence: args.confidence, reason: args.reason });
    }

    // Atualiza card no pipeline (só se estágio diferente)
    const { data: card } = await supabase
      .from("pipeline_leads")
      .select("id, stage_id")
      .eq("user_id", user_id)
      .eq("lead_id", lead_id)
      .maybeSingle();

    if (card && card.stage_id !== targetStage.id) {
      await supabase
        .from("pipeline_leads")
        .update({ stage_id: targetStage.id, updated_at: new Date().toISOString() })
        .eq("id", card.id);
    }

    return j({ ok: true, moved_to: args.stage_name, reason: args.reason, confidence: args.confidence });
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