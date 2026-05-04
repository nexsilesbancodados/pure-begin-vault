import React from "react";
import { 
  ArrowUpRight, ArrowDownRight, DollarSign, Users, Target, TrendingUp, 
  Sparkles, Calendar, Download, Filter, Zap, Lightbulb, AlertCircle, 
  MoreHorizontal, UserCheck, Home, User, Package, ShoppingCart, 
  Hammer, Archive, FileText, List, ChevronDown, ChevronRight, PieChart as PieChartIcon
} from "lucide-react";
import { 
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis 
} from "recharts";
import { SalesChart } from "@/components/dashboard/SalesChart";

interface DashboardContentProps {
  activeCategory: string;
  stats: any;
  funnelData: any[];
  originData: any[];
  topAgents: any[];
  funnelPercentages: string[];
  loading: boolean;
}

export const DashboardContent: React.FC<DashboardContentProps> = ({
  activeCategory,
  stats,
  funnelData,
  originData,
  topAgents,
  funnelPercentages,
  loading
}) => {
  const renderSummaryCards = () => {
    const allStats = [
      { label: "Faturamento", value: stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), trend: stats.revenueTrend, icon: DollarSign, bg: "bg-primary/10", text: "text-primary", categories: ['visao-geral', 'financeiro', 'vendas', 'vendedores'] },
      { label: "Leads Totais", value: stats.leads.toString(), trend: stats.leadsTrend, icon: Users, bg: "bg-blue-500/10", text: "text-blue-500", categories: ['visao-geral', 'clientes', 'vendas'] },
      { label: "Conversão", value: stats.conversion.toFixed(1) + "%", trend: stats.conversionTrend, icon: Target, bg: "bg-success/10", text: "text-success", categories: ['visao-geral', 'vendas', 'vendedores'] },
      { label: "Ticket Médio", value: stats.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), trend: stats.avgTicketTrend, icon: TrendingUp, bg: "bg-warning/10", text: "text-warning", categories: ['visao-geral', 'vendas', 'financeiro'] },
    ];

    const visibleStats = allStats.filter(s => s.categories.includes(activeCategory) || activeCategory.startsWith(s.categories[1]));

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(visibleStats.length > 0 ? visibleStats : allStats).map((stat, i) => (
          <div key={i} className="bg-white border border-border rounded-2xl p-5 shadow-sm hover:border-primary/20 transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div className={`h-11 w-11 rounded-xl ${stat.bg} ${stat.text} flex items-center justify-center`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${stat.trend.isUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {stat.trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.trend.value}
              </div>
            </div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded-lg" />
            ) : (
              <h3 className="text-2xl font-black font-display tracking-tight group-hover:text-primary transition-colors">{stat.value}</h3>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderVisaoGeral = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {renderSummaryCards()}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Desempenho de Vendas</h3>
                <p className="text-sm font-bold text-slate-400">Faturamento consolidado</p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                +12.5% Crescimento
              </div>
            </div>
            <div className="h-[300px]">
              <SalesChart />
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Funil de Conversão</h3>
                <p className="text-sm font-bold text-slate-400">Eficiência por etapa</p>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={funnelData}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: "#94a3b8" }} />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={32}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-black mb-6">Origem dos Leads</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={originData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {originData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-4">
              {originData.map((origin, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground">{origin.name}</span>
                  <span>{origin.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-black mb-6">Top Agentes</h3>
            <div className="space-y-4">
              {topAgents.map((agent, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{agent.avatar}</div>
                    <span className="text-sm font-bold">{agent.name}</span>
                  </div>
                  <span className="text-sm font-black">{agent.revenue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGenericReport = (title: string, subtitle: string) => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-border rounded-[2.5rem] p-10 shadow-sm text-center">
        <div className="h-20 w-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
          <TrendingUp className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">{title}</h2>
        <p className="text-slate-500 font-bold max-w-lg mx-auto mb-8">{subtitle}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left">
              <div className="h-2 w-12 bg-primary/20 rounded-full mb-4" />
              <div className="h-4 w-24 bg-slate-200 rounded-full mb-2" />
              <div className="h-6 w-full bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
        
        <button className="h-12 px-8 rounded-xl bg-primary text-white font-black text-sm shadow-glow hover:scale-105 transition-transform">
          Gerar Relatório Detalhado
        </button>
      </div>
    </div>
  );

  const getContent = () => {
    switch (activeCategory) {
      case 'visao-geral': return renderVisaoGeral();
      case 'clientes': 
      case 'clientes-indicacao':
      case 'clientes-perfil':
      case 'clientes-ranking':
      case 'clientes-aniversario':
        return renderGenericReport("Gestão de Clientes", "Análise de perfil, fidelidade e taxa de indicação da sua base.");
      case 'financeiro': 
      case 'fin-dre-gerencial':
      case 'fin-relatorio':
      case 'fin-formas-pagamento':
        return renderGenericReport("Saúde Financeira", "Relatórios de DRE, fluxo de caixa e formas de pagamento mais utilizadas.");
      case 'vendas': 
      case 'vendas-relatorio':
      case 'vendas-historico':
        return renderGenericReport("Performance de Vendas", "Conversão de leads, metas atingidas e desempenho por produto.");
      case 'ordem-servico': 
      case 'os-dashboard':
        return renderGenericReport("Ordens de Serviço", "Acompanhamento de prazos, produtividade e rentabilidade das OS.");
      case 'vendedores': 
      case 'vend-dash':
      case 'vend-comissao':
        return renderGenericReport("Ranking de Vendedores", "Comparativo de performance, comissões e conversão por agente.");
      default: return renderGenericReport(
        activeCategory.replace(/-/g, ' ').toUpperCase(), 
        "Dashboard gerado automaticamente com base nos dados mais recentes do sistema."
      );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {getContent()}
    </div>
  );
};
