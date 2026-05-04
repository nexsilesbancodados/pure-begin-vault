import { createFileRoute } from "@tanstack/react-router";
import { UnifiedChat } from "@/components/chat/UnifiedChat";

export const Route = createFileRoute("/atendimento")({
  head: () => ({ 
    meta: [
      { title: "Atendimento — ConectaCRM" }, 
      { name: "description", content: "Chat unificado para WhatsApp e Instagram" }
    ] 
  }),
  component: UnifiedChat,
});
