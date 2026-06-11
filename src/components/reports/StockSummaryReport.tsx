import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Boxes,
  Layers,
  Search,
  Download,
  Loader2,
  XCircle,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  category: string;
  stock_quantity: number;
  min_stock: number | null;
  cost_price: number | null;
  price: number;
  active: boolean;
  location: string | null;
};

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function StockSummaryReport() {
  const { orgId } = useOrg();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "low" | "out">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (supabase as any)
      .from("products")
      .select("id, name, sku, brand, category, stock_quantity, min_stock, cost_price, price, active, location")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(5000)
      .then(({ data }: any) => {
        setProducts((data as Product[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const kpis = useMemo(() => {
    let units = 0;
    let cost = 0;
    let retail = 0;
    let low = 0;
    let out = 0;
    for (const p of products) {
      const q = Number(p.stock_quantity || 0);
      units += q;
      cost += q * Number(p.cost_price || 0);
      retail += q * Number(p.price || 0);
      if (q <= 0) out++;
      else if (p.min_stock && q <= Number(p.min_stock)) low++;
    }
    const potentialMargin = retail - cost;
    return {
      skus: products.length,
      units,
      cost,
      retail,
      potentialMargin,
      marginPct: retail > 0 ? (potentialMargin / retail) * 100 : 0,
      low,
      out,
    };
  }, [products]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; units: number; cost: number; retail: number; skus: number }>();
    for (const p of products) {
      const cat = p.category || "Sem categoria";
      const q = Number(p.stock_quantity || 0);
      const cur = map.get(cat) ?? { name: cat, units: 0, cost: 0, retail: 0, skus: 0 };
      cur.units += q;
      cur.cost += q * Number(p.cost_price || 0);
      cur.retail += q * Number(p.price || 0);
      cur.skus += 1;
      map.set(cat, cur);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [products]);

  const byBrand = useMemo(() => {
    const map = new Map<string, { name: string; units: number; cost: number }>();
    for (const p of products) {
      const b = p.brand || "Sem marca";
      const q = Number(p.stock_quantity || 0);
      const cur = map.get(b) ?? { name: b, units: 0, cost: 0 };
      cur.units += q;
      cur.cost += q * Number(p.cost_price || 0);
      map.set(b, cur);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost).slice(0, 8);
  }, [products]);

  const categories = useMemo(() => ["all", ...byCategory.map((c) => c.name)], [byCategory]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      const q = Number(p.stock_quantity || 0);
      const status = q <= 0 ? "out" : p.min_stock && q <= Number(p.min_stock) ? "low" : "ok";
      if (statusFilter !== "all" && statusFilter !== status) return false;
      if (categoryFilter !== "all" && (p.category || "Sem categoria") !== categoryFilter) return false;
      if (s && !p.name.toLowerCase().includes(s) && !(p.sku ?? "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [products, search, statusFilter, categoryFilter]);

  const exportCsv = () => {
    const header = ["Produto", "SKU", "Marca", "Categoria", "Estoque", "Mín.", "Custo un.", "Preço un.", "Valor custo", "Valor venda"];
    const rows = filtered.map((p) => {
      const q = Number(p.stock_quantity || 0);
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku ?? "",
        p.brand ?? "",
        p.category ?? "",
        q,
        p.min_stock ?? "",
        (p.cost_price ?? 0).toFixed(2),
        (p.price ?? 0).toFixed(2),
        (q * Number(p.cost_price || 0)).toFixed(2),
        (q * Number(p.price || 0)).toFixed(2),
      ];
    });
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumo-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxCatCost = byCategory[0]?.cost || 1;
  const maxBrandCost = byBrand[0]?.cost || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Resumo de Estoque</h2>
          <p className="text-sm font-bold text-muted-foreground">
            Visão consolidada do estoque ativo: valor, cobertura e alertas.
          </p>
        </div>
        <Button onClick={exportCsv} size="sm" disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Layers} label="SKUs ativos" value={String(kpis.skus)} tone="primary" />
        <Kpi icon={Boxes} label="Unidades em estoque" value={kpis.units.toLocaleString("pt-BR")} tone="info" />
        <Kpi icon={DollarSign} label="Valor de custo" value={fmtBRL(kpis.cost)} tone="warning" />
        <Kpi icon={TrendingUp} label="Valor de venda" value={fmtBRL(kpis.retail)} tone="success" />
        <Kpi icon={TrendingUp} label="Margem potencial" value={`${fmtBRL(kpis.potentialMargin)} (${kpis.marginPct.toFixed(1)}%)`} tone={kpis.potentialMargin >= 0 ? "success" : "destructive"} />
        <Kpi icon={AlertTriangle} label="Estoque baixo" value={String(kpis.low)} tone="warning" />
        <Kpi icon={XCircle} label="Sem estoque" value={String(kpis.out)} tone="destructive" />
        <Kpi icon={Package} label="Cobertura média" value={kpis.skus ? `${(kpis.units / kpis.skus).toFixed(1)} un/SKU` : "—"} tone="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por categoria */}
        <Card className="p-5">
          <h3 className="font-black text-sm uppercase tracking-widest mb-4">Valor por categoria</h3>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem produtos cadastrados.</p>
          ) : (
            <div className="space-y-3">
              {byCategory.slice(0, 8).map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold truncate">{c.name}</span>
                    <span className="font-black tabular-nums">{fmtBRL(c.cost)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.max(4, (c.cost / maxCatCost) * 100)}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {c.skus} SKUs · {c.units} un.
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por marca */}
        <Card className="p-5">
          <h3 className="font-black text-sm uppercase tracking-widest mb-4">Top marcas por valor de custo</h3>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : byBrand.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de marca.</p>
          ) : (
            <div className="space-y-3">
              {byBrand.map((b) => (
                <div key={b.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold truncate">{b.name}</span>
                    <span className="font-black tabular-nums">{fmtBRL(b.cost)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-info" style={{ width: `${Math.max(4, (b.cost / maxBrandCost) * 100)}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{b.units} unidades</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Listagem */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            {([
              ["all", "Todos"],
              ["ok", "OK"],
              ["low", "Baixo"],
              ["out", "Zerado"],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`px-3 h-8 text-[11px] font-black uppercase rounded-lg transition ${
                  statusFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-bold"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "Todas categorias" : c}
              </option>
            ))}
          </select>
          <div className="text-xs text-muted-foreground font-bold">{filtered.length} item(ns)</div>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhum produto encontrado.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left pl-5 py-2">Produto</th>
                  <th className="text-right py-2">Estoque</th>
                  <th className="text-right py-2">Custo un.</th>
                  <th className="text-right py-2">Preço un.</th>
                  <th className="text-right py-2">Valor custo</th>
                  <th className="text-right pr-5 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((p) => {
                  const q = Number(p.stock_quantity || 0);
                  const status =
                    q <= 0 ? "out" : p.min_stock && q <= Number(p.min_stock) ? "low" : "ok";
                  return (
                    <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="py-2.5 pl-5">
                        <div className="font-bold truncate max-w-[280px]">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.sku ? `SKU: ${p.sku} · ` : ""}
                          {p.category}
                          {p.brand ? ` · ${p.brand}` : ""}
                        </div>
                      </td>
                      <td className="text-right tabular-nums font-bold">{q}</td>
                      <td className="text-right tabular-nums">{fmtBRL(Number(p.cost_price || 0))}</td>
                      <td className="text-right tabular-nums">{fmtBRL(Number(p.price || 0))}</td>
                      <td className="text-right tabular-nums font-bold">
                        {fmtBRL(q * Number(p.cost_price || 0))}
                      </td>
                      <td className="text-right pr-5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            status === "ok"
                              ? "border-success/40 text-success"
                              : status === "low"
                                ? "border-warning/40 text-warning"
                                : "border-destructive/40 text-destructive"
                          }`}
                        >
                          {status === "ok" ? "OK" : status === "low" ? "Baixo" : "Zerado"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p className="text-[10px] text-muted-foreground text-center pt-3">
                Exibindo primeiros 200 de {filtered.length}. Refine os filtros ou exporte CSV.
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
          <div className="text-lg font-black truncate tabular-nums" title={value}>
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
