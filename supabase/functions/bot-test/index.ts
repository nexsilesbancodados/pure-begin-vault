// Permite testar o bot a partir do painel sem WhatsApp
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return j({ error: "unauthorized" }, 401);

    const { messages } = await req.json();
    const { data: settings } = await supabase
      .from("bot_settings")
      .select("system_prompt, ai_model, ai_temperature, fallback_message")
      .eq("user_id", user.id)
      .maybeSingle();

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return j({ reply: settings?.fallback_message ?? "Bot indisponível." });

    const sys = settings?.system_prompt ?? "Você é um atendente cordial.";
    const model = settings?.ai_model && (settings.ai_model.startsWith("google/") || settings.ai_model.startsWith("openai/"))
      ? settings.ai_model : "google/gemini-3-flash-preview";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: Number(settings?.ai_temperature ?? 0.7),
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });

    if (aiRes.status === 429) return j({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (aiRes.status === 402) return j({ error: "Créditos da Lovable AI esgotados." }, 402);
    if (!aiRes.ok) return j({ error: `Erro IA: ${aiRes.status}` }, 500);

    const out = await aiRes.json();
    return j({ reply: out?.choices?.[0]?.message?.content ?? settings?.fallback_message });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}