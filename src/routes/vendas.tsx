import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { FeatureCard, type FeatureCardTone } from "@/components/ui/FeatureCard";
import VendasDashboard from "@/components/vendas/VendasDashboard";
import {
  ShoppingBag,
  Plus,
  History,
  Receipt,
  FileText,
  Calculator,
  Smartphone,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/vendas")({
  component: VendasPage,
});

const modules: { title: string; desc: string; url: string; icon: any; tone: FeatureCardTone }[] = [
  {
    title: "Frente de Caixa (PDV)",
    desc: "Vendas balcão e recebimento",
    url: "/pdv",
    icon: ShoppingBag,
    tone: "primary",
  },
  {
    title: "Caixa",
    desc: "Sangria, reforço e fechamento",
    url: "/caixa-pdv",
    icon: Wallet,
    tone: "success",
  },
  {
    title: "Histórico de Vendas",
    desc: "Pesquisar e auditar pedidos",
    url: "/vendas/historico",
    icon: History,
    tone: "info",
  },
  {
    title: "Orçamentos",
    desc: "Propostas com link público",
    url: "/vendas/orcamentos",
    icon: FileText,
    tone: "violet",
  },
  { title: "Cupons Fiscais", desc: "NFC-e e SAT", url: "/fiscal", icon: Receipt, tone: "warning" },
  {
    title: "Simulador de Taxas",
    desc: "Compare maquininhas",
    url: "/vendas/simulador",
    icon: Calculator,
    tone: "info",
  },
  {
    title: "Calculadora de Usados",
    desc: "Avalie aparelhos na troca",
    url: "/vendas/calculadora",
    icon: Smartphone,
    tone: "violet",
  },
  {
    title: "Garantias",
    desc: "Controle de prazos e RMAs",
    url: "/vendas/garantias",
    icon: ShieldCheck,
    tone: "success",
  },
  {
    title: "Gestão Delivery",
    desc: "Entregas e motoboys",
    url: "/vendas/delivery",
    icon: Truck,
    tone: "warning",
  },
];

function VendasPage() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Gestão de Vendas" subtitle="Painel Comercial" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <HubHero
            eyebrow="Comercial"
            icon={ShoppingBag}
            title="Tudo o que vende, em um só lugar"
            description="PDV, orçamentos, fiscal, garantias e delivery — gerencie a operação comercial completa sem perder uma venda."
            actions={[
              { label: "Abrir PDV", to: "/pdv", icon: Plus },
              {
                label: "Novo Orçamento",
                to: "/vendas/orcamentos",
                icon: FileText,
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

          <VendasDashboard />
        </main>
      </div>
    </div>
  );
}
