import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function SalesChart() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("total_amount, created_at")
        .eq("user_id", user.id)
        .eq("status", "concluded");
      setSales(data || []);
      setLoading(false);
    })();
  }, [user?.id]);

  const [period, setPeriod] = useState<"month" | "7d" | "30d" | "90d">("month");

  const chartData = useMemo(() => {
    const now = new Date();
    if (period === "month") {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const data = Array.from({ length: daysInMonth }, (_, i) => ({ day: `${i + 1}`, value: 0 }));
      sales.forEach((sale) => {
        const date = new Date(sale.created_at!);
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
          const dayIdx = date.getDate() - 1;
          if (data[dayIdx]) data[dayIdx].value += (sale.total_amount || 0);
        }
      });
      return data;
    }
    const ndays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const data: { day: string; value: number; date: Date }[] = [];
    for (let i = ndays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      data.push({ day: d.toISOString().slice(5, 10), value: 0, date: d });
    }
    sales.forEach((sale) => {
      const date = new Date(sale.created_at!);
      const target = data.find((d) => date >= d.date && date < new Date(d.date.getTime() + 86400000));
      if (target) target.value += (sale.total_amount || 0);
    });
    return data;
  }, [sales, period]);

  const monthTotal = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const periodLabel = period === "month" ? "Este mês" : period === "7d" ? "7 dias" : period === "30d" ? "30 dias" : "90 dias";

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card min-h-[340px] flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-[15px] font-semibold">Desempenho de vendas</h3>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted bg-card cursor-pointer"
        >
          <option value="month">Este mês</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        {loading ? (
          <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
        ) : (
          <span className="text-[26px] font-bold font-display tracking-tight">
            {monthTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        )}
      </div>
      <div className="flex-1 h-[200px] -ml-2 mt-auto">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
          </div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--color-muted-foreground)" hide />
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Vendas"]}
              />
              <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
