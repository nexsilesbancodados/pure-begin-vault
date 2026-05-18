import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { FeatureCard, type FeatureCardTone } from "@/components/ui/FeatureCard";
import { Button } from "@/components/ui/button";
import VendasDashboard from "@/components/vendas/VendasDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
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
  DollarSign,
  TrendingUp,
  Activity,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/vendas")({
  component: VendasPage,
});

type ModuleDef = {
  title: string;
  desc: string;
  url: string;
  icon: any;
  tone: FeatureCardTone;
};

const operacional: ModuleDef[] = [
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
];

const documentos: ModuleDef[] = [
  {
    title: "Orçamentos",
    desc: "Propostas com link público",
    url: "/vendas/orcamentos",
    icon: FileText,
    tone: "violet",
  },
  { title: "Cupons Fiscais", desc: "NFC-e e SAT", url: "/fiscal", icon: Receipt, tone: "warning" },
  {
    title: "Garantias",
    desc: "Controle de prazos e RMAs",
    url: "/vendas/garantias",
    icon: ShieldCheck,
    tone: "success",
  },
];

const ferramentas: ModuleDef[] = [
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
    title: "Gestão Delivery",
    desc: "Entregas e motoboys",
    url: "/vendas/delivery",
    icon: Truck,
    tone: "warning",
  },
];

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Section({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ModuleDef[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <h3 className="text-base font-black tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {items.length} módulos
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((m) => (
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
    </section>
  );
}

function HeroKpis() {
  const { orgId } = useOrg();
  const [stats, setStats] = useState({ todayRevenue: 0, todayCount: 0, monthRevenue: 0 });

  useEffect(() => {
    if (!orgId) return;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    supabase
      .from("sales_orders")
      .select("total_amount, created_at, status")
      .eq("organization_id", orgId)
      .gte("created_at", start.toISOString())
      .then(({ data }) => {
        const rows = (data || []).filter((r: any) => r.status !== "cancelled");
        const today = new Date().toDateString();
        const todayRows = rows.filter((r: any) => new Date(r.created_at).toDateString() === today);
        const monthRevenue = rows.reduce((a: number, r: any) => a + (r.total_amount || 0), 0);
        const todayRevenue = todayRows.reduce((a: number, r: any) => a + (r.total_amount || 0), 0);
        setStats({ todayRevenue, todayCount: todayRows.length, monthRevenue });
      });
  }, [orgId]);

  const items = [
    { label: "Vendas hoje", value: brl(stats.todayRevenue), icon: DollarSign },
    { label: "Pedidos hoje", value: String(stats.todayCount), icon: Activity },
    { label: "Mês atual", value: brl(stats.monthRevenue), icon: TrendingUp },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-white/70 text-[10px] font-bold uppercase tracking-widest">
              <Icon className="h-3.5 w-3.5" /> {it.label}
            </div>
            <div className="text-white text-lg font-black truncate mt-1">{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function VendasPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Gestão de Vendas" subtitle="Painel Comercial" />
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
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
          >
            <HeroKpis />
          </HubHero>

          <Section
            title="Operacional"
            description="Vendas, caixa e auditoria do dia a dia"
            items={operacional}
          />
          <Section
            title="Documentos"
            description="Orçamentos, fiscal e pós-venda"
            items={documentos}
          />
          <Section
            title="Ferramentas"
            description="Simuladores, avaliação e logística"
            items={ferramentas}
          />

          <div className="flex items-center justify-between px-1 pt-2">
            <div>
              <h2 className="text-xl font-black tracking-tight">Painel ao vivo</h2>
              <p className="text-xs text-muted-foreground">
                Indicadores e histórico recente da operação
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/vendas/historico" })}
              className="text-primary font-bold hover:bg-primary/5"
            >
              Histórico completo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <VendasDashboard />
        </main>
      </div>
    </div>
  );
}
