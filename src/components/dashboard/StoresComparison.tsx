import { useEffect, useState } from "react";
import { Store, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrgs } from "@/lib/useUserOrgs";
import { startOfMonth } from "date-fns";

interface Row {
  id: string;
  name: string;
  total: number;
  count: number;
}

export function StoresComparison() {
  const { orgs } = useUserOrgs();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgs.length === 0) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const from = startOfMonth(new Date()).toISOString();
      const results = await Promise.all(
        orgs.map(async (o) => {
          const { data } = await supabase
            .from("sales_orders")
            .select("total_amount")
            .eq("organization_id", o.organization_id)
            .in("status", ["completed", "concluded", "paid"])
            .gte("created_at", from);
          const total = (data ?? []).reduce((s, r: any) => s + (Number(r.total_amount) || 0), 0);
          return {
            id: o.organization_id,
            name: o.organization?.name ?? "Loja",
            total,
            count: (data ?? []).length,
          };
        }),
      );
      if (cancel) return;
      setRows(results.sort((a, b) => b.total - a.total));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [orgs]);

  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Comparativo entre Lojas · Mês</h3>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} lojas</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sem lojas cadastradas.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => {
            const pct = (r.total / max) * 100;
            return (
              <li key={r.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    {i === 0 && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                    {r.name}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {r.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.count} vendas</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
