import { createFileRoute, Link } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  Shield,
  PieChart,
  Target,
  Zap,
  ArrowDownRight,
  ChevronRight,
  MoreHorizontal,
  UserCheck,
  Sparkles,
  Lightbulb,
  AlertCircle,
  Loader2,
  Home,
  User,
  Package,
  ShoppingCart,
  Hammer,
  Archive,
  FileText,
  List,
  ChevronDown,
  UserPlus,
  UserRound,
  Trophy,
  Cake,
  Scale,
  CreditCard,
  LayoutDashboard,
  History,
  ClipboardList,
  Box,
  FileSpreadsheet,
  Calculator,
  Contact2,
  Wallet,
  Users2,
  Building2,
  UserCircle,
  Briefcase,
  Facebook,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
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
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableCategory } from "@/components/reports/SortableCategory";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ConectaCRM" },
      { name: "description", content: "Métricas avançadas de vendas" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user, profile, permissions } = useAuth();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  type Trend = { value: string; isUp: boolean };
  type Stats = {
    revenue: number;
    leads: number;
    conversion: number;
    avgTicket: number;
    revenueTrend: Trend;
    leadsTrend: Trend;
    conversionTrend: Trend;
    avgTicketTrend: Trend;
  };
  const [stats, setStats] = useState<Stats>({
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
  const [menuQuery, setMenuQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);


  type Category = {
    id: string;
    label: string;
    icon: typeof Home;
    hasArrow?: boolean;
    isNew?: boolean;
    children?: { id: string; label: string; icon: typeof Home; isNew?: boolean }[];
  };
  const [categories, setCategories] = useState<Category[]>([
    { id: "visao-geral", label: "Visão geral - Atalhos", icon: Home },
    {
      id: "clientes",
      label: "Clientes",
      icon: Users,
      hasArrow: true,
      children: [
        { id: "clientes-indicacao", label: "Programa de indicações", icon: UserPlus },
        { id: "clientes-perfil", label: "Perfil de Clientes", icon: UserRound },
        { id: "clientes-ranking", label: "Ranking de Clientes", icon: Trophy },
        { id: "clientes-aniversario", label: "Rel. de Aniversário", icon: Cake },
      ],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      icon: DollarSign,
      hasArrow: true,
      children: [
        { id: "fin-dre-gerencial", label: "DRE gerencial", icon: Scale },
        { id: "fin-relatorio", label: "Relatório Financeiro", icon: Scale },
        { id: "fin-relatorio-vendas", label: "Relatório Financeiro - Vendas", icon: Scale },
        { id: "fin-relatorio-vendas-os", label: "Relatório Financeiro - Vendas + OS", icon: Scale },
        { id: "fin-multilojas", label: "Relatório Financeiro Multi Lojas", icon: Scale },
        { id: "fin-dre-2", label: "DRE 2.0", icon: Scale },
        { id: "fin-relatorio-vendas-os-2", label: "Relatório Financeiro Vendas + OS", icon: Scale },
        { id: "fin-formas-pagamento", label: "Formas de pagamento", icon: CreditCard },
        {
          id: "fin-formas-pagamento-dia",
          label: "Formas de pagamento por dia",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: "produto",
      label: "Produto",
      icon: Package,
      isNew: true,
      hasArrow: true,
      children: [
        { id: "prod-vendidos", label: "Produtos Vendidos", icon: ClipboardList },
        { id: "prod-resumo-estoque", label: "Resumo de Estoque", icon: Box },
        {
          id: "prod-detalhes-estoque",
          label: "Detalhes do Estoque",
          icon: Calculator,
          isNew: true,
        },
      ],
    },
    {
      id: "vendas",
      label: "Vendas",
      icon: ShoppingCart,
      isNew: true,
      hasArrow: true,
      children: [
        { id: "vendas-relatorio", label: "Relatório de vendas", icon: ShoppingCart, isNew: true },
        { id: "vendas-historico", label: "Relatório Histórico de Venda", icon: History },
        {
          id: "vendas-projecoes",
          label: "Dashboard Analítico de Projeções",
          icon: LayoutDashboard,
        },
        { id: "vendas-produtos", label: "Produtos Vendidos", icon: Box },
      ],
    },
    {
      id: "ordem-servico",
      label: "Ordem de serviço",
      icon: Hammer,
      hasArrow: true,
      children: [
        { id: "os-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "os-detalhes", label: "Detalhes de OS", icon: ClipboardList },
      ],
    },
    {
      id: "fiscal",
      label: "Fiscal",
      icon: DollarSign,
      hasArrow: true,
      children: [{ id: "fiscal-nfe", label: "Relatório de NFe", icon: FileSpreadsheet }],
    },
    {
      id: "vendedores",
      label: "Vendedores",
      icon: UserCheck,
      isNew: true,
      hasArrow: true,
      children: [
        { id: "vend-dash", label: "Dashboard Vendedor", icon: Contact2 },
        { id: "vend-comissao", label: "Rel. de Comissão", icon: Wallet, isNew: true },
        { id: "vend-relatorio", label: "Rel. de Vendedores", icon: Users2 },
        { id: "vend-multi", label: "Rel. de Vendedores Multi Empresa", icon: Building2 },
        { id: "vend-por-dia", label: "Vendas por vendedor (Por dia)", icon: UserCircle },
        {
          id: "vend-pagamento",
          label: "Total por vendedor e Forma de pagamento",
          icon: UserCircle,
        },
      ],
    },
    {
      id: "tecnicos",
      label: "Técnicos",
      icon: Users,
      isNew: true,
      hasArrow: true,
      children: [
        { id: "tec-comissao", label: "Rel. de Comissão Técnico", icon: Wallet, isNew: true },
      ],
    },
    {
      id: "outros",
      label: "Outros",
      icon: List,
      hasArrow: true,
      children: [
        { id: "out-metas", label: "Dashboard Metas", icon: BarChart3 },
        { id: "out-recap", label: "Relatório Recap Anual", icon: TrendingUp },
        { id: "out-mkt", label: "Dashboard Marketing (Meta)", icon: Facebook },
      ],
    },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("reports-menu-order", JSON.stringify(newOrder.map((c) => c.id)));
        return newOrder;
      });
    }
  };

  useEffect(() => {
    const savedOrder = localStorage.getItem("reports-menu-order");
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        setCategories((prev) => {
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
    setExpandedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  };

  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent("force-sidebar-collapse", { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent("force-sidebar-collapse", { detail: false }));
    };
  }, []);

  type FunnelDatum = { name: string; value: number; color: string };
  type OriginDatum = { name: string; value: number; color: string };
  type AgentDatum = { name: string; avatar: string; sales: number; revenue: string; trend: string };
  type ExtraStats = {
    despesasOpen: number; despesasOverdue: number; despesasTotal: number; despesasPaid: number;
    receitasOpen: number; receitasTotal: number; receitasPaid: number;
    caixaSaldo: number; caixaIncome: number; caixaExpense: number;
    productsCount: number; productsActive: number; lowStock: number; outOfStock: number; stockValue: number;
  };
  const [funnelData, setFunnelData] = useState<FunnelDatum[]>([]);
  const [originData, setOriginData] = useState<OriginDatum[]>([]);
  const [topAgents, setTopAgents] = useState<AgentDatum[]>([]);
  const [extra, setExtra] = useState<ExtraStats>({
    despesasOpen: 0, despesasOverdue: 0, despesasTotal: 0, despesasPaid: 0,
    receitasOpen: 0, receitasTotal: 0, receitasPaid: 0,
    caixaSaldo: 0, caixaIncome: 0, caixaExpense: 0,
    productsCount: 0, productsActive: 0, lowStock: 0, outOfStock: 0, stockValue: 0,
  });

  const fetchReportsData = useCallback(async () => {
    if (!user?.id || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      type SaleRow = { total_amount: number | null; status: string | null; created_at: string | null };
      type LeadRow = { source: string | null; status: string | null; created_at: string | null };
      type StageRow = { id: string; name: string; color: string | null };
      type PipelineRow = { stage_id: string | null };
      type PayRow = { amount: number | null; paid_amount: number | null; status: string | null; due_date: string | null };
      type TxRow = { type: string | null; amount: number | null };
      type ProductRow = { active: boolean | null; stock_quantity: number | null; min_stock: number | null; cost_price: number | null; price: number | null };

      const filt = <T,>(q: T): T => ((q as any).eq("organization_id", orgId)) as T;

      const [salesRes, leadsRes, stagesRes, pipelineRes, payRes, recRes, txRes, prodRes] = await Promise.all([
        filt(supabase.from("sales_orders").select("total_amount, status, created_at")),
        filt(supabase.from("leads").select("source, status, created_at")),
        filt(supabase.from("funnel_stages").select("name, color, id")).order("order_index"),
        filt(supabase.from("pipeline_leads").select("stage_id")),
        filt(supabase.from("accounts_payable").select("amount, paid_amount, status, due_date")),
        filt(supabase.from("accounts_receivable").select("amount, paid_amount, status, due_date")),
        filt(supabase.from("finance_transactions").select("type, amount")),
        filt(supabase.from("products").select("active, stock_quantity, min_stock, cost_price, price")),
      ]);

      const sales = (salesRes.data || []) as SaleRow[];
      const leads = (leadsRes.data || []) as LeadRow[];
      const stages = (stagesRes.data || []) as StageRow[];
      const pipeline = (pipelineRes.data || []) as PipelineRow[];
      const pays = (payRes.data || []) as PayRow[];
      const recs = (recRes.data || []) as PayRow[];
      const txs = (txRes.data || []) as TxRow[];
      const prods = (prodRes.data || []) as ProductRow[];

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const concludedSales = sales.filter((s) => s.status === "concluded" || s.status === "completed");
      const currentMonthSales = concludedSales.filter(
        (s) => s.created_at != null && new Date(s.created_at) >= monthStart,
      );
      const monthRevenue = currentMonthSales.reduce((acc, c) => acc + (c.total_amount || 0), 0);

      const currentLeads = leads.filter((l) => l.created_at != null && new Date(l.created_at) >= monthStart);
      const wonLeads = currentLeads.filter((l) => l.status != null && ["won", "concluded"].includes(l.status)).length;

      setStats({
        revenue: monthRevenue,
        leads: currentLeads.length,
        conversion: currentLeads.length > 0 ? (wonLeads / currentLeads.length) * 100 : 0,
        avgTicket: currentMonthSales.length > 0 ? monthRevenue / currentMonthSales.length : 0,
        revenueTrend: { value: "—", isUp: true },
        leadsTrend: { value: "—", isUp: true },
        conversionTrend: { value: "—", isUp: true },
        avgTicketTrend: { value: "—", isUp: true },
      });

      // === FINANCEIRO sync ===
      const today = new Date().toISOString().split("T")[0];
      const sumPending = (rows: PayRow[]) =>
        rows.filter((r) => r.status !== "paid").reduce((a, r) => a + (Number(r.amount) || 0), 0);
      const sumPaid = (rows: PayRow[]) =>
        rows.reduce((a, r) => a + (Number(r.paid_amount) || (r.status === "paid" ? Number(r.amount) || 0 : 0)), 0);
      const overdue = pays.filter((r) => r.status !== "paid" && r.due_date && r.due_date < today)
        .reduce((a, r) => a + (Number(r.amount) || 0), 0);

      const caixaIncome = txs.filter((t) => t.type === "income").reduce((a, t) => a + (Number(t.amount) || 0), 0);
      const caixaExpense = txs.filter((t) => t.type === "expense").reduce((a, t) => a + (Number(t.amount) || 0), 0);

      // === ESTOQUE sync ===
      const active = prods.filter((p) => p.active !== false);
      const lowStock = active.filter((p) => {
        const q = Number(p.stock_quantity) || 0;
        const m = Number(p.min_stock) || 0;
        return m > 0 && q <= m && q > 0;
      }).length;
      const outOfStock = active.filter((p) => (Number(p.stock_quantity) || 0) <= 0).length;
      const stockValue = active.reduce(
        (a, p) => a + (Number(p.stock_quantity) || 0) * (Number(p.cost_price) || Number(p.price) || 0),
        0,
      );

      setExtra({
        despesasOpen: sumPending(pays),
        despesasOverdue: overdue,
        despesasTotal: pays.reduce((a, r) => a + (Number(r.amount) || 0), 0),
        despesasPaid: sumPaid(pays),
        receitasOpen: sumPending(recs),
        receitasTotal: recs.reduce((a, r) => a + (Number(r.amount) || 0), 0),
        receitasPaid: sumPaid(recs),
        caixaSaldo: caixaIncome - caixaExpense,
        caixaIncome,
        caixaExpense,
        productsCount: prods.length,
        productsActive: active.length,
        lowStock,
        outOfStock,
        stockValue,
      });

      setFunnelData(
        stages.map((s) => ({
          name: s.name,
          value: pipeline.filter((p) => p.stage_id === s.id).length,
          color: s.color || "#64748b",
        })),
      );

      const counts: Record<string, number> = {};
      leads.forEach((l) => {
        const src = l.source || "Direto";
        counts[src] = (counts[src] || 0) + 1;
      });
      setOriginData(
        Object.entries(counts).map(([name, value]) => ({
          name,
          value,
          color: name === "WhatsApp" ? "#25D366" : name === "Instagram" ? "#E1306C" : "#64748b",
        })),
      );

      if (concludedSales.length > 0) {
        setTopAgents([
          {
            name: profile?.display_name || "Você",
            avatar: (profile?.display_name || "V")[0],
            sales: concludedSales.length,
            revenue: monthRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            trend: "+0%",
          },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, profile?.display_name]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  // Realtime sync: re-fetch when any source table changes
  useEffect(() => {
    if (!user?.id) return;
    const tables = [
      "sales_orders",
      "accounts_payable",
      "accounts_receivable",
      "finance_transactions",
      "products",
    ];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchReportsData(), 600);
    };
    const channel = supabase.channel("reports-sync");
    tables.forEach((t) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, debounced);
    });
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchReportsData]);

  const SUPER_EMAILS = ["alfatech791@gmail.com", "contato@focussdev.art"];
  const allowedRoles = ["admin", "owner", "super_admin", "manager", "financeiro"];
  const userEmail = (profile?.email ?? user?.email ?? "").toLowerCase();
  const role = String(profile?.role ?? "").trim().toLowerCase();
  const isSuper = SUPER_EMAILS.includes(userEmail);
  const hasReportsPerm = !!(permissions as any)?.relatorios;
  const allowed = isSuper || hasReportsPerm || allowedRoles.includes(role);
  if (profile && !allowed) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar title="Acesso Negado" subtitle="Você não tem permissão para ver esta página" />
          <main className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md">
              <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Página Restrita</h2>
              <p className="text-muted-foreground mb-8">
                O seu nível de acesso não permite visualizar relatórios avançados.
              </p>
              <Link
                to="/"
                className="inline-flex h-11 px-6 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm shadow-glow"
              >
                Voltar ao Início
              </Link>
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
        <Topbar
          title="Métricas & Relatórios"
          subtitle="Análise detalhada do seu desempenho comercial"
        />
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 border-r border-slate-100 bg-white overflow-y-auto hidden md:block shadow-sm shrink-0">
            <div className="p-4">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-[#E8F0FE] text-primary font-bold text-sm mb-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Relatórios</span>
                  <span className="bg-success text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                    NOVO
                  </span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>
              <nav className="space-y-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={categories.map((c) => c.id)}
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
            {activeCategory !== "visao-geral" && (
              <div className="mb-6 flex items-center gap-2">
                <button
                  onClick={() => setActiveCategory("visao-geral")}
                  className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" /> Visão Geral
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {activeCategory.replace(/-/g, " ")}
                </span>
              </div>
            )}
            <DashboardContent
              activeCategory={activeCategory}
              stats={stats}
              extra={extra}
              funnelData={funnelData}
              originData={originData}
              topAgents={topAgents}
              funnelPercentages={[]}
              loading={loading}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
