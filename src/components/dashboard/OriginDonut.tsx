import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function OriginDonut() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: leads } = await supabase
        .from("leads")
        .select("source")
        .eq("user_id", user.id);
      
      const counts: Record<string, number> = {};
      (leads || []).forEach(l => {
        const src = l.source || "Direto";
        counts[src] = (counts[src] || 0) + 1;
      });

      const colors: Record<string, string> = {
        "WhatsApp": "#25D366",
        "Instagram": "#E1306C",
        "Facebook": "#1877F2",
        "Google": "#4285F4",
        "Direto": "#64748b",
        "Site": "#8b5cf6"
      };

      const chartData = Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        color: colors[name] || "#" + Math.floor(Math.random()*16777215).toString(16)
      })).sort((a, b) => b.value - a.value);

      setData(chartData);
      setLoading(false);
    })();
  }, [user?.id]);

  const total = useMemo(() => data.reduce((a, b) => a + (b.value || 0), 0), [data]);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold mb-3">Origem dos leads</h3>
      {loading ? (
        <div className="h-[180px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/20" />
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                  {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="text-[11px] text-muted-foreground">Total</div>
                <div className="text-xl font-bold font-display">{total.toLocaleString("pt-BR")}</div>
              </div>
            </div>
          </div>
          <ul className="flex-1 space-y-2">
            {data.length > 0 ? data.map((d) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <li key={d.name} className="flex items-center gap-2.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1 text-foreground/80">{d.name}</span>
                  <span className="font-semibold">{pct}%</span>
                  <span className="text-muted-foreground">({d.value})</span>
                </li>
              );
            }) : (
              <li className="text-xs text-muted-foreground italic">Sem dados de origem</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
