import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Users, DollarSign, Target, Clock, Loader2, Repeat, Activity } from "lucide-react";

export const Route = createFileRoute("/relatorios/crescimento")({
  head: () => ({
    meta: [
      { title: "Crescimento — ConectaCRM" },
      { name: "description", content: "CAC, LTV, conversão por etapa e tempo médio de resposta" },
    ],
  }),
  component: GrowthReports,
});

type Stats = {
  totalLeads: number;
  paying: number;
  revenue30: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  avgResponseMin: number;
  conversionRate: number;
  byStage: { name: string; count: number; pct: number; color?: string }[];
  monthlyChurn: number;
};

const fmtCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function GrowthReports() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [marketingSpend, setMarketingSpend] = useState(() => Number(localStorage.getItem("marketing_spend_30") ?? "1000"));

  useEffect(() => {
    if (!profile?.organization_id || !user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();

        // Leads
        const { data: leads } = await supabase
          .from("leads")
          .select("id, status, stage_id, deal_value, created_at")
          .eq("organization_id", profile.organization_id);

        const totalLeads = leads?.length ?? 0;
        const won = leads?.filter((l: any) => l.status === "won") ?? [];
        const paying = won.length;
        const ltv = paying > 0 ? won.reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0) / paying : 0;

        // New leads in 30d
        const newIn30 = leads?.filter((l: any) => l.created_at >= since).length ?? 0;
        const cac = newIn30 > 0 ? marketingSpend / newIn30 : 0;

        // Revenue 30d
        const { data: orders } = await supabase
          .from("sales_orders")
          .select("total_amount, created_at, status")
          .eq("organization_id", profile.organization_id)
          .gte("created_at", since);
        const revenue30 = (orders ?? []).reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);

        // Stages
        const { data: stages } = await supabase
          .from("funnel_stages")
          .select("id, name, color, order")
          .eq("organization_id", profile.organization_id)
          .order("order");
        const byStage = (stages ?? []).map((s: any) => {
          const count = leads?.filter((l: any) => l.stage_id === s.id).length ?? 0;
          return { name: s.name, count, pct: totalLeads > 0 ? count / totalLeads : 0, color: s.color };
        });

        // Avg response time (1ª inbound → 1ª outbound) por lead
        const { data: msgs } = await supabase
          .from("messages")
          .select("lead_id, direction, created_at")
          .eq("organization_id", profile.organization_id)
          .gte("created_at", since)
          .order("created_at");
        const byLead = new Map<string, any[]>();
        (msgs ?? []).forEach((m: any) => {
          if (!m.lead_id) return;
          if (!byLead.has(m.lead_id)) byLead.set(m.lead_id, []);
          byLead.get(m.lead_id)!.push(m);
        });
        const respTimes: number[] = [];
        byLead.forEach((ms) => {
          const inbound = ms.find((m: any) => m.direction === "inbound");
          const outbound = ms.find((m: any) => m.direction === "outbound" && new Date(m.created_at) > new Date(inbound?.created_at ?? 0));
          if (inbound && outbound) respTimes.push((+new Date(outbound.created_at) - +new Date(inbound.created_at)) / 60000);
        });
        const avgResponseMin = respTimes.length ? respTimes.reduce((a, b) => a + b, 0) / respTimes.length : 0;

        const conversionRate = totalLeads > 0 ? paying / totalLeads : 0;
        const monthlyChurn = 0; // sem dados de churn ainda

        setStats({
          totalLeads, paying, revenue30, cac, ltv,
          ltvCacRatio: cac > 0 ? ltv / cac : 0,
          avgResponseMin, conversionRate, byStage, monthlyChurn,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, profile?.organization_id, marketingSpend]);

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col"><Topbar title="Crescimento" />
          <div className="flex-1 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        </div>
      </div>
    );
  }

  const Kpi = ({ icon: Icon, label, value, sub, tone = "primary" }: any) => (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">{label}</div>
          <div className="text-3xl font-bold mt-2 font-display">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className={`h-10 w-10 rounded-xl grid place-items-center bg-${tone}/10 text-${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <Topbar title="Crescimento — CAC, LTV & conversão" subtitle="Métricas que importam pra decidir investir mais ou menos" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input para CAC */}
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 flex-wrap">
            <div className="text-sm font-bold">Investimento em marketing nos últimos 30 dias:</div>
            <input
              type="number"
              value={marketingSpend}
              onChange={(e) => { const v = Number(e.target.value); setMarketingSpend(v); localStorage.setItem("marketing_spend_30", String(v)); }}
              className="h-9 w-32 px-3 rounded-lg border border-border bg-background text-sm"
            />
            <div className="text-xs text-muted-foreground">Usado para calcular o CAC</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={DollarSign} label="Receita 30d" value={fmtCurrency(stats.revenue30)} tone="success" />
            <Kpi icon={Users} label="CAC" value={fmtCurrency(stats.cac)} sub={`${stats.totalLeads} leads totais`} tone="info" />
            <Kpi icon={TrendingUp} label="LTV (ticket médio cliente)" value={fmtCurrency(stats.ltv)} sub={`${stats.paying} clientes pagantes`} tone="primary" />
            <Kpi
              icon={Target}
              label="LTV ÷ CAC"
              value={stats.ltvCacRatio.toFixed(2) + "x"}
              sub={stats.ltvCacRatio >= 3 ? "✅ Saudável (>3)" : stats.ltvCacRatio > 0 ? "⚠️ Abaixo do ideal" : "—"}
              tone={stats.ltvCacRatio >= 3 ? "success" : "warning"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Kpi icon={Activity} label="Taxa de conversão" value={fmtPct(stats.conversionRate)} sub={`${stats.paying} de ${stats.totalLeads}`} tone="success" />
            <Kpi
              icon={Clock}
              label="Tempo médio de 1ª resposta"
              value={stats.avgResponseMin > 60 ? `${(stats.avgResponseMin / 60).toFixed(1)}h` : `${stats.avgResponseMin.toFixed(0)} min`}
              sub={stats.avgResponseMin <= 5 ? "✅ Excelente" : stats.avgResponseMin <= 30 ? "👍 Bom" : "⚠️ Lento — perde lead"}
              tone="warning"
            />
            <Kpi icon={Repeat} label="Churn mensal" value={fmtPct(stats.monthlyChurn)} sub="Em breve com pagamentos" tone="destructive" />
          </div>

          {/* Funil por etapa */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">Conversão por etapa do funil</h2>
            <div className="space-y-3">
              {stats.byStage.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color || "#3b82f6" }} />
                      {s.name}
                    </span>
                    <span className="text-muted-foreground">{s.count} leads · {fmtPct(s.pct)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.pct * 100}%`, background: s.color || "#3b82f6" }} />
                  </div>
                </div>
              ))}
              {stats.byStage.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">Configure as etapas do funil para ver a conversão</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
