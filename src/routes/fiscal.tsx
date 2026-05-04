import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/fiscal")({
  component: () => (
    <PagePlaceholder 
      title="Módulo Fiscal" 
      subtitle="Emissão de NF-e e NFC-e"
      description="Gerencie notas fiscais de entrada e saída, alíquotas por estado e tributações específicas para o comércio de eletrônicos."
    />
  ),
});
