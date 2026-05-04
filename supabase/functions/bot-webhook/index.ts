// Webhook público da Evolution API. Recebe mensagens, consulta config do bot
// do usuário dono da instância e responde via Lovable AI.
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
    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");
    const secret = url.searchParams.get("secret");
    if (!userId || !secret) return json({ error: "missing uid or secret" }, 400);

    const payload = await req.json().catch(() => ({}));
    const event = payload?.event ?? payload?.type;

    // Só reage a mensagens recebidas
    if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
      return json({ ok: true, ignored: event });
    }

    const data = payload?.data ?? payload;
    const fromMe = data?.key?.fromMe;
    const remoteJid: string = data?.key?.remoteJid ?? "";
    if (fromMe || !remoteJid) {
      return json({ ok: true, skipped: "fromMe or no remoteJid" });
    }

    const isGroup = remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast");
    const participant: string = data?.key?.participant ?? "";

    const messageText: string =
      data?.message?.conversation ??
      data?.message?.extendedTextMessage?.text ??
      "";
    if (!messageText.trim()) return json({ ok: true, empty: true });

    const phone = remoteJid.split("@")[0];
    // Pega o nome do contato ou o subject do grupo
    const contactNameRaw = data?.pushName ?? data?.subject ?? payload?.pushName ?? null;
    
    // Filtro defensivo agressivo para nomes "bugados" (IDs do WhatsApp)
    const isBuggyName = (name: string | null) => {
      if (!name) return true;
      if (name === phone) return true;
      // IDs longos alfanuméricos (ex: cmonbjx...)
      if (/^[a-zA-Z0-9]{15,}$/.test(name)) return true;
      // Apenas números
      if (/^\d+$/.test(name)) return true;
      // Termos técnicos comuns em IDs
      if (/cmonb/i.test(name)) return true;
      if (/@g\.us/i.test(name)) return true;
      return false;
    };

    const contactName = isBuggyName(contactNameRaw) ? null : contactNameRaw;
    const avatarUrl = data?.profilePicUrl ?? payload?.profilePicUrl ?? data?.profilePic ?? null;
    const labels = data?.labels ?? payload?.labels ?? [];
    const whatsappTags = Array.isArray(labels) ? labels : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings || settings.webhook_secret !== secret) {
      return json({ error: "invalid secret" }, 401);
    }

    // Carrega/cria conversa
    const { data: conv } = await supabase
      .from("bot_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_phone", phone)
      .maybeSingle();

    const transcript: any[] = Array.isArray(conv?.transcript) ? conv.transcript : [];
    transcript.push({ 
      role: "user", 
      content: messageText, 
      at: new Date().toISOString(), 
      sender: contactName 
    });

    const currentInstanceName = settings.whatsapp_instance || payload?.instance || null;

    // Para grupos ou participantes de grupo, apenas grava a mensagem para o atendimento manual
    if (isGroup || participant) {
      await persist(supabase, userId, phone, contactName, transcript, conv?.status ?? "active", remoteJid, currentInstanceName, avatarUrl, whatsappTags);
      return json({ ok: true, stored: true, type: "group" });
    }

    // Se o bot estiver inativo, apenas grava a mensagem para o atendimento manual
    if (!settings.is_active) {
      await persist(supabase, userId, phone, contactName, transcript, conv?.status ?? "active", remoteJid, currentInstanceName, avatarUrl, whatsappTags);
      return json({ ok: true, inactive: true, stored: true });
    }

    // Verifica horário comercial (se habilitado)
    const bh = settings.business_hours ?? {};
    if (bh.enabled) {
      // Hora atual no fuso de São Paulo
      const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const day = nowSP.getDay(); // 0=dom .. 6=sab
      const hhmm = nowSP.toTimeString().slice(0, 5); // "HH:MM"
      const days: number[] = bh.days ?? [1, 2, 3, 4, 5];
      const start: string = bh.start ?? "08:00";
      const end: string = bh.end ?? "18:00";
      const inDay = days.includes(day);
      const inHour = hhmm >= start && hhmm <= end;
      if (!inDay || !inHour) {
        // Fora do horário: envia away_message uma vez
        const awayText = settings.away_message || "No momento estamos fora do horário de atendimento.";
        transcript.push({ role: "assistant", content: awayText, at: new Date().toISOString() });
        await persist(supabase, userId, phone, contactName, transcript, conv?.status ?? "active", remoteJid, currentInstanceName, avatarUrl, whatsappTags);
        const instance = settings.whatsapp_instance;
        const evoUrl = Deno.env.get("EVOLUTION_API_URL");
        const evoKey = Deno.env.get("EVOLUTION_API_KEY");
        if (instance && evoUrl && evoKey) {
          await fetch(`${evoUrl}/message/sendText/${instance}`, {
            method: "POST",
            headers: { apikey: evoKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: phone, text: awayText }),
          });
        }
        return json({ ok: true, away: true });
      }
    }

    // Handoff por palavra-chave ou limite
    const lower = messageText.toLowerCase();
    const keywordHit = (settings.handoff_keywords ?? []).some((k: string) => lower.includes(k.toLowerCase()));
    const limitHit = transcript.length >= (settings.max_messages_before_handoff ?? 10);

    let replyText = "";
    let status = conv?.status ?? "active";

    if (status === "handed_off") {
      // Já foi para humano, não responde
      await persist(supabase, userId, phone, contactName, transcript, status, remoteJid, currentInstanceName, avatarUrl, whatsappTags);
      return json({ ok: true, handed: true });
    }

    if (keywordHit || limitHit) {
      replyText = settings.fallback_message;
      status = "handed_off";
    } else {
      // Chama Lovable AI
      const aiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!aiKey) {
        replyText = settings.fallback_message;
      } else {
        // Carrega catálogo (produtos + serviços ativos) para a IA poder oferecer
        const [{ data: products }, { data: services }] = await Promise.all([
          supabase
            .from("products")
            .select("name, description, category, price, stock_quantity, image_url, brand, model")
            .eq("user_id", userId)
            .limit(200),
          supabase
            .from("services")
            .select("name, description, category, price, duration_minutes, image_url, keywords")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(200),
        ]);

        const fmtPrice = (v: number | null | undefined) =>
          v == null ? "sob consulta" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        const productLines = (products ?? []).map((p: any) => {
          const parts = [
            `• ${p.name}`,
            p.category ? `[${p.category}]` : "",
            `— ${fmtPrice(p.price)}`,
            p.stock_quantity != null ? `(estoque: ${p.stock_quantity})` : "",
            p.description ? `\n   ${String(p.description).slice(0, 160)}` : "",
            p.image_url ? `\n   📷 ${p.image_url}` : "",
          ].filter(Boolean);
          return parts.join(" ");
        }).join("\n");

        const serviceLines = (services ?? []).map((s: any) => {
          const parts = [
            `• ${s.name}`,
            s.category ? `[${s.category}]` : "",
            `— ${fmtPrice(s.price)}`,
            s.duration_minutes ? `(${s.duration_minutes} min)` : "",
            s.description ? `\n   ${String(s.description).slice(0, 160)}` : "",
            s.keywords?.length ? `\n   palavras-chave: ${s.keywords.join(", ")}` : "",
            s.image_url ? `\n   📷 ${s.image_url}` : "",
          ].filter(Boolean);
          return parts.join(" ");
        }).join("\n");

        const catalogBlock = (productLines || serviceLines)
          ? `\n\n=== CATÁLOGO DISPONÍVEL ===\nUse APENAS itens deste catálogo ao oferecer produtos/serviços. Quando o cliente pedir algo (ex: "iPhone"), liste TODOS os itens compatíveis com nome, preço e (se houver) link da foto. Se não houver item compatível, diga honestamente que não tem disponível.\n\n${productLines ? `PRODUTOS:\n${productLines}` : ""}${productLines && serviceLines ? "\n\n" : ""}${serviceLines ? `SERVIÇOS:\n${serviceLines}` : ""}\n=== FIM DO CATÁLOGO ===`
          : "";

        const messages = [
          { role: "system", content: (settings.system_prompt || "") + catalogBlock },
          ...transcript.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        ];
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: settings.ai_model?.startsWith("google/") || settings.ai_model?.startsWith("openai/")
              ? settings.ai_model
              : "google/gemini-3-flash-preview",
            messages,
            temperature: Number(settings.ai_temperature ?? 0.7),
          }),
        });
        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          replyText = aiJson?.choices?.[0]?.message?.content?.trim() || settings.fallback_message;
        } else {
          console.error("AI error", aiRes.status, await aiRes.text());
          replyText = settings.fallback_message;
        }
      }
    }

    transcript.push({ role: "assistant", content: replyText, at: new Date().toISOString() });
    await persist(supabase, userId, phone, contactName, transcript, status, remoteJid, currentInstanceName, avatarUrl, whatsappTags);

    // Envia para Evolution
    const instance = settings.whatsapp_instance;
    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    if (instance && evoUrl && evoKey) {
      const delay = Math.max(0, Number(settings.auto_reply_delay_seconds ?? 0)) * 1000;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      const sendRes = await fetch(`${evoUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, text: replyText }),
      });
      if (!sendRes.ok) console.error("send error", sendRes.status, await sendRes.text());
    }

    return json({ ok: true, replied: true });
  } catch (e) {
    console.error("webhook error", e);
    return json({ error: String(e) }, 500);
  }
});

async function persist(
  supabase: any,
  userId: string,
  phone: string,
  name: string | null,
  transcript: any[],
  status: string,
  remoteJid?: string,
  instanceName?: string | null,
  avatarUrl?: string | null,
  whatsappTags?: string[]
) {
  await supabase.from("bot_conversations").upsert(
    {
      user_id: userId,
      contact_phone: phone,
      contact_name: name,
      remote_jid: remoteJid,
      transcript,
      status,
      messages_count: transcript.length,
      last_message_at: new Date().toISOString(),
      instance_name: instanceName,
    },
    { onConflict: "user_id,contact_phone" }
  );

  try {
    const { error: rpcError } = await supabase.rpc("ensure_lead_and_pipeline_from_conversation", {
      _user_id: userId,
      _phone: phone,
      _name: name,
      _instance_name: instanceName,
      _avatar_url: avatarUrl,
      _whatsapp_tags: whatsappTags || []
    });
    
    if (rpcError) console.error("RPC Error ensure_lead:", rpcError);
  } catch (err) {
    console.error("Failed to call rpc ensure_lead:", err);
  }

  const { data: leadAfterRpc } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (leadAfterRpc?.id) {
    const lastMsg = transcript[transcript.length - 1];
    if (lastMsg) {
      const direction = lastMsg.role === "user" ? "inbound" : "outbound";
      const externalId = `${userId}:${phone}:${lastMsg.at}:${lastMsg.role}`;
      const event = lastMsg.role === "assistant" ? "ai_reply" : "chat_message";
      
      await supabase
        .from("messages")
        .upsert(
          {
            user_id: userId,
            lead_id: leadAfterRpc.id,
            content: lastMsg.content,
            direction,
            status: "delivered",
            external_id: externalId,
            event: event,
            created_at: lastMsg.at ?? new Date().toISOString(),
          },
          { onConflict: "external_id", ignoreDuplicates: true }
        );

      if (direction === "outbound") {
        await supabase
          .from("leads")
          .update({ last_message_direction: 'outbound', updated_at: new Date().toISOString() })
          .eq("id", leadAfterRpc.id);
      }

      // Dispara qualificação automática em background se houver lead e for mensagem do usuário
      if (lastMsg.role === "user") {
        const qualifierUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pipeline-qualifier`;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        fetch(qualifierUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey!,
          },
          body: JSON.stringify({
            user_id: userId,
            lead_id: leadAfterRpc.id,
            message: lastMsg.content
          }),
        }).catch(e => console.error("Qualificação automática falhou:", e));
      }
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
