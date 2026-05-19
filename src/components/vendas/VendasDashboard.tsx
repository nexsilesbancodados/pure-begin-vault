import { Button } from "@/components/ui/button";
import {
  Plus,
  ShoppingCart,
  History,
  FileText,
  ArrowRight,
  Upload,
  TrendingUp,
  Receipt,
  DollarSign,
  Activity,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ImportModal } from "@/components/import/ImportModal";
import { useNavigate } from "@tanstack/react-router";
import { SalesHistory } from "./SalesHistory";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

type Stat = {
  todayRevenue: number;
  todayCount: number;
  monthRevenue: number;
  avgTicket: number;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Vendas() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<Stat>({
    todayRevenue: 0,
    todayCount: 0,
    monthRevenue: 0,
    avgTicket: 0,
  });
  const navigate = useNavigate();
  const { orgId } = useOrg();

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
        setStats({
          todayRevenue,
          todayCount: todayRows.length,
          monthRevenue,
          avgTicket: rows.length ? monthRevenue / rows.length : 0,
        });
      });
  }, [orgId, refreshKey]);

  const kpis = useMemo(
    () => [
      {
        label: "Vendas hoje",
        value: brl(stats.todayRevenue),
        sub: `${stats.todayCount} pedidos`,
        icon: DollarSign,
        accent: "from-primary/20 to-primary/5 text-primary",
      },
      {
        label: "Receita do mês",
        value: brl(stats.monthRevenue),
        sub: "Acumulado",
        icon: TrendingUp,
        accent: "from-success/20 to-success/5 text-success",
      },
      {
        label: "Ticket médio",
        value: brl(stats.avgTicket),
        sub: "30 dias",
        icon: Receipt,
        accent: "from-info/20 to-info/5 text-info",
      },
      {
        label: "Status caixa",
        value: stats.todayCount > 0 ? "Ativo" : "Sem vendas",
        sub: "Tempo real",
        icon: Activity,
        accent: "from-violet-500/20 to-violet-500/5 text-violet-500",
      },
    ],
    [stats],
  );

  const shortcuts = [
    {
      title: "PDV",
      desc: "Frente de caixa rápida",
      icon: ShoppingCart,
      to: "/pdv",
    },
    {
      title: "Histórico",
      desc: "Auditoria completa",
      icon: History,
      to: "/vendas/historico",
    },
    {
      title: "Orçamentos",
      desc: "Propostas comerciais",
      icon: FileText,
      to: "/vendas/orcamentos",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => setRefreshKey((p) => p + 1)}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Painel de Vendas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Operação comercial em tempo real — KPIs, atalhos e histórico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2 h-11 px-5 border-primary/20 hover:bg-primary/5 text-primary font-bold"
          >
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button
            onClick={() => navigate({ to: "/pdv" })}
            className="gap-2 h-11 px-6 bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/30 text-primary-foreground font-bold hover:shadow-primary/40 transition-all"
          >
            <Plus className="h-4 w-4" /> Nova Venda
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className={`relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br ${k.accent.replace(/text-\S+/, "")} p-5 group hover:border-primary/40 transition-all`}
            >
              <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-gradient-to-br from-white/40 to-transparent blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {k.label}
                  </p>
                  <div className="text-xl md:text-2xl font-black mt-1 truncate">{k.value}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">{k.sub}</p>
                </div>
                <div
                  className={`h-10 w-10 rounded-xl bg-card/80 backdrop-blur flex items-center justify-center shadow-sm ${k.accent.match(/text-\S+/)?.[0] ?? ""}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Atalhos */}
      <div className="grid gap-4 md:grid-cols-3">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.to}
              onClick={() => navigate({ to: s.to })}
              className="group text-left relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 hover:border-primary/50 hover:bg-card transition-all shadow-sm hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/15 transition-all" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base group-hover:text-primary transition-colors">
                    {s.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Histórico */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Histórico Recente</h2>
            <p className="text-xs text-muted-foreground">Últimas transações em tempo real.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/vendas/historico" })}
            className="text-primary font-bold hover:bg-primary/5"
          >
            Ver tudo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="rounded-3xl border border-border/40 bg-card/30 p-2 backdrop-blur-sm shadow-xl shadow-black/5">
          <SalesHistory key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
