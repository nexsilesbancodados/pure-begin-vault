import { useEffect, useState } from "react";
import {
  Banknote,
  ShoppingBasket,
  Receipt,
  Percent,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Period = "today" | "week" | "month" | "last7";
const PERIOD_LABEL: Record<Period, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  last7: "Últimos 7 dias",
};

type Stats = {
  revenue: number;
  count: number;
  profit: number;
  ticket: number;
  profitPct: number;
  avgProfit: number;
  expenses: number;
  monthRevenue: number;
  monthCount: number;
  monthProfit: number;
};

const EMPTY: Stats = {
  revenue: 0,
  count: 0,
  profit: 0,
  ticket: 0,
  profitPct: 0,
  avgProfit: 0,
  expenses: 0,
  monthRevenue: 0,
  monthCount: 0,
  monthProfit: 0,
};

function getRange(p: Period) {
  const now = new Date();
  switch (p) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }
}

export function DailyDashboard() {
  const { orgId } = useOrg();
  const [period, setPeriod] = useState<Period>("today");
  const [s, setS] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancel = false;

    const load = async () => {
      setLoading(true);
      const { start, end } = getRange(period);
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

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
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString()),
      ]);

      const sales = (salesRes.data || []).filter(
        (r: any) => r.status !== "cancelled" && r.status !== "canceled",
      );
      const saleIds = sales.map((r: any) => r.id);

      const itemsByOrder: Record<string, { sale: number; cost: number }> = {};
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

      let revenue = 0,
        count = 0,
        profit = 0,
        monthRevenue = 0,
        monthCount = 0,
        monthProfit = 0;

      for (const o of sales as any[]) {
        const amount = Number(o.total_amount) || 0;
        const agg = itemsByOrder[o.id];
        const p = agg ? agg.sale - agg.cost : 0;
        monthRevenue += amount;
        monthCount++;
        monthProfit += p;
        const d = new Date(o.created_at);
        if (d >= start && d <= end) {
          revenue += amount;
          count++;
          profit += p;
        }
      }

      const expenses = ((expensesRes as any).data || [])
        .filter((e: any) => e.status === "paid" || e.paid_at)
        .reduce((a: number, e: any) => a + (Number(e.amount) || 0), 0);

      if (cancel) return;
      setS({
        revenue,
        count,
        profit,
        ticket: count ? revenue / count : 0,
        avgProfit: count ? profit / count : 0,
        profitPct: revenue ? (profit / revenue) * 100 : 0,
        expenses,
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
  }, [orgId, period]);

  const cards = [
    {
      label: "Faturamento (R$)",
      value: brl(s.revenue),
      projection: `Projeção Mês Atual: ${brl(s.monthRevenue)}`,
      icon: Banknote,
    },
    {
      label: "Qtd. Vendas",
      value: String(s.count),
      projection: `Projeção Mês Atual: ${s.monthCount}`,
      icon: ShoppingBasket,
    },
    {
      label: "Lucro (R$)",
      value: brl(s.profit),
      projection: `Projeção Mês Atual: ${brl(s.monthProfit)}`,
      icon: ShoppingBasket,
    },
    { label: "Ticket Médio", value: brl(s.ticket), projection: "", icon: Receipt },
    {
      label: "Percentual de Lucro",
      value: `${s.profitPct.toFixed(0)}%`,
      projection: "",
      icon: Percent,
    },
    { label: "Lucro médio (R$)", value: brl(s.avgProfit), projection: "", icon: Banknote },
  ] as const;

  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight text-foreground/80">Dashboard diário</h3>
          {loading && <span className="text-[10px] text-muted-foreground">atualizando…</span>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted/50"
              aria-label="Filtrar período"
            >
              <SlidersHorizontal className="h-3 w-3" />
              {PERIOD_LABEL[period]}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Período</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => setPeriod(p)}
                className={period === p ? "font-semibold text-primary" : ""}
              >
                {PERIOD_LABEL[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
            <div className="text-2xl font-black">{brl(s.revenue)}</div>
            <div className="text-xs font-medium opacity-95 mt-1">Total Entradas:</div>
          </div>
          <TrendingUp className="absolute right-3 bottom-2 h-12 w-12 opacity-30" strokeWidth={1.5} />
        </div>
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/20">
          <div className="relative z-10">
            <div className="text-2xl font-black">{brl(s.expenses)}</div>
            <div className="text-xs font-medium opacity-95 mt-1">Despesa:</div>
          </div>
          <TrendingDown className="absolute right-3 bottom-2 h-12 w-12 opacity-30" strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}
