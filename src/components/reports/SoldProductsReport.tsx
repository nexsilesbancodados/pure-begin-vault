import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  Loader2,
  Trophy,
  BarChart3,
} from "lucide-react";
import { AbcCurveConfigDialog, AbcCurveReport, type AbcConfig } from "./AbcCurve";


type RangePreset = "today" | "7d" | "30d" | "month" | "year" | "all";

type Item = {
  id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  total: number;
  created_at: string;
};

type Agg = {
  key: string;
  name: string;
  sku: string | null;
  qty: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  orders: number;
  avgPrice: number;
  lastSold: string;
  abcClass?: "A" | "B" | "C";
  cumulativePct?: number;
};


const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function computeRange(preset: RangePreset): { from: Date | null; to: Date | null; label: string } {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: startToday, to: now, label: "Hoje" };
    case "7d": {
      const f = new Date(startToday);
      f.setDate(f.getDate() - 6);
      return { from: f, to: now, label: "7 dias" };
    }
    case "30d": {
      const f = new Date(startToday);
      f.setDate(f.getDate() - 29);
      return { from: f, to: now, label: "30 dias" };
    }
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
        label: "Este mês",
      };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: now, label: "Este ano" };
    default:
      return { from: null, to: null, label: "Tudo" };
  }
}

type SortKey = "qty" | "revenue" | "margin" | "marginPct" | "orders" | "name";

export function SoldProductsReport() {
  const { orgId } = useOrg();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [abcFilter, setAbcFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [marginFilter, setMarginFilter] = useState<"all" | "positive" | "negative" | "high">("all");
  const [showAbc, setShowAbc] = useState(false);



  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const { from, to } = computeRange(preset);
    let q = (supabase as any)
      .from("sale_items")
      .select("id, product_id, product_name, sku, quantity, unit_price, unit_cost, total, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (from) q = q.gte("created_at", from.toISOString());
    if (to) q = q.lte("created_at", to.toISOString());
    q.then(({ data }: any) => {
      setItems((data as Item[]) ?? []);
      setLoading(false);
    });
  }, [orgId, preset]);

  const aggregated: Agg[] = useMemo(() => {
    const map = new Map<string, Agg>();
    const orderSetByKey = new Map<string, Set<string>>();
    for (const it of items) {
      const key = it.product_id || `name:${it.product_name}`;
      const qty = Number(it.quantity || 0);
      const revenue = Number(it.total || qty * Number(it.unit_price || 0));
      const cost = Number(it.unit_cost ?? 0) * qty;
      const cur = map.get(key) ?? {
        key,
        name: it.product_name || "Sem nome",
        sku: it.sku,
        qty: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: 0,
        orders: 0,
        avgPrice: 0,
        lastSold: it.created_at,
      };
      cur.qty += qty;
      cur.revenue += revenue;
      cur.cost += cost;
      if (new Date(it.created_at) > new Date(cur.lastSold)) cur.lastSold = it.created_at;
      map.set(key, cur);
      // orders unique
      const set = orderSetByKey.get(key) ?? new Set<string>();
      set.add(it.id.slice(0, 36)); // sale_id not selected; fallback to row id (still counts items)
      orderSetByKey.set(key, set);
    }
    const out: Agg[] = [];
    for (const a of map.values()) {
      a.orders = orderSetByKey.get(a.key)?.size ?? 0;
      a.margin = a.revenue - a.cost;
      a.marginPct = a.revenue > 0 ? (a.margin / a.revenue) * 100 : 0;
      a.avgPrice = a.qty > 0 ? a.revenue / a.qty : 0;
      out.push(a);
    }
    return out;
  }, [items]);

  // Curva ABC: A = 80% receita, B = próximos 15%, C = últimos 5%
  const withAbc: Agg[] = useMemo(() => {
    const sortedByRev = [...aggregated].sort((a, b) => b.revenue - a.revenue);
    const total = sortedByRev.reduce((s, a) => s + a.revenue, 0) || 1;
    let acc = 0;
    for (const a of sortedByRev) {
      acc += a.revenue;
      const pct = (acc / total) * 100;
      a.cumulativePct = pct;
      a.abcClass = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    }
    return sortedByRev;
  }, [aggregated]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let arr = s
      ? withAbc.filter(
          (a) =>
            a.name.toLowerCase().includes(s) || (a.sku ?? "").toLowerCase().includes(s),
        )
      : withAbc;
    if (abcFilter !== "all") arr = arr.filter((a) => a.abcClass === abcFilter);
    if (marginFilter === "positive") arr = arr.filter((a) => a.margin > 0);
    else if (marginFilter === "negative") arr = arr.filter((a) => a.margin < 0);
    else if (marginFilter === "high") arr = arr.filter((a) => a.marginPct >= 30);
    const sorted = [...arr].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (((a[sortKey] as number) - (b[sortKey] as number)) as number) * dir;
    });
    return sorted;
  }, [withAbc, search, sortKey, sortDir, abcFilter, marginFilter]);


  const kpis = useMemo(() => {
    const totalQty = aggregated.reduce((a, b) => a + b.qty, 0);
    const totalRev = aggregated.reduce((a, b) => a + b.revenue, 0);
    const totalMargin = aggregated.reduce((a, b) => a + b.margin, 0);
    const distinct = aggregated.length;
    return { totalQty, totalRev, totalMargin, distinct };
  }, [aggregated]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    const header = ["Produto", "SKU", "Qtd vendida", "Receita", "Custo", "Margem", "Margem %", "Preço médio", "Última venda"];
    const rows = filtered.map((a) => [
      `"${a.name.replace(/"/g, '""')}"`,
      a.sku ?? "",
      a.qty,
      a.revenue.toFixed(2),
      a.cost.toFixed(2),
      a.margin.toFixed(2),
      a.marginPct.toFixed(2),
      a.avgPrice.toFixed(2),
      new Date(a.lastSold).toLocaleString("pt-BR"),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produtos-vendidos-${preset}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const top5 = useMemo(() => [...aggregated].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [aggregated]);
  const maxTop = top5[0]?.revenue || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Produtos Vendidos</h2>
          <p className="text-sm font-bold text-muted-foreground">
            Ranking, margem e desempenho por produto no período selecionado.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            {(["today", "7d", "30d", "month", "year", "all"] as RangePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 h-8 text-[11px] font-black uppercase rounded-lg transition ${
                  preset === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {computeRange(p).label}
              </button>
            ))}
          </div>
          <Button
            onClick={() => setShowAbc((v) => !v)}
            size="sm"
            variant={showAbc ? "default" : "outline"}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" /> Curva ABC
          </Button>
          <Button onClick={exportCsv} size="sm" variant="outline" disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>

        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={ShoppingCart} label="Itens vendidos" value={String(kpis.totalQty)} tone="primary" />
        <Kpi icon={DollarSign} label="Receita" value={fmtBRL(kpis.totalRev)} tone="success" />
        <Kpi icon={TrendingUp} label="Margem" value={fmtBRL(kpis.totalMargin)} tone={kpis.totalMargin >= 0 ? "success" : "destructive"} />
        <Kpi icon={Package} label="Produtos distintos" value={String(kpis.distinct)} tone="info" />
      </div>

      {/* Top 5 ranking */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="font-black text-sm uppercase tracking-widest">Top 5 por receita</h3>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : top5.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem vendas no período selecionado.
          </p>
        ) : (
          <div className="space-y-2">
            {top5.map((a, i) => (
              <div key={a.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : i === 1
                            ? "bg-slate-200 text-slate-700"
                            : i === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-primary/10 text-primary"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-bold truncate">{a.name}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {a.qty} un.
                    </Badge>
                  </div>
                  <span className="font-black tabular-nums">{fmtBRL(a.revenue)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(4, (a.revenue / maxTop) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Curva ABC */}
      {showAbc && <AbcPanel items={withAbc} />}

      {/* Search + Table */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto ou SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={abcFilter}
            onChange={(e) => setAbcFilter(e.target.value as any)}
            className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-bold"
          >
            <option value="all">Todas classes ABC</option>
            <option value="A">Classe A (80% receita)</option>
            <option value="B">Classe B (15% receita)</option>
            <option value="C">Classe C (5% receita)</option>
          </select>
          <select
            value={marginFilter}
            onChange={(e) => setMarginFilter(e.target.value as any)}
            className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-bold"
          >
            <option value="all">Todas margens</option>
            <option value="positive">Margem positiva</option>
            <option value="negative">Margem negativa</option>
            <option value="high">Margem alta (≥30%)</option>
          </select>
          <div className="text-xs text-muted-foreground font-bold inline-flex items-center gap-1">
            <Filter className="h-3 w-3" /> {filtered.length} produto(s)
          </div>
        </div>


        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Nenhum produto encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} className="text-left pl-5">
                    Produto
                  </Th>
                  <Th onClick={() => toggleSort("qty")} active={sortKey === "qty"} dir={sortDir}>
                    Qtd
                  </Th>
                  <Th onClick={() => toggleSort("orders")} active={sortKey === "orders"} dir={sortDir}>
                    Vendas
                  </Th>
                  <Th onClick={() => toggleSort("revenue")} active={sortKey === "revenue"} dir={sortDir}>
                    Receita
                  </Th>
                  <Th onClick={() => toggleSort("margin")} active={sortKey === "margin"} dir={sortDir}>
                    Margem
                  </Th>
                  <Th onClick={() => toggleSort("marginPct")} active={sortKey === "marginPct"} dir={sortDir} className="pr-5">
                    Margem %
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((a) => (
                  <tr key={a.key} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="py-2.5 pl-5">
                      <div className="flex items-center gap-2">
                        {a.abcClass && (
                          <span
                            className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                              a.abcClass === "A"
                                ? "bg-success/15 text-success"
                                : a.abcClass === "B"
                                  ? "bg-warning/15 text-warning"
                                  : "bg-muted text-muted-foreground"
                            }`}
                            title={`Classe ${a.abcClass}`}
                          >
                            {a.abcClass}
                          </span>
                        )}
                        <div className="font-bold truncate max-w-[260px]">{a.name}</div>
                      </div>
                      {a.sku && (
                        <div className="text-[10px] text-muted-foreground pl-7">SKU: {a.sku}</div>
                      )}
                    </td>

                    <td className="text-right tabular-nums font-bold">{a.qty}</td>
                    <td className="text-right tabular-nums">{a.orders}</td>
                    <td className="text-right tabular-nums font-bold">{fmtBRL(a.revenue)}</td>
                    <td
                      className={`text-right tabular-nums font-bold ${
                        a.margin >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {fmtBRL(a.margin)}
                    </td>
                    <td className="text-right pr-5 tabular-nums">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          a.marginPct >= 30
                            ? "border-success/40 text-success"
                            : a.marginPct >= 10
                              ? "border-warning/40 text-warning"
                              : "border-destructive/40 text-destructive"
                        }`}
                      >
                        {a.marginPct.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p className="text-[10px] text-muted-foreground text-center pt-3">
                Exibindo primeiros 200 de {filtered.length}. Refine a busca ou exporte CSV.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="text-xl font-black truncate tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`py-2 px-2 text-right font-black cursor-pointer select-none hover:text-foreground ${
        active ? "text-foreground" : ""
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-30"}`} />
        {active && <span className="text-[8px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function AbcPanel({ items }: { items: Agg[] }) {
  const totalRev = items.reduce((s, a) => s + a.revenue, 0) || 1;
  const groups = { A: [] as Agg[], B: [] as Agg[], C: [] as Agg[] };
  for (const a of items) {
    if (a.abcClass) groups[a.abcClass].push(a);
  }
  const stat = (g: Agg[]) => {
    const rev = g.reduce((s, a) => s + a.revenue, 0);
    return { count: g.length, rev, pct: (rev / totalRev) * 100 };
  };
  const A = stat(groups.A);
  const B = stat(groups.B);
  const C = stat(groups.C);
  const totalCount = items.length || 1;

  const rows: Array<{ label: "A" | "B" | "C"; s: ReturnType<typeof stat>; tone: string; hint: string }> = [
    { label: "A", s: A, tone: "bg-success/15 text-success border-success/30", hint: "Prioridade máxima — 80% da receita" },
    { label: "B", s: B, tone: "bg-warning/15 text-warning border-warning/30", hint: "Atenção média — 15% da receita" },
    { label: "C", s: C, tone: "bg-muted text-muted-foreground border-border", hint: "Cauda longa — 5% da receita" },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="font-black text-sm uppercase tracking-widest">Curva ABC</h3>
        <span className="text-[10px] text-muted-foreground font-bold">
          (Pareto por receita)
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.label} className={`rounded-xl border p-4 ${r.tone}`}>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-black">{r.label}</span>
              <span className="text-xs font-bold">
                {r.s.count} prod. ({((r.s.count / totalCount) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="text-xl font-black tabular-nums mt-2">{fmtBRL(r.s.rev)}</div>
            <div className="text-[10px] uppercase font-bold tracking-widest opacity-80 mt-1">
              {r.s.pct.toFixed(1)}% da receita
            </div>
            <div className="text-[10px] mt-2 opacity-70">{r.hint}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
          Distribuição visual
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          <div className="bg-success" style={{ width: `${A.pct}%` }} title={`A: ${A.pct.toFixed(1)}%`} />
          <div className="bg-warning" style={{ width: `${B.pct}%` }} title={`B: ${B.pct.toFixed(1)}%`} />
          <div className="bg-muted-foreground/40" style={{ width: `${C.pct}%` }} title={`C: ${C.pct.toFixed(1)}%`} />
        </div>
      </div>
    </Card>
  );
}

