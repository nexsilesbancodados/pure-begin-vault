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

  const chartData = useMemo(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const data = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      value: 0
    }));

    sales.forEach(sale => {
      const date = new Date(sale.created_at!);
      if (date.getMonth() === new Date().getMonth()) {
        const dayIdx = date.getDate() - 1;
        if (data[dayIdx]) data[dayIdx].value += (sale.total_amount || 0);
      }
    });

    return data;
  }, [sales]);

  const monthTotal = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card min-h-[340px] flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-[15px] font-semibold">Desempenho de vendas</h3>
        </div>
        <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors">
          Este mês <ChevronDown className="h-3.5 w-3.5" />
        </button>
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
