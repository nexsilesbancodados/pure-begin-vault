import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Award, Users, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/relatorios/comissoes")({
  component: ComissoesPage,
});

type Sale = {
  id: string;
  seller_id: string | null;
  total_amount: number | null;
  created_at: string;
  status: string | null;
};

type Employee = {
  id: string;
  name: string;
  position: string | null;
};

const LS_KEY = "conectaphone:comissao-percent";

function getPercent(): number {
  const raw = localStorage.getItem(LS_KEY);
  const v = raw ? parseFloat(raw) : NaN;
  return isNaN(v) ? 3 : v;
}

function setPercent(p: number) {
  localStorage.setItem(LS_KEY, String(p));
}

function ComissoesPage() {
  const { orgId } = useOrg();
  const [sales, setSales] = useState<Sale[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [percent, setPercentState] = useState(getPercent());
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("sales_orders")
        .select("id, seller_id, total_amount, created_at, status")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("employees").select("id, name, position").eq("organization_id", orgId),
    ]).then(([s, e]) => {
      setSales((s.data as Sale[]) ?? []);
      setEmployees((e.data as Employee[]) ?? []);
      setLoading(false);
    });
  }, [orgId]);

  const filteredSales = useMemo(() => {
    if (period === "all") return sales;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return sales.filter((s) => new Date(s.created_at).getTime() >= cutoff);
  }, [sales, period]);

  const byEmployee = useMemo(() => {
    const map: Record<string, { vendas: number; faturado: number }> = {};
    for (const s of filteredSales) {
      if (s.status === "cancelada" || !s.seller_id) continue;
      const key = s.seller_id;
      if (!map[key]) map[key] = { vendas: 0, faturado: 0 };
      map[key].vendas += 1;
      map[key].faturado += Number(s.total_amount ?? 0);
    }
    const rows = Object.entries(map).map(([id, v]) => {
      const emp = employees.find((e) => e.id === id);
      return {
        id,
        name: emp?.name ?? "Sem vendedor",
        position: emp?.position ?? "—",
        ...v,
        comissao: (v.faturado * percent) / 100,
      };
    });
    return rows.sort((a, b) => b.faturado - a.faturado);
  }, [filteredSales, employees, percent]);

  const totals = useMemo(() => {
    const t = byEmployee.reduce(
      (acc, r) => ({
        vendas: acc.vendas + r.vendas,
        faturado: acc.faturado + r.faturado,
        comissao: acc.comissao + r.comissao,
      }),
      { vendas: 0, faturado: 0, comissao: 0 },
    );
    return t;
  }, [byEmployee]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Comissões" subtitle="Relatório por vendedor" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="percent">% Comissão</Label>
                <Input
                  id="percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={percent}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setPercentState(v);
                    setPercent(v);
                  }}
                />
              </div>
              <div>
                <Label>Período</Label>
                <div className="flex gap-2 mt-1">
                  {(["7d", "30d", "90d", "all"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                        period === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:border-primary/40"
                      }`}
                    >
                      {p === "all"
                        ? "Tudo"
                        : p === "7d"
                          ? "7 dias"
                          : p === "30d"
                            ? "30 dias"
                            : "90 dias"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredSales.length} vendas no período · {byEmployee.length} vendedor(es)
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              icon={DollarSign}
              label="Faturado"
              value={`R$ ${totals.faturado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              color="success"
            />
            <Kpi
              icon={Award}
              label="Comissão total"
              value={`R$ ${totals.comissao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              color="primary"
            />
            <Kpi icon={TrendingUp} label="Vendas" value={totals.vendas} color="primary" />
            <Kpi icon={Users} label="Vendedores ativos" value={byEmployee.length} color="primary" />
          </div>

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3">Ranking</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : byEmployee.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma venda com vendedor identificado no período.
              </p>
            ) : (
              <div className="space-y-2">
                {byEmployee.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          i === 0
                            ? "bg-amber-500/15 text-amber-600"
                            : i === 1
                              ? "bg-slate-400/15 text-slate-600"
                              : i === 2
                                ? "bg-orange-700/15 text-orange-700"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.vendas} venda{r.vendas !== 1 ? "s" : ""} · {r.position}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        R$ {r.faturado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-base font-black text-primary">
                        R$ {r.comissao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "primary" | "success";
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
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
