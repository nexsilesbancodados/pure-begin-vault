// Helper para disparar o motor de automações (edge function).
// Fire-and-forget: nunca bloqueia o caller nem propaga erro de UI.
import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-runner`;

export type AutomationTrigger =
  | "new_lead"
  | "message_received"
  | "stage_changed"
  | "no_reply_24h";

export function fireAutomation(
  user_id: string,
  trigger_type: AutomationTrigger,
  payload: Record<string, any> = {},
) {
  if (!user_id) return;
  // não-bloqueante; logado no console em caso de erro
  void fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ user_id, trigger_type, payload }),
  }).catch((e) => console.warn("[automation-trigger]", trigger_type, e));
  // Também grava em messages quando aplicável (para o cron 24h funcionar)
  if (trigger_type === "message_received" && payload?.content) {
    void supabase.from("messages").insert({
      user_id,
      lead_id: payload.lead_id ?? null,
      phone: payload.phone ?? null,
      direction: "inbound",
      content: payload.content,
    });
  }
}
