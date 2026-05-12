import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Wrench, Clock, CheckCircle2, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
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

function DashboardOSPage() {
  const { orgId } = useOrg();
  const [os, setOs] = useState<OS[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from("service_orders")
      .select("id, status, total_cost, labor_cost, created_at, delivered_at, due_date, priority, equipment, technician_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setOs((data as OS[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const k = useMemo(() => {
    const now = Date.now();
    const ABERTA = (s: string) => s !== "entregue" && s !== "concluida" && s !== "cancelada";
    const CONCLUIDA = (s: string) => s === "concluida" || s === "entregue";

    const abertas = os.filter((o) => ABERTA(o.status));
    const concluidas = os.filter((o) => CONCLUIDA(o.status));
    const atrasadas = abertas.filter(
      (o) => o.due_date && new Date(o.due_date).getTime() < now
    );

    const tempoConclusao = concluidas
      .filter((o) => o.delivered_at)
      .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 86400000);
    const tempoMedio = tempoConclusao.length
      ? tempoConclusao.reduce((a, b) => a + b, 0) / tempoConclusao.length
      : 0;

    const receita = concluidas.reduce((a, b) => a + Number(b.total_cost ?? 0), 0);
    const ticketMedio = concluidas.length ? receita / concluidas.length : 0;
    const margemMaoObra = concluidas.reduce((a, b) => a + Number(b.labor_cost ?? 0), 0);

    // Top equipamentos
    const eqCount: Record<string, number> = {};
    for (const o of os) {
      const key = (o.equipment || "Outros").toLowerCase().trim();
      eqCount[key] = (eqCount[key] || 0) + 1;
    }
    const topEq = Object.entries(eqCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Status distribution
    const statusCount: Record<string, number> = {};
    for (const o of os) statusCount[o.status] = (statusCount[o.status] || 0) + 1;

    // Prioridade
    const urgentes = abertas.filter((o) => o.priority === "alta" || o.priority === "urgente");

    return {
      total: os.length,
      abertas: abertas.length,
      concluidas: concluidas.length,
      atrasadas: atrasadas.length,
      urgentes: urgentes.length,
      tempoMedio,
      receita,
      ticketMedio,
      margemMaoObra,
      topEq,
      statusCount,
    };
  }, [os]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Dashboard OS" subtitle="Indicadores da assistência técnica" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Carregando indicadores...
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={Wrench} label="OS abertas" value={k.abertas} color="warning" />
                <KpiCard icon={CheckCircle2} label="Concluídas" value={k.concluidas} color="success" />
                <KpiCard icon={AlertCircle} label="Atrasadas" value={k.atrasadas} color="destructive" />
                <KpiCard icon={Clock} label="Tempo médio (d)" value={k.tempoMedio.toFixed(1)} color="primary" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <KpiCard
                  icon={DollarSign}
                  label="Receita total"
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
                  icon={Wrench}
                  label="Mão de obra (concluídas)"
                  value={`R$ ${k.margemMaoObra.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  color="primary"
                />
              </div>

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

              {k.urgentes > 0 && (
                <Card className="p-4 border-warning bg-warning/5">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <p className="text-sm font-bold">
                      {k.urgentes} {k.urgentes === 1 ? "OS de prioridade alta/urgente" : "OS de prioridade alta/urgente"} ainda em aberto
                    </p>
                  </div>
                </Card>
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
