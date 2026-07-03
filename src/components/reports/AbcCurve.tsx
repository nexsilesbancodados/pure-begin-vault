import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Download,
  Loader2,
  Sparkles,
  ArrowUpDown,
  Search,
  AlertTriangle,
  TrendingUp,
  Package,
  DollarSign,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ============================================================================
// Types
// ============================================================================

export type AbcCriterion = "revenue" | "profit" | "quantity" | "margin" | "turnover";

export type AbcConfig = {
  criterion: AbcCriterion;
  from: string | null; // ISO date
  to: string | null;
  brand: string;
  category: string;
  model: string;
  supplier: string;
  seller: string;
  pctA: number;
  pctB: number;
  pctC: number;
};

type ProductRef = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  model: string | null;
  supplier: string | null;
  stock_quantity: number | null;
  cost_price: number | null;
};

type SaleItemRow = {
  id: string;
  sale_id: string | null;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  total: number;
  created_at: string;
  sales_orders?: { seller_id: string | null } | null;
};

type Row = {
  key: string;
  productId: string | null;
  name: string;
  sku: string | null;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  turnover: number; // qty / max(stock, 1)
  stock: number;
  brand: string | null;
  category: string | null;
  cumulativePct?: number;
  abcClass?: "A" | "B" | "C";
  participation?: number;
};

// ============================================================================
// Utils
// ============================================================================

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CRIT_LABEL: Record<AbcCriterion, string> = {
  revenue: "Receita",
  profit: "Lucro",
  quantity: "Quantidade Vendida",
  margin: "Margem",
  turnover: "Giro de Estoque",
};

const defaultConfig = (): AbcConfig => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    criterion: "revenue",
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    brand: "",
    category: "",
    model: "",
    supplier: "",
    seller: "",
    pctA: 80,
    pctB: 15,
    pctC: 5,
  };
};

function criterionValue(r: Row, c: AbcCriterion): number {
  switch (c) {
    case "revenue":
      return r.revenue;
    case "profit":
      return r.profit;
    case "quantity":
      return r.qty;
    case "margin":
      return r.marginPct;
    case "turnover":
      return r.turnover;
  }
}

// ============================================================================
// Config Dialog
// ============================================================================

export function AbcCurveConfigDialog({
  open,
  onOpenChange,
  onGenerate,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerate: (cfg: AbcConfig) => void;
  initial?: AbcConfig;
}) {
  const { orgId } = useOrg();
  const [cfg, setCfg] = useState<AbcConfig>(initial ?? defaultConfig());
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      const [pRes, sRes] = await Promise.all([
        (supabase as any)
          .from("products")
          .select("brand, category, model, supplier")
          .eq("organization_id", orgId)
          .limit(5000),
        (supabase as any)
          .from("profiles")
          .select("id, nome, display_name")
          .limit(500),
      ]);
      const uniq = (arr: any[], k: string) =>
        Array.from(new Set(arr.map((r) => (r?.[k] ?? "").trim()).filter(Boolean))).sort();
      const prods = pRes?.data ?? [];
      setBrands(uniq(prods, "brand"));
      setCategories(uniq(prods, "category"));
      setModels(uniq(prods, "model"));
      setSuppliers(uniq(prods, "supplier"));
      setSellers(
        (sRes?.data ?? []).map((p: any) => ({
          id: p.id,
          name: p.display_name || p.nome || "—",
        })),
      );
    })();
  }, [open, orgId]);

  const total = cfg.pctA + cfg.pctB + cfg.pctC;
  const totalOk = Math.round(total * 100) === 10000;

  const update = (patch: Partial<AbcConfig>) => setCfg((p) => ({ ...p, ...patch }));

  const autoBalance = () => {
    // Ajusta C para fechar em 100 preservando A e B
    const c = Math.max(0, 100 - cfg.pctA - cfg.pctB);
    update({ pctC: Number(c.toFixed(2)) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Configurar Curva ABC
          </DialogTitle>
          <DialogDescription>
            Defina o critério, o período, os filtros e os percentuais das classes A, B e C.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label className="text-xs font-black uppercase tracking-widest">Critério</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              {(Object.keys(CRIT_LABEL) as AbcCriterion[]).map((c) => (
                <button
                  key={c}
                  onClick={() => update({ criterion: c })}
                  className={`px-3 h-8 rounded-lg text-xs font-black transition border ${
                    cfg.criterion === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                >
                  {CRIT_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-black uppercase tracking-widest">De</Label>
              <Input
                type="date"
                value={cfg.from ?? ""}
                onChange={(e) => update({ from: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs font-black uppercase tracking-widest">Até</Label>
              <Input
                type="date"
                value={cfg.to ?? ""}
                onChange={(e) => update({ to: e.target.value || null })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectFilter
              label="Marca"
              value={cfg.brand}
              options={brands}
              onChange={(v) => update({ brand: v })}
            />
            <SelectFilter
              label="Categoria"
              value={cfg.category}
              options={categories}
              onChange={(v) => update({ category: v })}
            />
            <SelectFilter
              label="Modelo"
              value={cfg.model}
              options={models}
              onChange={(v) => update({ model: v })}
            />
            <SelectFilter
              label="Fornecedor"
              value={cfg.supplier}
              options={suppliers}
              onChange={(v) => update({ supplier: v })}
            />
            <div className="col-span-2">
              <Label className="text-xs font-black uppercase tracking-widest">Vendedor</Label>
              <select
                value={cfg.seller}
                onChange={(e) => update({ seller: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Todos</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-widest">
                Percentuais das Classes
              </Label>
              <Button size="sm" variant="ghost" onClick={autoBalance} type="button">
                Ajustar automaticamente
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(["pctA", "pctB", "pctC"] as const).map((k, i) => (
                <div key={k}>
                  <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">
                    Classe {["A", "B", "C"][i]}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={cfg[k]}
                      onChange={(e) => update({ [k]: Number(e.target.value) } as any)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className={`mt-2 text-xs font-bold ${
                totalOk ? "text-success" : "text-destructive"
              }`}
            >
              Soma: {total.toFixed(2)}% {totalOk ? "✓" : "(deve ser 100%)"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!totalOk}
            onClick={() => {
              onGenerate(cfg);
              onOpenChange(false);
            }}
          >
            Gerar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs font-black uppercase tracking-widest">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// Report
// ============================================================================

type SortKey =
  | "class"
  | "name"
  | "qty"
  | "revenue"
  | "profit"
  | "marginPct"
  | "participation"
  | "cumulativePct"
  | "stock";

export function AbcCurveReport({ config }: { config: AbcConfig }) {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [products, setProducts] = useState<Map<string, ProductRef>>(new Map());
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [sortKey, setSortKey] = useState<SortKey>("participation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      let q = (supabase as any)
        .from("sale_items")
        .select(
          "id, sale_id, product_id, product_name, sku, quantity, unit_price, unit_cost, total, created_at, sales_orders(seller_id)",
        )
        .eq("organization_id", orgId)
        .limit(20000);
      if (config.from) q = q.gte("created_at", `${config.from}T00:00:00`);
      if (config.to) q = q.lte("created_at", `${config.to}T23:59:59`);

      const [sRes, pRes] = await Promise.all([
        q,
        (supabase as any)
          .from("products")
          .select("id, name, brand, category, model, supplier, stock_quantity, cost_price")
          .eq("organization_id", orgId)
          .limit(10000),
      ]);
      const map = new Map<string, ProductRef>();
      for (const p of pRes?.data ?? []) map.set(p.id, p as ProductRef);
      setProducts(map);
      setItems((sRes?.data as SaleItemRow[]) ?? []);
      setLoading(false);
    })();
  }, [orgId, config.from, config.to]);

  // Aggregate + filter
  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const it of items) {
      // Seller filter
      if (config.seller && it.sales_orders?.seller_id !== config.seller) continue;
      const p = it.product_id ? products.get(it.product_id) : undefined;
      // Product-level filters
      if (config.brand && (p?.brand ?? "") !== config.brand) continue;
      if (config.category && (p?.category ?? "") !== config.category) continue;
      if (config.model && (p?.model ?? "") !== config.model) continue;
      if (config.supplier && (p?.supplier ?? "") !== config.supplier) continue;

      const key = it.product_id || `name:${it.product_name}`;
      const qty = Number(it.quantity || 0);
      const revenue = Number(it.total || qty * Number(it.unit_price || 0));
      const cost = Number(it.unit_cost ?? p?.cost_price ?? 0) * qty;
      const cur =
        map.get(key) ??
        ({
          key,
          productId: it.product_id,
          name: it.product_name || p?.name || "Sem nome",
          sku: it.sku,
          qty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          marginPct: 0,
          turnover: 0,
          stock: p?.stock_quantity ?? 0,
          brand: p?.brand ?? null,
          category: p?.category ?? null,
        } as Row);
      cur.qty += qty;
      cur.revenue += revenue;
      cur.cost += cost;
      map.set(key, cur);
    }
    const out: Row[] = [];
    for (const r of map.values()) {
      r.profit = r.revenue - r.cost;
      r.marginPct = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
      r.turnover = r.qty / Math.max(r.stock || 1, 1);
      out.push(r);
    }
    return out;
  }, [items, products, config]);

  // Compute classes based on criterion
  const classed: Row[] = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => criterionValue(b, config.criterion) - criterionValue(a, config.criterion),
    );
    const total = sorted.reduce((s, r) => s + Math.max(criterionValue(r, config.criterion), 0), 0) || 1;
    let acc = 0;
    for (const r of sorted) {
      const val = Math.max(criterionValue(r, config.criterion), 0);
      acc += val;
      r.cumulativePct = (acc / total) * 100;
      r.participation = (val / total) * 100;
      const p = r.cumulativePct;
      r.abcClass = p <= config.pctA ? "A" : p <= config.pctA + config.pctB ? "B" : "C";
    }
    return sorted;
  }, [rows, config]);

  const filtered: Row[] = useMemo(() => {
    const s = search.trim().toLowerCase();
    let arr = classed;
    if (classFilter !== "all") arr = arr.filter((r) => r.abcClass === classFilter);
    if (s)
      arr = arr.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.sku ?? "").toLowerCase().includes(s) ||
          (r.brand ?? "").toLowerCase().includes(s),
      );
    const dir = sortDir === "asc" ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "class") {
        const order = { A: 0, B: 1, C: 2 } as const;
        return (order[a.abcClass ?? "C"] - order[b.abcClass ?? "C"]) * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return arr;
  }, [classed, search, classFilter, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const revenue = classed.reduce((s, r) => s + r.revenue, 0);
    const profit = classed.reduce((s, r) => s + r.profit, 0);
    const qty = classed.reduce((s, r) => s + r.qty, 0);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const ticket = qty > 0 ? revenue / qty : 0;
    return { revenue, profit, qty, margin, ticket, distinct: classed.length };
  }, [classed]);

  const classSummary = useMemo(() => {
    const make = (cls: "A" | "B" | "C") => {
      const arr = classed.filter((r) => r.abcClass === cls);
      const revenue = arr.reduce((s, r) => s + r.revenue, 0);
      const profit = arr.reduce((s, r) => s + r.profit, 0);
      return {
        cls,
        count: arr.length,
        revenue,
        profit,
        pct: kpis.revenue > 0 ? (revenue / kpis.revenue) * 100 : 0,
      };
    };
    return [make("A"), make("B"), make("C")];
  }, [classed, kpis.revenue]);

  // Chart data (top N by criterion)
  const chartData = useMemo(
    () =>
      classed.slice(0, 30).map((r, i) => ({
        name: r.name.length > 18 ? r.name.slice(0, 18) + "…" : r.name,
        value: Math.max(criterionValue(r, config.criterion), 0),
        acc: r.cumulativePct ?? 0,
        rank: i + 1,
      })),
    [classed, config.criterion],
  );

  const insights = useMemo(() => {
    const A = classed.filter((r) => r.abcClass === "A");
    const lowStockA = A.filter((r) => r.stock <= 3);
    const lowTurn = classed.filter((r) => r.turnover < 0.1 && r.qty <= 1).slice(0, 5);
    const topImpact = A.slice(0, 3);
    const list: { icon: any; tone: string; title: string; body: string }[] = [];
    if (topImpact.length) {
      list.push({
        icon: TrendingUp,
        tone: "text-success bg-success/10 border-success/20",
        title: "Produtos que mais impactam o faturamento",
        body: topImpact
          .map((r) => `${r.name} (${(r.participation ?? 0).toFixed(1)}%)`)
          .join(" · "),
      });
    }
    list.push({
      icon: BarChart3,
      tone: "text-primary bg-primary/10 border-primary/20",
      title: "Participação por classe",
      body: classSummary
        .map((c) => `${c.cls}: ${c.count} prod. — ${c.pct.toFixed(1)}%`)
        .join(" · "),
    });
    if (lowStockA.length) {
      list.push({
        icon: AlertTriangle,
        tone: "text-warning bg-warning/10 border-warning/20",
        title: "Repor estoque — Classe A com estoque baixo",
        body: lowStockA
          .slice(0, 5)
          .map((r) => `${r.name} (estoque ${r.stock})`)
          .join(" · "),
      });
    }
    if (lowTurn.length) {
      list.push({
        icon: Package,
        tone: "text-muted-foreground bg-muted border-border",
        title: "Baixo giro — considere promoção",
        body: lowTurn.map((r) => r.name).join(" · "),
      });
    }
    return list;
  }, [classed, classSummary]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" || k === "class" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    const header = [
      "Classe",
      "Produto",
      "SKU",
      "Qtd Vendida",
      "Receita",
      "Lucro",
      "Margem %",
      "Participação %",
      "% Acumulado",
      "Estoque",
    ];
    const rowsCsv = filtered.map((r) => [
      r.abcClass ?? "",
      `"${r.name.replace(/"/g, '""')}"`,
      r.sku ?? "",
      r.qty,
      r.revenue.toFixed(2),
      r.profit.toFixed(2),
      r.marginPct.toFixed(2),
      (r.participation ?? 0).toFixed(2),
      (r.cumulativePct ?? 0).toFixed(2),
      r.stock,
    ]);
    const csv = [header.join(","), ...rowsCsv.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curva-abc-${config.criterion}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className="p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Gerando Curva ABC...
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Curva ABC — {CRIT_LABEL[config.criterion]}
          </h3>
          <p className="text-xs text-muted-foreground font-bold">
            {config.from} até {config.to} · A={config.pctA}% · B={config.pctB}% · C={config.pctC}%
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiMini icon={DollarSign} label="Receita Total" value={fmtBRL(kpis.revenue)} tone="success" />
        <KpiMini
          icon={TrendingUp}
          label="Lucro Total"
          value={fmtBRL(kpis.profit)}
          tone={kpis.profit >= 0 ? "success" : "destructive"}
        />
        <KpiMini icon={BarChart3} label="Margem Média" value={`${kpis.margin.toFixed(1)}%`} tone="primary" />
        <KpiMini icon={Package} label="Ticket Médio" value={fmtBRL(kpis.ticket)} tone="info" />
      </div>

      {/* Class cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {classSummary.map((c) => (
          <Card
            key={c.cls}
            className={`p-4 border-2 ${
              c.cls === "A"
                ? "border-success/40 bg-success/5"
                : c.cls === "B"
                  ? "border-warning/40 bg-warning/5"
                  : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-black">{c.cls}</span>
              <Badge variant="outline">{c.count} produtos</Badge>
            </div>
            <div className="text-xl font-black tabular-nums">{fmtBRL(c.revenue)}</div>
            <div className="text-xs text-muted-foreground font-bold">
              Lucro: {fmtBRL(c.profit)} · {c.pct.toFixed(1)}% da receita
            </div>
          </Card>
        ))}
      </div>

      {/* Pareto Chart */}
      <Card className="p-5">
        <h4 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Gráfico de Pareto (top 30)
        </h4>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período.</p>
        ) : (
          <div className="w-full h-[360px]">
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 12, right: 40, left: 4, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={80}
                  tick={{ fontSize: 10 }}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: any, name: string) =>
                    name === "% Acumulado" ? `${Number(v).toFixed(1)}%` : v
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="value" name={CRIT_LABEL[config.criterion]} fill="hsl(var(--primary))" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="acc"
                  name="% Acumulado"
                  stroke="hsl(var(--warning))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Insights */}
      <Card className="p-5">
        <h4 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Insights Inteligentes
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {insights.map((i, idx) => (
            <div key={idx} className={`rounded-xl border p-3 ${i.tone}`}>
              <div className="flex items-center gap-2 mb-1">
                <i.icon className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-widest">{i.title}</span>
              </div>
              <div className="text-xs">{i.body}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, SKU ou marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value as any)}
            className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-bold"
          >
            <option value="all">Todas classes</option>
            <option value="A">Classe A</option>
            <option value="B">Classe B</option>
            <option value="C">Classe C</option>
          </select>
          <div className="text-xs text-muted-foreground font-bold">{filtered.length} produto(s)</div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum produto encontrado.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <ThSort onClick={() => toggleSort("class")} active={sortKey === "class"} dir={sortDir} className="pl-5 text-left">
                    Classe
                  </ThSort>
                  <ThSort onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} className="text-left">
                    Produto
                  </ThSort>
                  <ThSort onClick={() => toggleSort("qty")} active={sortKey === "qty"} dir={sortDir}>Qtd</ThSort>
                  <ThSort onClick={() => toggleSort("revenue")} active={sortKey === "revenue"} dir={sortDir}>Receita</ThSort>
                  <ThSort onClick={() => toggleSort("profit")} active={sortKey === "profit"} dir={sortDir}>Lucro</ThSort>
                  <ThSort onClick={() => toggleSort("marginPct")} active={sortKey === "marginPct"} dir={sortDir}>Margem</ThSort>
                  <ThSort onClick={() => toggleSort("participation")} active={sortKey === "participation"} dir={sortDir}>Part.</ThSort>
                  <ThSort onClick={() => toggleSort("cumulativePct")} active={sortKey === "cumulativePct"} dir={sortDir}>% Acum.</ThSort>
                  <ThSort onClick={() => toggleSort("stock")} active={sortKey === "stock"} dir={sortDir} className="pr-5">Estoque</ThSort>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => (
                  <tr key={r.key} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="pl-5 py-2">
                      <span
                        className={`inline-flex h-6 w-6 rounded-md items-center justify-center text-[10px] font-black ${
                          r.abcClass === "A"
                            ? "bg-success/15 text-success"
                            : r.abcClass === "B"
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.abcClass}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="font-bold truncate max-w-[280px]">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.sku ? `SKU: ${r.sku}` : ""}{r.brand ? ` · ${r.brand}` : ""}
                      </div>
                    </td>
                    <td className="text-right tabular-nums font-bold">{r.qty}</td>
                    <td className="text-right tabular-nums font-bold">{fmtBRL(r.revenue)}</td>
                    <td className={`text-right tabular-nums font-bold ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmtBRL(r.profit)}
                    </td>
                    <td className="text-right tabular-nums">{r.marginPct.toFixed(1)}%</td>
                    <td className="text-right tabular-nums">{(r.participation ?? 0).toFixed(2)}%</td>
                    <td className="text-right tabular-nums">{(r.cumulativePct ?? 0).toFixed(1)}%</td>
                    <td className="text-right pr-5 tabular-nums">{r.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <p className="text-[10px] text-muted-foreground text-center pt-3">
                Exibindo primeiros 500 de {filtered.length}. Exporte CSV para o total.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiMini({
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

function ThSort({
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
