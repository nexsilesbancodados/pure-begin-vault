import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  TasksCard,
  AutomationsCard,
  AgendaCard,
  DispatchCard,
} from "@/components/dashboard/SidePanels";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { HeroHeader } from "@/components/dashboard/HeroHeader";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { GoalProgress } from "@/components/dashboard/GoalProgress";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useState, Suspense, lazy } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, type Period } from "@/hooks/useDashboardStats";
import { useDashboardRole, ROLE_LABEL } from "@/lib/userRole";
import { SellerRanking } from "@/components/dashboard/SellerRanking";
import { StoresComparison } from "@/components/dashboard/StoresComparison";
import { TodayTasksWidget } from "@/components/dashboard/TodayTasksWidget";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";

// Lazy load secondary components to improve initial paint
const SalesChart = lazy(() =>
  import("@/components/dashboard/SalesChart").then((m) => ({ default: m.SalesChart })),
);
const OriginDonut = lazy(() =>
  import("@/components/dashboard/OriginDonut").then((m) => ({ default: m.OriginDonut })),
);
const ChannelMini = lazy(() =>
  import("@/components/dashboard/ChannelMini").then((m) => ({ default: m.ChannelMini })),
);
const Funnel = lazy(() =>
  import("@/components/dashboard/Funnel").then((m) => ({ default: m.Funnel })),
);
const MessagesPanel = lazy(() =>
  import("@/components/dashboard/MessagesPanel").then((m) => ({ default: m.MessagesPanel })),
);
const RecentService = lazy(() =>
  import("@/components/dashboard/RecentPanels").then((m) => ({ default: m.RecentService })),
);
const RecentLeads = lazy(() =>
  import("@/components/dashboard/RecentPanels").then((m) => ({ default: m.RecentLeads })),
);
const MonthComparison = lazy(() =>
  import("@/components/dashboard/MonthComparison").then((m) => ({ default: m.MonthComparison })),
);

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel — ConectaCRM" },
      {
        name: "description",
        content: "Dashboard ConectaCRM: leads, vendas, atendimentos e automações em um só lugar.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const displayName =
    profile?.nome ||
    (user?.user_metadata as { display_name?: string; full_name?: string; nome?: string } | undefined)?.display_name ||
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    (user?.user_metadata as { nome?: string } | undefined)?.nome ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period] = useState<Period>("today");
  const { stats, loading, refresh } = useDashboardStats(period);
  const role = useDashboardRole();

  const KPI_TODAY_SALES = {
    label: "Vendas de hoje",
    value: stats.todaySalesPDV.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    trend: "+12%",
    sub: stats.todaySalesImport > 0
      ? `R$ ${stats.todaySalesImport.toLocaleString("pt-BR")} importados`
      : "Total faturado via PDV",
    icon: "ShoppingBag",
    tone: "success",
  };
  const KPI_OS = {
    label: "Ordens de Serviço",
    value: String(stats.activeOS),
    trend: "",
    sub: "Aparelhos em bancada",
    icon: "Wrench",
    tone: "warning",
  };
  const KPI_STOCK = {
    label: "Estoque Baixo",
    value: String(stats.lowStock),
    trend: "",
    sub: "Itens sob limite mínimo",
    icon: "Box",
    tone: "destructive",
  };
  const KPI_MONTH = {
    label: "Faturamento Mensal",
    value: stats.monthRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    trend: "+8%",
    sub: "Mês atual acumulado",
    icon: "DollarSign",
    tone: "primary",
  };
  const KPI_LEADS = {
    label: "Novos Leads",
    value: String(stats.newLeads),
    trend: "",
    sub: "Contatos recebidos hoje",
    icon: "Users",
    tone: "info",
  };
  const KPI_TICKET = {
    label: "Ticket Médio",
    value: stats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    trend: "",
    sub: "Média por venda (30d)",
    icon: "TrendingUp",
    tone: "success",
  };

  // KPIs específicos por cargo
  const kpis =
    role === "vendedor"
      ? [KPI_TODAY_SALES, KPI_LEADS, KPI_TICKET, KPI_MONTH]
      : role === "financeiro"
        ? [KPI_MONTH, KPI_TODAY_SALES, KPI_TICKET, KPI_STOCK]
        : role === "tecnico"
          ? [KPI_OS, KPI_STOCK, KPI_TODAY_SALES, KPI_LEADS]
          : [KPI_TODAY_SALES, KPI_OS, KPI_STOCK, KPI_MONTH, KPI_LEADS, KPI_TICKET];

  const roleSubtitle: Record<string, string> = {
    admin: "Visão executiva consolidada com todos os indicadores.",
    vendedor: "Suas vendas, leads e meta — foco em performance.",
    financeiro: "Faturamento, ticket médio e indicadores financeiros.",
    tecnico: "Ordens de serviço, estoque e bancada.",
  };


  return (
    <div className="min-h-screen flex w-full bg-background/50">
      <OnboardingWizard />
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={`Olá, ${displayName}! 👋`}
          subtitle="Aqui está o resumo do seu negócio hoje."
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
          <HeroHeader userName={displayName} />

          <QuickActions />

          <LowStockAlert />

          <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-28 rounded-2xl bg-card border border-border animate-pulse"
                      />
                    ))
                  : kpis.map((k) => <KpiCard key={k.label} {...k} />)}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Suspense
                    fallback={
                      <div className="h-[340px] rounded-2xl bg-card border border-border animate-pulse" />
                    }
                  >
                    <SalesChart />
                  </Suspense>
                </div>
                <GoalProgress current={stats.monthRevenue} goal={50000} onGoalUpdate={refresh} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Suspense
                  fallback={
                    <div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />
                  }
                >
                  <MonthComparison />
                </Suspense>
                <Suspense
                  fallback={
                    <div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />
                  }
                >
                  <OriginDonut />
                </Suspense>
                <Suspense
                  fallback={
                    <div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />
                  }
                >
                  <ChannelMini />
                </Suspense>
              </div>

              <Suspense
                fallback={
                  <div className="h-[300px] rounded-2xl bg-card border border-border animate-pulse" />
                }
              >
                <Funnel />
              </Suspense>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Suspense
                  fallback={
                    <div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />
                  }
                >
                  <RecentService />
                </Suspense>
                <TasksCard />
              </div>

              <Suspense
                fallback={
                  <div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />
                }
              >
                <RecentLeads />
              </Suspense>
              <AutomationsCard />
            </div>

            <div className="w-full xl:w-[380px] shrink-0 flex flex-col gap-6">
              <div className="xl:sticky xl:top-24">
                <Suspense
                  fallback={
                    <div className="h-[400px] rounded-2xl bg-card border border-border animate-pulse" />
                  }
                >
                  <MessagesPanel />
                </Suspense>
              </div>
              <div className="hidden xl:flex flex-col gap-6">
                <AgendaCard />
                <DispatchCard />
              </div>
              <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                <AgendaCard />
                <DispatchCard />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
