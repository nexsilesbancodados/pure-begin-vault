import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MonthData {
  label: string;
  value: number;
  isCurrent: boolean;
}

export function MonthComparison() {
  const { user } = useAuth();
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const { data: sales } = await supabase
        .from("sales_orders")
        .select("total_amount, created_at")
        .eq("user_id", user.id)
        .eq("status", "concluded")
        .gte("created_at", sixMonthsAgo.toISOString());

      const now = new Date();
      const buckets: MonthData[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          value: 0,
          isCurrent: i === 0,
        });
      }
      (sales || []).forEach((s: any) => {
        const d = new Date(s.created_at);
        const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        const idx = 5 - monthsDiff;
        if (idx >= 0 && idx < 6) buckets[idx].value += Number(s.total_amount || 0);
      });

      setData(buckets);
      setLoading(false);
    })();
  }, [user?.id]);

  const current = data[5]?.value || 0;
  const previous = data[4]?.value || 0;
  const diff = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const positive = diff >= 0;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Comparativo 6 meses
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento mensal</p>
        </div>
        {!loading && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(diff).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="h-[180px] -ml-2">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/20" />
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.2 330)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Faturamento"]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.isCurrent ? "url(#barGradActive)" : "url(#barGrad)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}