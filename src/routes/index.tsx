import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TasksCard, AutomationsCard, AgendaCard, DispatchCard } from "@/components/dashboard/SidePanels";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { HeroHeader } from "@/components/dashboard/HeroHeader";
import { GoalProgress } from "@/components/dashboard/GoalProgress";
  import { useState, Suspense, lazy } from "react";
  import { useAuth } from "@/contexts/AuthContext";
  import { useDashboardStats, type Period } from "@/hooks/useDashboardStats";
 import { 
   DropdownMenu, 
   DropdownMenuContent, 
   DropdownMenuItem, 
   DropdownMenuTrigger 
 } from "@/components/ui/dropdown-menu";
 import { Button } from "@/components/ui/button";
 import { Calendar, ChevronDown } from "lucide-react";

 // Lazy load secondary components to improve initial paint
 const SalesChart = lazy(() => import("@/components/dashboard/SalesChart").then(m => ({ default: m.SalesChart })));
 const OriginDonut = lazy(() => import("@/components/dashboard/OriginDonut").then(m => ({ default: m.OriginDonut })));
 const ChannelMini = lazy(() => import("@/components/dashboard/ChannelMini").then(m => ({ default: m.ChannelMini })));
 const Funnel = lazy(() => import("@/components/dashboard/Funnel").then(m => ({ default: m.Funnel })));
 const MessagesPanel = lazy(() => import("@/components/dashboard/MessagesPanel").then(m => ({ default: m.MessagesPanel })));
 const RecentService = lazy(() => import("@/components/dashboard/RecentPanels").then(m => ({ default: m.RecentService })));
 const RecentLeads = lazy(() => import("@/components/dashboard/RecentPanels").then(m => ({ default: m.RecentLeads })));
 const MonthComparison = lazy(() => import("@/components/dashboard/MonthComparison").then(m => ({ default: m.MonthComparison })));

 export const Route = createFileRoute("/")({
   head: () => ({
     meta: [
       { title: "Painel — ConectaCRM" },
       { name: "description", content: "Dashboard ConectaCRM: leads, vendas, atendimentos e automações em um só lugar." },
     ],
   }),
   component: Dashboard,
 });

 function Dashboard() {
   const { user } = useAuth();
   const [sidebarOpen, setSidebarOpen] = useState(false);
   const [period] = useState<Period>('today');
   const { stats, loading, refresh } = useDashboardStats(period);

   const kpis = [
     { label: "Vendas de hoje", value: stats.todaySales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), trend: "", sub: "Total faturado no dia", icon: "ShoppingBag", tone: "success" },
     { label: "Ordens de serviço em aberto", value: String(stats.activeOS), trend: "", sub: stats.activeOS > 5 ? "Demanda acima da média" : "Operação sob controle", icon: "Wrench", tone: "warning" },
     { label: "Itens com estoque baixo", value: String(stats.lowStock), trend: "", sub: stats.lowStock > 0 ? "Reposição recomendada" : "Estoque equilibrado", icon: "Box", tone: "destructive" },
     { label: "Faturamento do mês", value: stats.monthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), trend: "", sub: "Meta mensal: R$ 50.000", icon: "DollarSign", tone: "primary" },
     { label: "Leads recebidos hoje", value: String(stats.newLeads), trend: "", sub: "Novos contatos no funil", icon: "Users", tone: "info" },
     { label: "Ticket médio", value: stats.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), trend: "", sub: "Valor médio por venda (30 dias)", icon: "TrendingUp", tone: "success" },
   ];

   return (
     <div className="min-h-screen flex w-full bg-background/50">
       <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
         <Topbar 
          title={`Olá, ${user?.user_metadata?.display_name || 'Usuário'}! 👋`}
          subtitle="Aqui está o resumo do seu negócio hoje." 
          toggleSidebar={() => setSidebarOpen(true)}
        />
         <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
           <HeroHeader
             userName={user?.user_metadata?.display_name || "Usuário"}
             todaySales={stats.todaySales}
             monthRevenue={stats.monthRevenue}
             newLeads={stats.newLeads}
           />

           <QuickActions />

             <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
             <div className="flex-1 flex flex-col gap-6 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl bg-card border border-border animate-pulse" />
                    ))
                  ) : kpis.map((k) => (
                     <KpiCard key={k.label} {...k} />
                  ))}
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-2">
                     <Suspense fallback={<div className="h-[340px] rounded-2xl bg-card border border-border animate-pulse" />}>
                       <SalesChart />
                     </Suspense>
                   </div>
                   <GoalProgress current={stats.monthRevenue} goal={50000} onGoalUpdate={refresh} />
                 </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Suspense fallback={<div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />}>
                      <MonthComparison />
                    </Suspense>
                    <Suspense fallback={<div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />}>
                      <OriginDonut />
                    </Suspense>
                    <Suspense fallback={<div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />}>
                      <ChannelMini />
                    </Suspense>
                 </div>

                 <Suspense fallback={<div className="h-[300px] rounded-2xl bg-card border border-border animate-pulse" />}>
                   <Funnel />
                 </Suspense>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Suspense fallback={<div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />}>
                      <RecentService />
                    </Suspense>
                    <TasksCard />
                 </div>

                 <Suspense fallback={<div className="h-[200px] rounded-2xl bg-card border border-border animate-pulse" />}>
                   <RecentLeads />
                 </Suspense>
                <AutomationsCard />
              </div>

               <div className="w-full xl:w-[380px] shrink-0 flex flex-col gap-6">
                 <div className="xl:sticky xl:top-24">
                   <Suspense fallback={<div className="h-[400px] rounded-2xl bg-card border border-border animate-pulse" />}>
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
