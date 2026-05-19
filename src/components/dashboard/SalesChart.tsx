import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { cn } from "@/lib/utils";

type Period = "month" | "7d" | "30d" | "90d";

const PERIOD_LABEL: Record<Period, string> = {
  month: "Este mês",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

interface SalesChartProps {
  /** When true, renders without its own card chrome (parent provides it). */
  embedded?: boolean;
}

export function SalesChart({ embedded = false }: SalesChartProps) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sales, setSales] = useState<{ total_amount: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    if (!user?.id || !orgId) {
      setSales([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales_orders")
        .select("total_amount, created_at")
        .eq("status", "concluded")
        .eq("organization_id", orgId);
      if (cancelled) return;
      setSales((data as any) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, orgId]);

  const { chartData, total, prevTotal, growthPct, avgPerDay, peak } = useMemo(() => {
    const now = new Date();
    let buckets: { day: string; value: number; date: Date }[] = [];
    let prevStart: Date;
    let prevEnd: Date;
    let curStart: Date;

    if (period === "month") {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      buckets = Array.from({ length: daysInMonth }, (_, i) => ({
        day: `${i + 1}`,
        value: 0,
        date: new Date(now.getFullYear(), now.getMonth(), i + 1),
      }));
      curStart = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = curStart;
    } else {
      const ndays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      for (let i = ndays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        buckets.push({ day: d.toISOString().slice(5, 10), value: 0, date: d });
      }
      curStart = buckets[0].date;
      prevEnd = curStart;
      prevStart = new Date(curStart);
      prevStart.setDate(prevStart.getDate() - ndays);
    }

    let cur = 0;
    let prev = 0;
    sales.forEach((sale) => {
      const date = new Date(sale.created_at);
      const amt = Number(sale.total_amount) || 0;
      const target = buckets.find(
        (d) => date >= d.date && date < new Date(d.date.getTime() + 86400000),
      );
      if (target) {
        target.value += amt;
        cur += amt;
      } else if (date >= prevStart && date < prevEnd) {
        prev += amt;
      }
    });

    const days = buckets.length || 1;
    const avg = cur / days;
    const peakValue = buckets.reduce((m, b) => Math.max(m, b.value), 0);
    const growth = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

    return {
      chartData: buckets,
      total: cur,
      prevTotal: prev,
      growthPct: growth,
      avgPerDay: avg,
      peak: peakValue,
    };
  }, [sales, period]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtFull = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const trendTone =
    growthPct > 0
      ? "text-success bg-success/10 border-success/20"
      : growthPct < 0
        ? "text-destructive bg-destructive/10 border-destructive/20"
        : "text-muted-foreground bg-muted border-border";
  const TrendIcon = growthPct > 0 ? TrendingUp : growthPct < 0 ? TrendingDown : Minus;

  const wrapperClass = embedded
    ? "flex flex-col gap-5"
    : "rounded-2xl bg-card border border-border p-6 shadow-card flex flex-col gap-5";

  const isEmpty = !loading && total === 0 && prevTotal === 0;

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg leading-tight">Desempenho de vendas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {PERIOD_LABEL[period]} · faturamento concluído
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!loading && !isEmpty && (
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border",
                trendTone,
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {growthPct > 0 ? "+" : ""}
              {growthPct.toFixed(1)}%
            </span>
          )}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="text-xs font-medium border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted bg-card cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {Object.entries(PERIOD_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total" value={loading ? null : fmt(total)} big />
        <Stat label="Média/dia" value={loading ? null : fmt(avgPerDay)} />
        <Stat label="Pico do período" value={loading ? null : fmt(peak)} />
      </div>

      {/* Chart / empty */}
      <div className="h-[220px] -mx-2">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : isEmpty ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center px-6">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold">Sem vendas no período</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Assim que registrar vendas concluídas, a curva de faturamento aparece aqui.
            </p>
          </div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                width={50}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                }}
                formatter={(v: number) => [fmtFull(v), "Vendas"]}
                labelFormatter={(l) => `Dia ${l}`}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#salesGrad)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-card)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string | null; big?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      {value === null ? (
        <div className={cn("bg-muted animate-pulse rounded-md", big ? "h-7 w-28" : "h-5 w-20")} />
      ) : (
        <div
          className={cn(
            "font-bold font-display tabular-nums tracking-tight",
            big ? "text-2xl" : "text-base text-muted-foreground",
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}
