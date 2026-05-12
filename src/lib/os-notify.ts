import { supabase } from "@/integrations/supabase/client";

const STATUS_MESSAGES: Record<string, string> = {
  recebida: "Olá! Recebemos seu aparelho. Em breve faremos o diagnóstico.",
  em_diagnostico: "Estamos analisando seu aparelho. Logo te passaremos o diagnóstico.",
  aguardando_pecas: "Diagnóstico feito. Estamos aguardando a chegada das peças.",
  em_reparo: "Boas notícias: começamos o reparo do seu aparelho.",
  concluida: "Seu aparelho está pronto para retirada! Te aguardamos na loja.",
  entregue: "Aparelho entregue. Garantia ativa. Obrigado pela preferência!",
  cancelada: "Sua OS foi cancelada. Em caso de dúvida, entre em contato.",
};

interface NotifyParams {
  os_id: string;
  newStatus: string;
  trackUrl?: string;
}

/**
 * Envia mensagem WhatsApp quando o status da OS muda.
 * Lê customer_id, busca telefone, e dispara via Edge Function send-whatsapp.
 * Silencioso em caso de falta de telefone/erro — não bloqueia o save.
 */
export async function notifyOsStatusChange({ os_id, newStatus, trackUrl }: NotifyParams) {
  try {
    const message = STATUS_MESSAGES[newStatus];
    if (!message) return;

    const { data: os } = await supabase
      .from("service_orders")
      .select("os_number, customer_id, equipment, organization_id")
      .eq("id", os_id)
      .maybeSingle();
    if (!os) return;

    if (!(os as any).customer_id) return;

    const { data: customer } = await supabase
      .from("customers" as any)
      .select("phone, name")
      .eq("id", (os as any).customer_id)
      .maybeSingle();
    if (!customer || !(customer as any).phone) return;

    const osLabel = (os as any).os_number ? `OS #${(os as any).os_number}` : "sua OS";
    const equipment = (os as any).equipment ?? "aparelho";
    const greeting = (customer as any).name
      ? `Oi ${(customer as any).name.split(" ")[0]}!`
      : "Olá!";

    const trackLine = trackUrl
      ? `\n\nAcompanhe em tempo real: ${trackUrl}`
      : "";

    const text = `${greeting} ${message}\n\n${osLabel} · ${equipment}${trackLine}`;

    await supabase.functions.invoke("send-whatsapp", {
      body: {
        to: String((customer as any).phone),
        text,
        os_id,
      },
    });
  } catch (e) {
    console.warn("[os-notify] falhou (não bloqueia):", e);
  }
}
