// Envia mensagem manual pelo WhatsApp via Evolution e grava no transcript
// da conversa do usuário autenticado.
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
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return json({ error: "unauthorized: missing token" }, 401);

    // Admin client (service role) — usado para validar o token e gravar
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      console.error("auth error", userErr);
      return json({ error: "unauthorized: invalid session" }, 401);
    }
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body.phone ?? ""); const phone = rawPhone.includes("@") ? rawPhone : rawPhone.replace(/\D/g, "");
    const text: string = String(body.text ?? "").trim();
    const kind: string = String(body.kind ?? "text"); // text | audio | sticker | image
    const media: string | null = body.media ? String(body.media) : null; // base64 (sem prefixo) OU URL
    const mimetype: string | null = body.mimetype ? String(body.mimetype) : null;
    const fileName: string | null = body.fileName ? String(body.fileName) : null;
    const contactName: string | null = body.contactName ?? null;
    const stopBot: boolean = !!body.stopBot;

    if (!phone) return json({ error: "phone required" }, 400);
    if (kind === "text" && !text) return json({ error: "text required" }, 400);
    if (kind !== "text" && !media) return json({ error: "media required" }, 400);

    const { data: settings } = await supabase
      .from("bot_settings")
      .select("whatsapp_instance")
      .eq("user_id", userId)
      .maybeSingle();

    const instance = settings?.whatsapp_instance;
    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");

    let sendOk = false;
    let sendError: string | null = null;
    if (instance && evoUrl && evoKey) {
      let endpoint = "";
      let payload: Record<string, unknown> = { number: phone };

      if (kind === "text") {
        endpoint = `${evoUrl}/message/sendText/${instance}`;
        payload.text = text;
      } else if (kind === "audio") {
        endpoint = `${evoUrl}/message/sendWhatsAppAudio/${instance}`;
        payload.audio = media; // base64 ou URL
        payload.encoding = true;
      } else if (kind === "sticker") {
        endpoint = `${evoUrl}/message/sendSticker/${instance}`;
        payload.sticker = media;
      } else if (kind === "image") {
        endpoint = `${evoUrl}/message/sendMedia/${instance}`;
        payload.mediatype = "image";
        payload.media = media;
        payload.mimetype = mimetype ?? "image/png";
        if (fileName) payload.fileName = fileName;
        if (text) payload.caption = text;
      } else {
        sendError = `kind inválido: ${kind}`;
      }

      if (endpoint) {
        const sendRes = await fetch(endpoint, {
          method: "POST",
          headers: { apikey: evoKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        sendOk = sendRes.ok;
        if (!sendRes.ok) sendError = `${sendRes.status}: ${await sendRes.text()}`;
      }
    } else {
      sendError = "Evolution não configurada (instância/URL/KEY)";
    }

    // Grava no transcript independentemente (assim aparece no app)
    const { data: conv } = await supabase
      .from("bot_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_phone", phone)
      .maybeSingle();

    const transcript: any[] = (conv?.transcript as any[]) ?? [];
    const placeholder =
      kind === "audio" ? "🎤 Áudio" : kind === "sticker" ? "🟦 Figurinha" : kind === "image" ? "🖼️ Imagem" : text;
    transcript.push({
      role: "agent",
      kind,
      content: text || placeholder,
      at: new Date().toISOString(),
      sent: sendOk,
    });

    await supabase.from("bot_conversations").upsert(
      {
        user_id: userId,
        contact_phone: phone,
        contact_name: conv?.contact_name ?? contactName,
        transcript,
        status: stopBot ? "handed_off" : conv?.status ?? "active",
        messages_count: transcript.length,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "user_id,contact_phone" }
    );

    return json({ ok: sendOk, error: sendError });
  } catch (e) {
    console.error("send-whatsapp error", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}