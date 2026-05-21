import { useEffect, useState } from "react";
import { Trophy, Medal, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth } from "date-fns";

interface Row {
  user_id: string;
  name: string;
  total: number;
  count: number;
  isMe: boolean;
}

export function SellerRanking({ limit = 5, scopeToMe = false }: { limit?: number; scopeToMe?: boolean }) {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const from = startOfMonth(new Date()).toISOString();
      const { data: sales } = await supabase
        .from("sales_orders")
        .select("seller_id, total_amount")
        .eq("organization_id", orgId)
        .in("status", ["completed", "concluded", "paid"])
        .gte("created_at", from);

      const map = new Map<string, { total: number; count: number }>();
      for (const s of sales ?? []) {
        const id = (s as any).seller_id;
        if (!id) continue;
        const cur = map.get(id) ?? { total: 0, count: 0 };
        cur.total += Number((s as any).total_amount) || 0;
        cur.count += 1;
        map.set(id, cur);
      }

      const ids = [...map.keys()];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, display_name, email")
          .in("id", ids);
        names = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.id, p.display_name || p.nome || p.email || "Vendedor"]),
        );
      }

      const all = [...map.entries()]
        .map(([uid, v]) => ({
          user_id: uid,
          name: names[uid] ?? "Vendedor",
          total: v.total,
          count: v.count,
          isMe: uid === user?.id,
        }))
        .sort((a, b) => b.total - a.total);

      if (cancel) return;
      setRows(scopeToMe ? all.filter((r) => r.isMe).concat(all.filter((r) => !r.isMe)).slice(0, limit) : all.slice(0, limit));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [orgId, user?.id, limit, scopeToMe]);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold">Ranking de Vendedores · Mês</h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma venda este mês ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center justify-between p-3 rounded-xl border transition ${
                r.isMe ? "bg-primary/5 border-primary/30" : "bg-background border-border"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full grid place-items-center bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 font-bold text-sm shrink-0">
                  {i === 0 ? <Crown className="h-4 w-4" /> : i === 1 ? <Medal className="h-4 w-4" /> : i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {r.name} {r.isMe && <span className="text-xs text-primary">(você)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.count} vendas</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">
                  {r.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
