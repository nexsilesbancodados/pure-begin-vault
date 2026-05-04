import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/servicos/dashboard")({
  component: () => (
    <PagePlaceholder 
      title="Dashboard OS" 
      subtitle="Painel da Assistência"
      description="Métricas de produtividade da bancada, tempo médio de reparo e faturamento dos serviços."
    />
  ),
});
