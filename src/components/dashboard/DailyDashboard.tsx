import { useEffect, useState } from "react";
import { Banknote, ShoppingBasket, Receipt, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Stats = {
  dayRevenue: number;
  dayCount: number;
  dayProfit: number;
  dayTicket: number;
  dayProfitPct: number;
  dayAvgProfit: number;
  dayExpenses: number;
  monthRevenue: number;
  monthCount: number;
  monthProfit: number;
};

const EMPTY: Stats = {
  dayRevenue: 0,
  dayCount: 0,
  dayProfit: 0,
  dayTicket: 0,
  dayProfitPct: 0,
  dayAvgProfit: 0,
  dayExpenses: 0,
  monthRevenue: 0,
  monthCount: 0,
  monthProfit: 0,
};

export function DailyDashboard() {
  const { orgId } = useOrg();
  const [s, setS] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancel = false;

    const load = async () => {
      setLoading(true);
      const now = new Date();
      const dayStart = startOfDay(now).toISOString();
      const dayEnd = endOfDay(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      const [salesRes, expensesRes] = await Promise.all([
        supabase
          .from("sales_orders")
          .select("id, total_amount, created_at, status")
          .eq("organization_id", orgId)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
        (supabase as any)
          .from("accounts_payable")
          .select("amount, paid_at, status")
          .eq("organization_id", orgId)
          .gte("paid_at", dayStart)
          .lte("paid_at", dayEnd),
      ]);

      const sales = (salesRes.data || []).filter(
        (r: any) => r.status !== "cancelled" && r.status !== "canceled",
      );
      const saleIds = sales.map((r: any) => r.id);

      let itemsByOrder: Record<string, { sale: number; cost: number }> = {};
      if (saleIds.length) {
        const { data: items } = await (supabase as any)
          .from("sale_items")
          .select("sale_id, quantity, unit_price, cost_price")
          .in("sale_id", saleIds)
          .eq("organization_id", orgId);
        for (const it of (items || []) as any[]) {
          const qty = Number(it.quantity) || 0;
          const sale = qty * (Number(it.unit_price) || 0);
          const cost = qty * (Number(it.cost_price) || 0);
          const cur = itemsByOrder[it.sale_id] || { sale: 0, cost: 0 };
          cur.sale += sale;
          cur.cost += cost;
          itemsByOrder[it.sale_id] = cur;
        }
      }

      let dayRevenue = 0,
        dayCount = 0,
        dayProfit = 0,
        monthRevenue = 0,
        monthCount = 0,
        monthProfit = 0;

      for (const o of sales as any[]) {
        const amount = Number(o.total_amount) || 0;
        const agg = itemsByOrder[o.id];
        const profit = agg ? agg.sale - agg.cost : 0;
        monthRevenue += amount;
        monthCount++;
        monthProfit += profit;
        const d = new Date(o.created_at);
        if (d >= new Date(dayStart) && d <= new Date(dayEnd)) {
          dayRevenue += amount;
          dayCount++;
          dayProfit += profit;
        }
      }

      const dayExpenses = ((expensesRes as any).data || [])
        .filter((e: any) => e.status === "paid" || e.paid_at)
        .reduce((a: number, e: any) => a + (Number(e.amount) || 0), 0);

      const dayTicket = dayCount ? dayRevenue / dayCount : 0;
      const dayAvgProfit = dayCount ? dayProfit / dayCount : 0;
      const dayProfitPct = dayRevenue ? (dayProfit / dayRevenue) * 100 : 0;

      if (cancel) return;
      setS({
        dayRevenue,
        dayCount,
        dayProfit,
        dayTicket,
        dayProfitPct,
        dayAvgProfit,
        dayExpenses,
        monthRevenue,
        monthCount,
        monthProfit,
      });
      setLoading(false);
    };

    load();
    const ch = supabase
      .channel(`daily-dashboard-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_orders", filter: `organization_id=eq.${orgId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts_payable", filter: `organization_id=eq.${orgId}` },
        load,
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [orgId]);

  const cards = [
    {
      label: "Faturamento (R$)",
      value: brl(s.dayRevenue),
      projection: `Projeção Mês Atual: ${brl(s.monthRevenue)}`,
      icon: Banknote,
      tone: "emerald",
    },
    {
      label: "Qtd. Vendas",
      value: String(s.dayCount),
      projection: `Projeção Mês Atual: ${s.monthCount}`,
      icon: ShoppingBasket,
      tone: "emerald",
    },
    {
      label: "Lucro (R$)",
      value: brl(s.dayProfit),
      projection: `Projeção Mês Atual: ${brl(s.monthProfit)}`,
      icon: ShoppingBasket,
      tone: "emerald",
    },
    {
      label: "Ticket Médio",
      value: brl(s.dayTicket),
      projection: "",
      icon: Receipt,
      tone: "emerald",
    },
    {
      label: "Percentual de Lucro",
      value: `${s.dayProfitPct.toFixed(0)}%`,
      projection: "",
      icon: Percent,
      tone: "emerald",
    },
    {
      label: "Lucro médio (R$)",
      value: brl(s.dayAvgProfit),
      projection: "",
      icon: Banknote,
      tone: "emerald",
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold tracking-tight text-foreground/80">Dashboard diário</h3>
        {loading && <span className="text-[10px] text-muted-foreground">atualizando…</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20"
            >
              <div className="relative z-10">
                <div className="text-2xl font-black leading-tight">{c.value}</div>
                {c.projection && (
                  <div className="text-[10px] opacity-90 mt-0.5">{c.projection}</div>
                )}
                <div className="text-xs font-medium opacity-95 mt-1">{c.label}</div>
              </div>
              <Icon className="absolute right-3 bottom-2 h-12 w-12 opacity-30" strokeWidth={1.5} />
            </div>
          );
        })}
      </div>

      <h4 className="text-sm font-bold tracking-tight text-foreground/80 mt-5 mb-3">
        Entradas e saídas
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
          <div className="relative z-10">
            <div className="text-2xl font-black">{brl(s.dayRevenue)}</div>
            <div className="text-xs font-medium opacity-95 mt-1">Total Entradas:</div>
          </div>
          <TrendingUp className="absolute right-3 bottom-2 h-12 w-12 opacity-30" strokeWidth={1.5} />
        </div>
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/20">
          <div className="relative z-10">
            <div className="text-2xl font-black">{brl(s.dayExpenses)}</div>
            <div className="text-xs font-medium opacity-95 mt-1">Total Saídas:</div>
          </div>
          <TrendingDown className="absolute right-3 bottom-2 h-12 w-12 opacity-30" strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}
