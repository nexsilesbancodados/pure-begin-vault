import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/servicos/tecnicos")({
  component: () => (
    <PagePlaceholder 
      title="Técnicos" 
      subtitle="Equipe da Assistência"
      description="Gerencie os técnicos, comissões por serviço e permissões de acesso à bancada."
    />
  ),
});
