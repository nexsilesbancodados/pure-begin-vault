import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/vendas/consulta-estoque")({
  component: () => (
    <PagePlaceholder 
      title="Consulta de Estoque" 
      subtitle="Disponibilidade em Tempo Real"
      description="Verifique rapidamente se um aparelho ou acessório está disponível. Busque por modelo, cor, GB ou IMEI."
    />
  ),
});
