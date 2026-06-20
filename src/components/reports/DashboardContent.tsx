import React from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Users,
  Target,
  TrendingUp,
  Sparkles,
  Calendar,
  Download,
  Filter,
  Zap,
  Lightbulb,
  AlertCircle,
  MoreHorizontal,
  UserCheck,
  Home,
  User,
  Package,
  ShoppingCart,
  Hammer,
  Archive,
  FileText,
  List,
  ChevronDown,
  ChevronRight,
  Wallet,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { SalesReportTable } from "@/components/reports/SalesReportTable";
import { SoldProductsReport } from "@/components/reports/SoldProductsReport";
import { StockSummaryReport } from "@/components/reports/StockSummaryReport";

interface ExtraStats {
  despesasOpen: number; despesasOverdue: number; despesasTotal: number; despesasPaid: number;
  receitasOpen: number; receitasTotal: number; receitasPaid: number;
  caixaSaldo: number; caixaIncome: number; caixaExpense: number;
  productsCount: number; productsActive: number; lowStock: number; outOfStock: number; stockValue: number;
  salesCount?: number; salesToday?: number; salesWeek?: number; salesMonth?: number;
  revenueToday?: number; revenueWeek?: number;
  financeMargin?: number; financeOverdueCount?: number;
  comprasPaid?: number; comprasOpen?: number; lucroBruto?: number;
}

interface DashboardContentProps {
  activeCategory: string;
  stats: any;
  extra?: ExtraStats;
  funnelData: any[];
  originData: any[];
  topAgents: any[];
  funnelPercentages: string[];
  loading: boolean;
  onNavigate?: (id: string) => void;
}

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const DashboardContent: React.FC<DashboardContentProps> = ({
  activeCategory,
  stats,
  extra,
  funnelData,
  originData,
  topAgents,
  funnelPercentages,
  loading,
  onNavigate,
}) => {
  const renderSummaryCards = () => {
    const allStats = [
      {
        label: "Faturamento",
        value: stats.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        trend: stats.revenueTrend,
        icon: DollarSign,
        bg: "bg-primary/10",
        text: "text-primary",
        categories: ["visao-geral", "financeiro", "vendas", "vendedores"],
      },
      {
        label: "Leads Totais",
        value: stats.leads.toString(),
        trend: stats.leadsTrend,
        icon: Users,
        bg: "bg-info/10",
        text: "text-info",
        categories: ["visao-geral", "clientes", "vendas"],
      },
      {
        label: "Conversão",
        value: stats.conversion.toFixed(1) + "%",
        trend: stats.conversionTrend,
        icon: Target,
        bg: "bg-success/10",
        text: "text-success",
        categories: ["visao-geral", "vendas", "vendedores"],
      },
      {
        label: "Ticket Médio",
        value: stats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        trend: stats.avgTicketTrend,
        icon: TrendingUp,
        bg: "bg-warning/10",
        text: "text-warning",
        categories: ["visao-geral", "vendas", "financeiro"],
      },
      {
        label: "Lucro Bruto",
        value: fmtBRL(extra?.lucroBruto ?? extra?.financeMargin ?? 0),
        trend: {
          value: (extra?.lucroBruto ?? 0) >= 0 ? "Positivo" : "Negativo",
          isUp: (extra?.lucroBruto ?? 0) >= 0,
        },
        icon: Wallet,
        bg: (extra?.lucroBruto ?? 0) >= 0 ? "bg-success/10" : "bg-destructive/10",
        text: (extra?.lucroBruto ?? 0) >= 0 ? "text-success" : "text-destructive",
        categories: ["visao-geral", "financeiro"],
      },
      {
        label: "Pago em Compras",
        value: fmtBRL(extra?.comprasPaid ?? 0),
        trend: { value: "Saída", isUp: false },
        icon: ShoppingCart,
        bg: "bg-orange-500/10",
        text: "text-orange-500",
        categories: ["visao-geral", "financeiro"],
      },
      {
        label: "Pago em Despesas",
        value: fmtBRL(extra?.despesasPaid ?? 0),
        trend: { value: "Saída", isUp: false },
        icon: ArrowDownRight,
        bg: "bg-destructive/10",
        text: "text-destructive",
        categories: ["visao-geral", "financeiro"],
      },
    ];

    const visibleStats = allStats.filter(
      (s) => s.categories.includes(activeCategory) || activeCategory.startsWith(s.categories[1]),
    );

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {(visibleStats.length > 0 ? visibleStats : allStats).map((stat, i) => {
          // Decorative sparkline bars (deterministic per index)
          const bars = Array.from({ length: 12 }, (_, k) => 30 + ((i * 7 + k * 11) % 60));
          return (
            <div
              key={i}
              className="relative overflow-hidden bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`h-10 w-10 rounded-xl ${stat.bg} ${stat.text} flex items-center justify-center ring-1 ring-inset ring-current/10`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
                <div
                  className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${stat.trend.isUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                >
                  {stat.trend.isUp ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {stat.trend.value}
                </div>
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                {stat.label}
              </p>
              {loading ? (
                <div className="h-7 w-20 bg-muted animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl md:text-2xl font-black font-display tracking-tight text-foreground group-hover:text-primary transition-colors tabular-nums break-all leading-tight" title={String(stat.value)}>
                  {stat.value}
                </h3>

              )}
              {/* sparkline */}
              <div className="mt-4 flex items-end gap-[3px] h-8">
                {bars.map((h, k) => (
                  <div
                    key={k}
                    className={`flex-1 rounded-sm ${stat.text} opacity-30 group-hover:opacity-60 transition-opacity`}
                    style={{ height: `${h}%`, background: "currentColor" }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const shortcuts: { id: string; label: string; desc: string; icon: any; tone: string }[] = [
    { id: "fin-dre-gerencial", label: "DRE Gerencial", desc: "Resultado do período", icon: Wallet, tone: "bg-primary/10 text-primary" },
    { id: "vendas-relatorio", label: "Relatório de Vendas", desc: "Histórico detalhado", icon: ShoppingCart, tone: "bg-success/10 text-success" },
    { id: "prod-vendidos", label: "Produtos Vendidos", desc: "Mais vendidos", icon: Package, tone: "bg-info/10 text-info" },
    { id: "prod-resumo-estoque", label: "Resumo de Estoque", desc: "Inventário atual", icon: Archive, tone: "bg-warning/10 text-warning" },
    { id: "financeiro", label: "Saúde Financeira", desc: "Despesas e receitas", icon: DollarSign, tone: "bg-orange-500/10 text-orange-500" },
    { id: "clientes-ranking", label: "Top Clientes", desc: "Ranking por receita", icon: Users, tone: "bg-purple-500/10 text-purple-500" },
    { id: "vendedores", label: "Vendedores", desc: "Performance da equipe", icon: UserCheck, tone: "bg-pink-500/10 text-pink-500" },
    { id: "clientes-aniversario", label: "Aniversariantes", desc: "Engajamento mensal", icon: Sparkles, tone: "bg-amber-500/10 text-amber-600" },
  ];

  const renderShortcuts = () => (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-black text-foreground tracking-tight flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Atalhos
          </h3>
          <p className="text-xs font-bold text-muted-foreground">Acesse rapidamente os relatórios mais usados</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {shortcuts.map((s) => (
          <button
            key={s.id}
            onClick={() => onNavigate?.(s.id)}
            className="group text-left bg-muted/40 hover:bg-muted border border-border hover:border-primary/40 rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${s.tone}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="text-sm font-black text-foreground leading-tight group-hover:text-primary transition-colors">
              {s.label}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground mt-0.5">{s.desc}</div>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Abrir <ArrowUpRight className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderVisaoGeral = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {renderSummaryCards()}
      {renderShortcuts()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <SalesChart embedded />
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight">
                  Funil de Conversão
                </h3>
                <p className="text-sm font-bold text-muted-foreground">Eficiência por etapa</p>
              </div>
            </div>
            <div className="h-[300px]">
              {funnelData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted text-muted-foreground/60 flex items-center justify-center mb-3">
                    <PieChartIcon className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">
                    Sem dados de funil ainda
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie etapas no CRM para ver a conversão
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={funnelData}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 800, fill: "#94a3b8" }}
                    />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={32}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-black mb-6 text-foreground">Origem dos Leads</h3>
            {originData.length === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted text-muted-foreground/60 flex items-center justify-center mb-3">
                  <Users className="h-7 w-7" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">Nenhum lead registrado</p>
                <p className="text-xs text-muted-foreground mt-1">Aguardando primeiros contatos</p>
              </div>
            ) : (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={originData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {originData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {originData.map((origin, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: origin.color }}
                        />
                        {origin.name}
                      </span>
                      <span className="text-foreground">{origin.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-black mb-6 text-foreground">Top Agentes</h3>
            {topAgents.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted text-muted-foreground/60 flex items-center justify-center mb-3">
                  <UserCheck className="h-7 w-7" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">Sem ranking ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Adicione vendedores para ver o top
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topAgents.map((agent, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 -mx-2 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center font-black text-xs ring-2 ring-card shadow-sm ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-muted text-muted-foreground" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"}`}
                      >
                        {agent.avatar}
                      </div>
                      <span className="text-sm font-bold text-foreground">{agent.name}</span>
                    </div>
                    <span className="text-sm font-black text-foreground">{agent.revenue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGenericReport = (title: string, subtitle: string) => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border border-border rounded-2xl p-10 shadow-sm text-center">
        <div className="h-20 w-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
          <TrendingUp className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-black text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground font-bold max-w-lg mx-auto mb-8">{subtitle}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted rounded-2xl p-6 border border-border text-left">
              <div className="h-2 w-12 bg-primary/20 rounded-full mb-4" />
              <div className="h-4 w-24 bg-muted rounded-full mb-2" />
              <div className="h-6 w-full bg-muted rounded-full" />
            </div>
          ))}
        </div>

        <button className="h-12 px-8 rounded-xl bg-primary text-white font-black text-sm shadow-glow hover:scale-105 transition-transform">
          Gerar Relatório Detalhado
        </button>
      </div>
    </div>
  );

  const renderKpiGrid = (
    title: string,
    subtitle: string,
    items: { label: string; value: string; tone: "primary" | "success" | "warning" | "destructive" | "info" }[],
  ) => {
    const toneClass: Record<string, string> = {
      primary: "bg-primary/10 text-primary",
      success: "bg-success/10 text-success",
      warning: "bg-warning/10 text-warning",
      destructive: "bg-destructive/10 text-destructive",
      info: "bg-info/10 text-info",
    };
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h2 className="text-2xl font-black text-foreground">{title}</h2>
          <p className="text-sm font-bold text-muted-foreground">{subtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div
                className={`inline-flex h-8 px-3 items-center rounded-full text-[10px] font-black uppercase tracking-widest ${toneClass[it.tone]}`}
              >
                {it.label}
              </div>
              {loading ? (
                <div className="h-7 w-24 bg-muted animate-pulse rounded-md mt-3" />
              ) : (
                <h3 className="mt-3 text-xl md:text-2xl font-black font-display tracking-tight text-foreground tabular-nums break-all leading-tight" title={String(it.value)}>
                  {it.value}
                </h3>

              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const e = extra ?? {
    despesasOpen: 0, despesasOverdue: 0, despesasTotal: 0, despesasPaid: 0,
    receitasOpen: 0, receitasTotal: 0, receitasPaid: 0,
    caixaSaldo: 0, caixaIncome: 0, caixaExpense: 0,
    productsCount: 0, productsActive: 0, lowStock: 0, outOfStock: 0, stockValue: 0,
    salesCount: 0, salesToday: 0, salesWeek: 0, salesMonth: 0,
    revenueToday: 0, revenueWeek: 0,
    financeMargin: 0, financeOverdueCount: 0,
    comprasPaid: 0, comprasOpen: 0, lucroBruto: 0,
  };

  const getContent = () => {
    switch (activeCategory) {
      case "visao-geral":
        return renderVisaoGeral();
      case "clientes":
      case "clientes-indicacao":
      case "clientes-perfil":
      case "clientes-ranking":
      case "clientes-aniversario":
        return renderGenericReport(
          "Gestão de Clientes",
          "Análise de perfil, fidelidade e taxa de indicação da sua base.",
        );
      case "financeiro":
      case "fin-dre-gerencial":
      case "fin-relatorio":
      case "fin-relatorio-vendas":
      case "fin-relatorio-vendas-os":
      case "fin-multilojas":
      case "fin-dre-2":
      case "fin-relatorio-vendas-os-2":
      case "fin-formas-pagamento":
      case "fin-formas-pagamento-dia":
        return renderSaudeFinanceira();
      case "vendas-relatorio":
        return <SalesReportTable />;
      case "prod-vendidos":
      case "vendas-produtos":
        return <SoldProductsReport />;
      case "vendas":
      case "vendas-historico":
      case "vendas-projecoes":
        return renderKpiGrid(
          "Performance de Vendas",
          "Indicadores do mês atual sincronizados com o histórico de vendas.",
          [
            { label: "Faturamento (mês)", value: fmtBRL(stats.revenue || 0), tone: "primary" },
            { label: "Faturamento (7d)", value: fmtBRL(e.revenueWeek || 0), tone: "info" },
            { label: "Faturamento (hoje)", value: fmtBRL(e.revenueToday || 0), tone: "success" },
            { label: "Ticket médio", value: fmtBRL(stats.avgTicket || 0), tone: "info" },
            { label: "Vendas (mês)", value: String(e.salesMonth || 0), tone: "primary" },
            { label: "Vendas (7d)", value: String(e.salesWeek || 0), tone: "info" },
            { label: "Vendas (hoje)", value: String(e.salesToday || 0), tone: "success" },
            { label: "Conversão", value: `${(stats.conversion || 0).toFixed(1)}%`, tone: "success" },
            { label: "Leads no mês", value: String(stats.leads || 0), tone: "warning" },
            { label: "Total de vendas", value: String(e.salesCount || 0), tone: "primary" },
          ],
        );
      case "prod-resumo-estoque":
        return <StockSummaryReport />;
      case "produto":
      case "prod-detalhes-estoque":
        return renderKpiGrid(
          "Estoque & Produtos",
          "Sincronizado em tempo real com o cadastro de produtos.",
          [
            { label: "Produtos ativos", value: String(e.productsActive), tone: "primary" },
            { label: "Total cadastrado", value: String(e.productsCount), tone: "info" },
            { label: "Estoque baixo", value: String(e.lowStock), tone: "warning" },
            { label: "Sem estoque", value: String(e.outOfStock), tone: "destructive" },
            { label: "Valor de estoque", value: fmtBRL(e.stockValue), tone: "success" },
          ],
        );
      case "ordem-servico":
      case "os-dashboard":
        return renderGenericReport(
          "Ordens de Serviço",
          "Acompanhamento de prazos, produtividade e rentabilidade das OS.",
        );
      case "vendedores":
      case "vend-dash":
      case "vend-comissao":
        return renderGenericReport(
          "Ranking de Vendedores",
          "Comparativo de performance, comissões e conversão por agente.",
        );
      default:
        return renderGenericReport(
          activeCategory.replace(/-/g, " ").toUpperCase(),
          "Dashboard gerado automaticamente com base nos dados mais recentes do sistema.",
        );
    }
  };


  return <div className="space-y-8 pb-12">{getContent()}</div>;
};
