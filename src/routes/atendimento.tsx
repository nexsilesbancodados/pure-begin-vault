import { createFileRoute } from "@tanstack/react-router";
import { UnifiedChat } from "@/components/chat/UnifiedChat";

export const Route = createFileRoute("/atendimento")({
  head: () => ({
    meta: [
      { title: "Atendimento — ConectaCRM" },
      {
        name: "description",
        content:
          "Centralize WhatsApp e Instagram em um único chat unificado, com histórico do cliente, atribuição por agente e respostas rápidas.",
      },
      { property: "og:title", content: "Atendimento unificado — ConectaCRM" },
      {
        property: "og:description",
        content:
          "Chat único para WhatsApp e Instagram, com histórico do cliente e respostas rápidas.",
      },
    ],
  }),
  component: UnifiedChat,
});
