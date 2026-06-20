import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Users,
  Target,
  Activity,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/servicos/dashboard")({
  component: DashboardOSPage,
});

type OS = {
  id: string;
  status: string;
  total_cost: number | null;
  labor_cost: number | null;
  created_at: string;
  delivered_at: string | null;
  due_date: string | null;
  priority: string | null;
  equipment: string;
  technician_id: string | null;
};

type Tech = { id: string; name: string | null };

type Period = "7" | "30" | "90" | "all";

function DashboardOSPage() {
  const { orgId } = useOrg();
  const [os, setOs] = useState<OS[]>([]);
  const [techs, setTechs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30");

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("service_orders")
        .select(
          "id, status, total_cost, labor_cost, created_at, delivered_at, due_date, priority, equipment, technician_id",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1000);
      setOs((data as OS[]) ?? []);

      const techIds = Array.from(
        new Set(((data as OS[]) ?? []).map((o) => o.technician_id).filter(Boolean)),
      ) as string[];
      if (techIds.length) {
        const { data: tdata } = await supabase
          .from("technicians")
          .select("id, name")
          .in("id", techIds);
        const map: Record<string, string> = {};
        for (const t of ((tdata as Tech[]) ?? [])) map[t.id] = t.name || "—";
        setTechs(map);
      }
      setLoading(false);
    })();
  }, [orgId]);

  const filtered = useMemo(() => {
    if (period === "all") return os;
    const days = Number(period);
    const since = Date.now() - days * 86400000;
    return os.filter((o) => new Date(o.created_at).getTime() >= since);
  }, [os, period]);

  const k = useMemo(() => {
    const now = Date.now();
    const ABERTA = (s: string) => s !== "entregue" && s !== "concluida" && s !== "cancelada";
    const CONCLUIDA = (s: string) => s === "concluida" || s === "entregue";

    const abertas = filtered.filter((o) => ABERTA(o.status));
    const concluidas = filtered.filter((o) => CONCLUIDA(o.status));
    const atrasadas = abertas.filter((o) => o.due_date && new Date(o.due_date).getTime() < now);

    const tempoConclusao = concluidas
      .filter((o) => o.delivered_at)
      .map(
        (o) => (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 86400000,
      );
    const tempoMedio = tempoConclusao.length
      ? tempoConclusao.reduce((a, b) => a + b, 0) / tempoConclusao.length
      : 0;

    const receita = concluidas.reduce((a, b) => a + Number(b.total_cost ?? 0), 0);
    const ticketMedio = concluidas.length ? receita / concluidas.length : 0;
    const margemMaoObra = concluidas.reduce((a, b) => a + Number(b.labor_cost ?? 0), 0);

    // SLA - entregues dentro do prazo
    const comPrazo = concluidas.filter((o) => o.due_date && o.delivered_at);
    const noPrazo = comPrazo.filter(
      (o) => new Date(o.delivered_at!).getTime() <= new Date(o.due_date!).getTime(),
    );
    const slaPct = comPrazo.length ? (noPrazo.length / comPrazo.length) * 100 : 0;

    // Taxa de conclusão
    const conclusaoPct = filtered.length ? (concluidas.length / filtered.length) * 100 : 0;

    // Top equipamentos
    const eqCount: Record<string, number> = {};
    for (const o of filtered) {
      const key = (o.equipment || "Outros").toLowerCase().trim();
      eqCount[key] = (eqCount[key] || 0) + 1;
    }
    const topEq = Object.entries(eqCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Status distribution
    const statusCount: Record<string, number> = {};
    for (const o of filtered) statusCount[o.status] = (statusCount[o.status] || 0) + 1;

    // Prioridade
    const urgentes = abertas.filter((o) => o.priority === "alta" || o.priority === "urgente");

    // Ranking técnicos
    const techStats: Record<string, { total: number; concluidas: number; receita: number }> = {};
    for (const o of filtered) {
      if (!o.technician_id) continue;
      const t = (techStats[o.technician_id] ??= { total: 0, concluidas: 0, receita: 0 });
      t.total++;
      if (CONCLUIDA(o.status)) {
        t.concluidas++;
        t.receita += Number(o.total_cost ?? 0);
      }
    }
    const topTechs = Object.entries(techStats)
      .sort((a, b) => b[1].concluidas - a[1].concluidas)
      .slice(0, 5);

    // Tendência últimas 8 semanas (sempre baseado em os, não em filtered)
    const weeks: { label: string; abertas: number; concluidas: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = now - i * 7 * 86400000;
      const start = end - 7 * 86400000;
      const d = new Date(end);
      weeks.push({
        label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        abertas: os.filter((o) => {
          const c = new Date(o.created_at).getTime();
          return c >= start && c < end;
        }).length,
        concluidas: os.filter((o) => {
          if (!o.delivered_at) return false;
          const c = new Date(o.delivered_at).getTime();
          return c >= start && c < end && CONCLUIDA(o.status);
        }).length,
      });
    }

    return {
      total: filtered.length,
      abertas: abertas.length,
      concluidas: concluidas.length,
      atrasadas: atrasadas.length,
      urgentes: urgentes.length,
      tempoMedio,
      receita,
      ticketMedio,
      margemMaoObra,
      slaPct,
      conclusaoPct,
      topEq,
      statusCount,
      topTechs,
      weeks,
    };
  }, [filtered, os]);

  const periodLabel: Record<Period, string> = {
    "7": "7 dias",
    "30": "30 dias",
    "90": "90 dias",
    all: "Tudo",
  };

  const maxWeek = Math.max(1, ...k.weeks.flatMap((w) => [w.abertas, w.concluidas]));

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Dashboard OS" subtitle="Indicadores da assistência técnica" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Filtros + ação */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              {(["7", "30", "90", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
            <Link to="/servicos/nova">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Nova OS
              </Button>
            </Link>
          </div>

          {loading ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Carregando indicadores...
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={Wrench} label="OS abertas" value={k.abertas} color="warning" />
                <KpiCard
                  icon={CheckCircle2}
                  label="Concluídas"
                  value={k.concluidas}
                  color="success"
                />
                <KpiCard
                  icon={AlertCircle}
                  label="Atrasadas"
                  value={k.atrasadas}
                  color="destructive"
                />
                <KpiCard
                  icon={Clock}
                  label="Tempo médio (d)"
                  value={k.tempoMedio.toFixed(1)}
                  color="primary"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  icon={DollarSign}
                  label="Receita"
                  value={`R$ ${k.receita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  color="success"
                />
                <KpiCard
                  icon={TrendingUp}
                  label="Ticket médio"
                  value={`R$ ${k.ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  color="primary"
                />
                <KpiCard
                  icon={Target}
                  label="SLA no prazo"
                  value={`${k.slaPct.toFixed(0)}%`}
                  color={k.slaPct >= 80 ? "success" : k.slaPct >= 50 ? "warning" : "destructive"}
                />
                <KpiCard
                  icon={Activity}
                  label="Taxa de conclusão"
                  value={`${k.conclusaoPct.toFixed(0)}%`}
                  color="primary"
                />
              </div>

              {/* Tendência semanal */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-sm uppercase tracking-widest">
                    Tendência (8 semanas)
                  </h3>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-primary" /> Abertas
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-success" /> Concluídas
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-3 h-40">
                  {k.weeks.map((w, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-end justify-center gap-1 h-32">
                        <div
                          className="w-1/2 bg-primary rounded-t-md min-h-[2px] transition-all"
                          style={{ height: `${(w.abertas / maxWeek) * 100}%` }}
                          title={`Abertas: ${w.abertas}`}
                        />
                        <div
                          className="w-1/2 bg-success rounded-t-md min-h-[2px] transition-all"
                          style={{ height: `${(w.concluidas / maxWeek) * 100}%` }}
                          title={`Concluídas: ${w.concluidas}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold">{w.label}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5">
                  <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                    Top equipamentos
                  </h3>
                  {k.topEq.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="space-y-2">
                      {k.topEq.map(([nome, qtd]) => {
                        const max = k.topEq[0][1] || 1;
                        return (
                          <div key={nome}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="capitalize font-bold">{nome}</span>
                              <span className="text-muted-foreground">{qtd}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(qtd / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                    Status das OS
                  </h3>
                  {Object.keys(k.statusCount).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(k.statusCount)
                        .sort((a, b) => b[1] - a[1])
                        .map(([s, n]) => (
                          <div
                            key={s}
                            className="flex justify-between items-center px-3 py-2 rounded-lg border border-border"
                          >
                            <span className="text-xs capitalize font-bold">{s}</span>
                            <span className="text-lg font-black text-primary">{n}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Ranking técnicos */}
              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Ranking de técnicos
                </h3>
                {k.topTechs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma OS atribuída a técnico.</p>
                ) : (
                  <div className="space-y-2">
                    {k.topTechs.map(([id, stats], i) => (
                      <div
                        key={id}
                        className="flex items-center gap-3 p-2 rounded-lg border border-border"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-black grid place-items-center text-xs">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">
                            {techs[id] || "Técnico"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {stats.concluidas}/{stats.total} concluídas
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-success">
                            R$ {stats.receita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[10px] text-muted-foreground">receita</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {(k.urgentes > 0 || k.atrasadas > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {k.urgentes > 0 && (
                    <Card className="p-4 border-warning bg-warning/5">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        <p className="text-sm font-bold">
                          {k.urgentes} OS de prioridade alta/urgente em aberto
                        </p>
                      </div>
                    </Card>
                  )}
                  {k.atrasadas > 0 && (
                    <Card className="p-4 border-destructive bg-destructive/5">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-destructive" />
                        <p className="text-sm font-bold">
                          {k.atrasadas} OS atrasadas (prazo vencido)
                        </p>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "primary" | "success" | "warning" | "destructive";
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="text-xl font-black truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
