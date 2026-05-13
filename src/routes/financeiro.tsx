import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { FeatureCard, type FeatureCardTone } from "@/components/ui/FeatureCard";
import { FinanceDashboard } from "@/components/financeiro/FinanceDashboard";
import { useState } from "react";
import {
  DollarSign,
  Wallet,
  TrendingUp,
  Banknote,
  Users,
  CreditCard,
  ListTree,
  FileWarning,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/financeiro")({
  component: FinancePage,
});

const modules: { title: string; desc: string; url: string; icon: any; tone: FeatureCardTone }[] = [
  {
    title: "Fluxo de Caixa",
    desc: "Entradas e saídas no tempo",
    url: "/financeiro/caixa",
    icon: Wallet,
    tone: "primary",
  },
  {
    title: "DRE Gerencial",
    desc: "Resultado por competência",
    url: "/financeiro/dre",
    icon: TrendingUp,
    tone: "success",
  },
  {
    title: "Conciliação OFX",
    desc: "Bata extrato bancário",
    url: "/conciliacao",
    icon: Banknote,
    tone: "info",
  },
  {
    title: "Fornecedores",
    desc: "Cadastro e contas a pagar",
    url: "/financeiro/fornecedores",
    icon: Users,
    tone: "violet",
  },
  {
    title: "Maquininhas POS",
    desc: "Taxas e antecipações",
    url: "/financeiro/maquininhas",
    icon: CreditCard,
    tone: "warning",
  },
  {
    title: "Plano de Contas",
    desc: "Centros de custo e categorias",
    url: "/financeiro/plano-contas",
    icon: ListTree,
    tone: "info",
  },
  {
    title: "Notas em Aberto",
    desc: "Vencidas e a vencer",
    url: "/financeiro/notas-aberto",
    icon: FileWarning,
    tone: "destructive",
  },
];

function FinancePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Financeiro"
          subtitle="Saúde financeira da empresa"
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <HubHero
            eyebrow="Financeiro"
            icon={DollarSign}
            title="Visão clara do dinheiro que entra e sai"
            description="Fluxo de caixa, DRE, conciliação bancária e contas a pagar/receber em um único hub."
            actions={[
              { label: "Nova Movimentação", to: "/financeiro/caixa", icon: Plus },
              { label: "Ver DRE", to: "/financeiro/dre", icon: TrendingUp, variant: "ghost" },
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

          <FinanceDashboard />
        </main>
      </div>
    </div>
  );
}
