import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ShoppingBasket,
  Receipt,
  Percent,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  Wallet,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
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
import { cn } from "@/lib/utils";
import { readCache, writeCache } from "@/lib/sessionCache";

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
  // previous comparable period for deltas
  prevRevenue: number;
  prevCount: number;
  prevProfit: number;
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
  prevRevenue: 0,
  prevCount: 0,
  prevProfit: 0,
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

function getPrevRange(p: Period) {
  const now = new Date();
  switch (p) {
    case "today": {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week": {
      const start = subDays(startOfWeek(now, { weekStartsOn: 0 }), 7);
      const end = subDays(endOfWeek(now, { weekStartsOn: 0 }), 7);
      return { start, end };
    }
    case "month": {
      const start = startOfMonth(subDays(startOfMonth(now), 1));
      const end = endOfMonth(start);
      return { start, end };
    }
    case "last7": {
      return { start: startOfDay(subDays(now, 13)), end: endOfDay(subDays(now, 7)) };
    }
  }
}

export function DailyDashboard() {
  const { orgId } = useOrg();
  const { permissions } = useAuth();
  const canFinance = permissions?.financeiro !== false;
  const [period, setPeriod] = useState<Period>("today");
  const [s, setS] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancel = false;
    const cacheKey = `daily-dash:${orgId}:${period}`;

    // Hidrata instantaneamente do cache persistente (sessionStorage)
    const cached = readCache<Stats>(cacheKey, 2 * 60_000);
    if (cached) {
      setS(cached);
      setLoading(false);
    }

    const load = async () => {
      if (!cached) setLoading(true);
      const { start, end } = getRange(period);
      const prev = getPrevRange(period);
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();
      const overallStart = (prev.start < start ? prev.start : start).toISOString();
      const overallEnd = monthEnd;

      const [salesRes, expensesRes] = await Promise.all([
        supabase
          .from("sales_orders")
          .select("id, total_amount, created_at, status")
          .eq("organization_id", orgId)
          .gte("created_at", overallStart)
          .lte("created_at", overallEnd),
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
          .select("sale_id, product_id, quantity, unit_price, unit_cost, total")
          .in("sale_id", saleIds)
          .eq("organization_id", orgId);

        const rows = (items || []) as any[];
        // Fallback: quando unit_cost vier nulo/zero, buscar cost_price do produto
        const missingCostIds = Array.from(
          new Set(
            rows
              .filter((it) => !Number(it.unit_cost) && it.product_id)
              .map((it) => it.product_id as string),
          ),
        );
        const costMap: Record<string, number> = {};
        if (missingCostIds.length) {
          const { data: prods } = await (supabase as any)
            .from("products")
            .select("id, cost_price")
            .in("id", missingCostIds)
            .eq("organization_id", orgId);
          for (const p of (prods || []) as any[]) {
            costMap[p.id] = Number(p.cost_price) || 0;
          }
        }

        for (const it of rows) {
          const qty = Number(it.quantity) || 0;
          const sale = Number(it.total) || qty * (Number(it.unit_price) || 0);
          const unitCost = Number(it.unit_cost) || costMap[it.product_id] || 0;
          const cost = qty * unitCost;
          const cur = itemsByOrder[it.sale_id] || { sale: 0, cost: 0 };
          cur.sale += sale;
          cur.cost += cost;
          itemsByOrder[it.sale_id] = cur;
        }
      }


      let revenue = 0,
        count = 0,
        profit = 0,
        prevRevenue = 0,
        prevCount = 0,
        prevProfit = 0,
        monthRevenue = 0,
        monthCount = 0,
        monthProfit = 0;

      for (const o of sales as any[]) {
        const amount = Number(o.total_amount) || 0;
        const agg = itemsByOrder[o.id];
        const p = agg ? agg.sale - agg.cost : 0;
        const d = new Date(o.created_at);
        const inMonth = d.toISOString() >= monthStart && d.toISOString() <= monthEnd;
        if (inMonth) {
          monthRevenue += amount;
          monthCount++;
          monthProfit += p;
        }
        if (d >= start && d <= end) {
          revenue += amount;
          count++;
          profit += p;
        }
        if (d >= prev.start && d <= prev.end) {
          prevRevenue += amount;
          prevCount++;
          prevProfit += p;
        }
      }

      const expenses = ((expensesRes as any).data || [])
        .filter((e: any) => e.status === "paid" || e.paid_at)
        .reduce((a: number, e: any) => a + (Number(e.amount) || 0), 0);

      if (cancel) return;
      const next: Stats = {
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
        prevRevenue,
        prevCount,
        prevProfit,
      };
      setS(next);
      writeCache(cacheKey, next);
      setLoading(false);
    };

    load();

    // Debounce realtime: agrupa rajadas em uma única recarga (1.5s)
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        load();
      }, 1500);
    };

    const ch = supabase
      .channel(`daily-dashboard-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_orders", filter: `organization_id=eq.${orgId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts_payable", filter: `organization_id=eq.${orgId}` },
        schedule,
      )
      .subscribe();

    return () => {
      cancel = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [orgId, period]);

  const delta = (cur: number, prev: number) => {
    if (!prev && !cur) return null;
    if (!prev) return { pct: 100, up: cur >= 0 };
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return { pct, up: pct >= 0 };
  };

  const netResult = s.revenue - s.expenses;

  type Card = {
    label: string;
    value: string;
    projection?: string;
    icon: typeof Banknote;
    tone: "emerald" | "sky" | "violet" | "amber" | "rose" | "slate";
    delta?: { pct: number; up: boolean } | null;
  };

  const cards: Card[] = useMemo(
    () => {
      const all: Card[] = [
        {
          label: "Faturamento",
          value: `R$ ${brl(s.revenue)}`,
          projection: `Mês: R$ ${brl(s.monthRevenue)}`,
          icon: Banknote,
          tone: "emerald",
          delta: delta(s.revenue, s.prevRevenue),
        },
        {
          label: "Vendas",
          value: String(s.count),
          projection: `Mês: ${s.monthCount}`,
          icon: ShoppingBasket,
          tone: "sky",
          delta: delta(s.count, s.prevCount),
        },
        ...(canFinance
          ? [
              {
                label: "Lucro",
                value: `R$ ${brl(s.profit)}`,
                projection: `Mês: R$ ${brl(s.monthProfit)}`,
                icon: Target,
                tone: "violet",
                delta: delta(s.profit, s.prevProfit),
              } as Card,
            ]
          : []),
        {
          label: "Ticket médio",
          value: `R$ ${brl(s.ticket)}`,
          icon: Receipt,
          tone: "amber",
        },
        ...(canFinance
          ? ([
              {
                label: "Margem de lucro",
                value: `${s.profitPct.toFixed(1)}%`,
                icon: Percent,
                tone: "emerald",
              },
              {
                label: "Lucro médio / venda",
                value: `R$ ${brl(s.avgProfit)}`,
                icon: Activity,
                tone: "sky",
              },
            ] as Card[])
          : []),
      ];
      return all;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, canFinance],
  );

  const toneClasses: Record<Card["tone"], string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400 ring-sky-500/20",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400 ring-violet-500/20",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 ring-rose-500/20",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400 ring-slate-500/20",
  };

  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-5 backdrop-blur">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 grid place-items-center shadow-md shadow-emerald-500/20">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-foreground truncate">
              Dashboard diário
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {loading ? "Atualizando…" : `Período: ${PERIOD_LABEL[period]}`}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-1.5 border border-border/60 hover:bg-muted/50"
              aria-label="Filtrar período"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
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
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={cn(
                "group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ring-1 transition-all hover:shadow-lg hover:-translate-y-0.5",
                "bg-card/70 backdrop-blur",
                toneClasses[c.tone],
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-1 truncate">
                    {c.value}
                  </p>
                </div>
                <div className={cn("h-9 w-9 shrink-0 rounded-xl grid place-items-center bg-background/60 ring-1", toneClasses[c.tone])}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                {c.projection ? (
                  <span className="text-muted-foreground truncate">{c.projection}</span>
                ) : (
                  <span />
                )}
                {c.delta && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-bold tabular-nums rounded-full px-1.5 py-0.5",
                      c.delta.up
                        ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                        : "text-rose-700 dark:text-rose-400 bg-rose-500/10",
                    )}
                  >
                    {c.delta.up ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(c.delta.pct).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-3">
        Entradas e saídas
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25">
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-90">
              <TrendingUp className="h-3 w-3" />
              Entradas
            </div>
            <div className="text-2xl font-black mt-1">R$ {brl(s.revenue)}</div>
            <div className="text-[11px] opacity-80 mt-0.5">{s.count} vendas</div>
          </div>
          <TrendingUp className="absolute -right-2 -bottom-2 h-20 w-20 opacity-15" strokeWidth={1.5} />
        </div>

        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/25">
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-90">
              <TrendingDown className="h-3 w-3" />
              Despesas
            </div>
            <div className="text-2xl font-black mt-1">R$ {brl(s.expenses)}</div>
            <div className="text-[11px] opacity-80 mt-0.5">Pagas no período</div>
          </div>
          <TrendingDown className="absolute -right-2 -bottom-2 h-20 w-20 opacity-15" strokeWidth={1.5} />
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-xl p-4 text-white shadow-md",
            netResult >= 0
              ? "bg-gradient-to-br from-sky-500 to-indigo-600 shadow-indigo-500/25"
              : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/25",
          )}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-90">
              <Wallet className="h-3 w-3" />
              Resultado líquido
            </div>
            <div className="text-2xl font-black mt-1">R$ {brl(netResult)}</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              {netResult >= 0 ? "Saldo positivo" : "Saldo negativo"}
            </div>
          </div>
          <Wallet className="absolute -right-2 -bottom-2 h-20 w-20 opacity-15" strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}
