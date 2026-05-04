import { createFileRoute, Link } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { 
  BarChart3, TrendingUp, Users, DollarSign, Calendar, Download, 
  Filter, ArrowUpRight, Shield, PieChart, Target, Zap, 
  ArrowDownRight, ChevronRight, MoreHorizontal, UserCheck, Sparkles,
  Lightbulb, AlertCircle, Loader2, Home, User, Package, ShoppingCart,
  Hammer, Archive, FileText, List, ChevronDown, UserPlus, UserRound,
  Trophy, Cake, Scale, CreditCard, LayoutDashboard, History, ClipboardList,
  Box, FileSpreadsheet, Calculator, Contact2, Wallet, Users2, Building2, UserCircle, Briefcase, Facebook
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardContent } from "@/components/reports/DashboardContent";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableCategory } from "@/components/reports/SortableCategory";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — ConectaCRM" }, { name: "description", content: "Métricas avançadas de vendas" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    revenue: 0,
    leads: 0,
    conversion: 0,
    avgTicket: 0,
    revenueTrend: { value: "0%", isUp: true },
    leadsTrend: { value: "0%", isUp: true },
    conversionTrend: { value: "0%", isUp: true },
    avgTicketTrend: { value: "0%", isUp: true },
  });
  const [activeCategory, setActiveCategory] = useState("visao-geral");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  const [categories, setCategories] = useState<any[]>([
    { id: "visao-geral", label: "Visão geral - Atalhos", icon: Home },
    { id: "clientes", label: "Clientes", icon: Users, hasArrow: true, children: [{ id: "clientes-indicacao", label: "Programa de indicações", icon: UserPlus }, { id: "clientes-perfil", label: "Perfil de Clientes", icon: UserRound }, { id: "clientes-ranking", label: "Ranking de Clientes", icon: Trophy }, { id: "clientes-aniversario", label: "Rel. de Aniversário", icon: Cake }] },
    { id: "financeiro", label: "Financeiro", icon: DollarSign, hasArrow: true, children: [{ id: "fin-dre-gerencial", label: "DRE gerencial", icon: Scale }, { id: "fin-relatorio", label: "Relatório Financeiro", icon: Scale }, { id: "fin-relatorio-vendas", label: "Relatório Financeiro - Vendas", icon: Scale }, { id: "fin-relatorio-vendas-os", label: "Relatório Financeiro - Vendas + OS", icon: Scale }, { id: "fin-multilojas", label: "Relatório Financeiro Multi Lojas", icon: Scale }, { id: "fin-dre-2", label: "DRE 2.0", icon: Scale }, { id: "fin-relatorio-vendas-os-2", label: "Relatório Financeiro Vendas + OS", icon: Scale }, { id: "fin-formas-pagamento", label: "Formas de pagamento", icon: CreditCard }, { id: "fin-formas-pagamento-dia", label: "Formas de pagamento por dia", icon: LayoutDashboard }] },
    { id: "produto", label: "Produto", icon: Package, isNew: true, hasArrow: true, children: [{ id: "prod-vendidos", label: "Produtos Vendidos", icon: ClipboardList }, { id: "prod-resumo-estoque", label: "Resumo de Estoque", icon: Box }, { id: "prod-detalhes-estoque", label: "Detalhes do Estoque", icon: Calculator, isNew: true }] },
    { id: "vendas", label: "Vendas", icon: ShoppingCart, isNew: true, hasArrow: true, children: [{ id: "vendas-relatorio", label: "Relatório de vendas", icon: ShoppingCart, isNew: true }, { id: "vendas-historico", label: "Relatório Histórico de Venda", icon: History }, { id: "vendas-projecoes", label: "Dashboard Analítico de Projeções", icon: LayoutDashboard }, { id: "vendas-produtos", label: "Produtos Vendidos", icon: Box }] },
    { id: "ordem-servico", label: "Ordem de serviço", icon: Hammer, hasArrow: true, children: [{ id: "os-dashboard", label: "Dashboard", icon: LayoutDashboard }, { id: "os-detalhes", label: "Detalhes de OS", icon: ClipboardList }] },
    { id: "fiscal", label: "Fiscal", icon: DollarSign, hasArrow: true, children: [{ id: "fiscal-nfe", label: "Relatório de NFe", icon: FileSpreadsheet }] },
    { id: "vendedores", label: "Vendedores", icon: UserCheck, isNew: true, hasArrow: true, children: [{ id: "vend-dash", label: "Dashboard Vendedor", icon: Contact2 }, { id: "vend-comissao", label: "Rel. de Comissão", icon: Wallet, isNew: true }, { id: "vend-relatorio", label: "Rel. de Vendedores", icon: Users2 }, { id: "vend-multi", label: "Rel. de Vendedores Multi Empresa", icon: Building2 }, { id: "vend-por-dia", label: "Vendas por vendedor (Por dia)", icon: UserCircle }, { id: "vend-pagamento", label: "Total por vendedor e Forma de pagamento", icon: UserCircle }] },
    { id: "tecnicos", label: "Técnicos", icon: Users, isNew: true, hasArrow: true, children: [{ id: "tec-comissao", label: "Rel. de Comissão Técnico", icon: Wallet, isNew: true }] },
    { id: "outros", label: "Outros", icon: List, hasArrow: true, children: [{ id: "out-metas", label: "Dashboard Metas", icon: BarChart3 }, { id: "out-recap", label: "Relatório Recap Anual", icon: TrendingUp }, { id: "out-mkt", label: "Dashboard Marketing (Meta)", icon: Facebook }] },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('reports-menu-order', JSON.stringify(newOrder.map(c => c.id)));
        return newOrder;
      });
    }
  };

  useEffect(() => {
    const savedOrder = localStorage.getItem('reports-menu-order');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        setCategories(prev => {
          const currentIds = prev.map(c => c.id);
          const sorted = [...prev].sort((a, b) => {
            const aIndex = orderIds.indexOf(a.id);
            const bIndex = orderIds.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          return sorted;
        });
      } catch (e) {
        console.error("Error parsing saved order", e);
      }
    }
  }, []);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent('force-sidebar-collapse', { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent('force-sidebar-collapse', { detail: false }));
    };
  }, []);

  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [originData, setOriginData] = useState<any[]>([]);
  const [topAgents, setTopAgents] = useState<any[]>([]);

  const fetchReportsData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: sales } = await supabase.from("sales_orders").select("total_amount, status, created_at, user_id").eq("user_id", user.id);
      const concludedSales = (sales || []).filter(s => s.status === 'concluded');
      const currentMonthSales = concludedSales.filter(s => new Date(s.created_at!) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const monthRevenue = currentMonthSales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
      
      const { data: leads } = await supabase.from("leads").select("source, status, created_at").eq("user_id", user.id);
      const currentLeads = (leads || []).filter(l => l.created_at && new Date(l.created_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const wonLeads = currentLeads.filter(l => l.status && ['won', 'concluded'].includes(l.status)).length;
      
      setStats({
        revenue: monthRevenue,
        leads: currentLeads.length,
        conversion: currentLeads.length > 0 ? (wonLeads / currentLeads.length) * 100 : 0,
        avgTicket: currentMonthSales.length > 0 ? monthRevenue / currentMonthSales.length : 0,
        revenueTrend: { value: "+12%", isUp: true },
        leadsTrend: { value: "+5%", isUp: true },
        conversionTrend: { value: "+2%", isUp: true },
        avgTicketTrend: { value: "+8%", isUp: true },
      });

      const { data: stages } = await supabase.from("funnel_stages").select("name, color, id").eq("user_id", user.id).order("order_index");
      const { data: pipeline } = await supabase.from("pipeline_leads").select("stage_id").eq("user_id", user.id);
      setFunnelData((stages || []).map(s => ({ name: s.name, value: (pipeline || []).filter(p => p.stage_id === s.id).length, color: s.color || "#64748b" })));

      const counts: Record<string, number> = {};
      (leads || []).forEach(l => { const src = l.source || "Direto"; counts[src] = (counts[src] || 0) + 1; });
      setOriginData(Object.entries(counts).map(([name, value]) => ({ name, value, color: name === 'WhatsApp' ? '#25D366' : name === 'Instagram' ? '#E1306C' : '#64748b' })));
      
      if (concludedSales.length > 0) {
        setTopAgents([{ name: profile?.display_name || "Você", avatar: (profile?.display_name || "V")[0], sales: concludedSales.length, revenue: monthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), trend: "+0%" }]);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [user?.id, profile?.display_name]);

  useEffect(() => { fetchReportsData(); }, [fetchReportsData]);

  if (profile?.role !== 'admin' && profile) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar title="Acesso Negado" subtitle="Você não tem permissão para ver esta página" />
          <main className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md">
              <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6"><Shield className="h-10 w-10" /></div>
              <h2 className="text-2xl font-bold mb-2">Página Restrita</h2>
              <p className="text-muted-foreground mb-8">O seu nível de acesso não permite visualizar relatórios avançados.</p>
              <Link to="/" className="inline-flex h-11 px-6 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm shadow-glow">Voltar ao Início</Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-[#F8FAFC]">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Métricas & Relatórios" subtitle="Análise detalhada do seu desempenho comercial" />
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 border-r border-slate-100 bg-white overflow-y-auto hidden md:block shadow-sm shrink-0">
            <div className="p-4">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-[#E8F0FE] text-primary font-bold text-sm mb-6">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span>Relatórios</span><span className="bg-success text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">NOVO</span></div>
                <ChevronDown className="h-4 w-4" />
              </button>
              <nav className="space-y-1">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={categories.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {categories.map((cat) => (
                      <SortableCategory 
                        key={cat.id}
                        cat={cat}
                        activeCategory={activeCategory}
                        expandedCategories={expandedCategories}
                        setActiveCategory={setActiveCategory}
                        toggleCategory={toggleCategory}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </nav>
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F8FAFC]">
            {activeCategory !== 'visao-geral' && (
              <div className="mb-6 flex items-center gap-2">
                <button onClick={() => setActiveCategory('visao-geral')} className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                  <ChevronRight className="h-4 w-4 rotate-180" /> Visão Geral
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {activeCategory.replace(/-/g, ' ')}
                </span>
              </div>
            )}
            <DashboardContent activeCategory={activeCategory} stats={stats} funnelData={funnelData} originData={originData} topAgents={topAgents} funnelPercentages={[]} loading={loading} />
          </main>
        </div>
      </div>
    </div>
  );
}
