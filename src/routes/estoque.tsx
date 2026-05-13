import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { FeatureCard, type FeatureCardTone } from "@/components/ui/FeatureCard";
import { StockList } from "@/components/estoque/StockList";
import { Box, Package, ClipboardList, FileText, ArrowLeftRight, Tag, Plus } from "lucide-react";

export const Route = createFileRoute("/estoque")({
  component: StockPage,
});

const modules: { title: string; desc: string; url: string; icon: any; tone: FeatureCardTone }[] = [
  {
    title: "Estoque Atual",
    desc: "Saldos por SKU e localização",
    url: "/estoque/atual",
    icon: Box,
    tone: "primary",
  },
  {
    title: "Catálogo de Produtos",
    desc: "Cadastro, preços e variações",
    url: "/produtos",
    icon: Package,
    tone: "violet",
  },
  {
    title: "Inventário",
    desc: "Contagem cíclica e ajustes",
    url: "/inventario",
    icon: ClipboardList,
    tone: "info",
  },
  {
    title: "Entrada de NF/Compras",
    desc: "XML de fornecedores",
    url: "/estoque/compras",
    icon: FileText,
    tone: "success",
  },
  {
    title: "Movimentações",
    desc: "Histórico de entradas e saídas",
    url: "/estoque/movimentacoes",
    icon: ArrowLeftRight,
    tone: "warning",
  },
  {
    title: "Etiquetas",
    desc: "Impressão de códigos de barras",
    url: "/estoque/etiquetas",
    icon: Tag,
    tone: "info",
  },
];

function StockPage() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Estoque" subtitle="Gestão de Inventário" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <HubHero
            eyebrow="Estoque"
            icon={Box}
            title="Inventário sob controle, perdas zeradas"
            description="Catálogo, entradas, contagens e movimentações conectados ao PDV em tempo real."
            actions={[
              { label: "Novo Produto", to: "/produtos", icon: Plus },
              {
                label: "Iniciar Inventário",
                to: "/inventario",
                icon: ClipboardList,
                variant: "ghost",
              },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => (
              <FeatureCard
                key={m.url}
                to={m.url}
                icon={m.icon}
                title={m.title}
                description={m.desc}
                tone={m.tone}
              />
            ))}
          </div>

          <StockList />
        </main>
      </div>
    </div>
  );
}
