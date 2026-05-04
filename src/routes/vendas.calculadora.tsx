import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/vendas/calculadora")({
  component: () => (
    <PagePlaceholder 
      title="Calculadora de Aparelhos" 
      subtitle="Avaliação de Usados"
      description="Ferramenta para calcular o valor de compra de aparelhos usados com base no estado, bateria, tela e mercado atual."
    />
  ),
});
