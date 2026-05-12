import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  ScanLine,
  AlertCircle,
  CheckCircle2,
  Save,
  Plus,
  Minus,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/inventario")({
  component: InventarioPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  stock_quantity: number;
  location: string | null;
};

type CountRow = {
  product: Product;
  counted: number;
  diff: number;
};

function InventarioPage() {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("products")
      .select("id, name, sku, ean, stock_quantity, location")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name")
      .limit(2000)
      .then(({ data }) => {
        setProducts((data as Product[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const handleScan = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    const found = products.find(
      (p) => p.ean === clean || p.sku === clean || p.id === clean
    );
    if (!found) {
      toast.error(`Código não encontrado: ${clean}`);
      setScan("");
      return;
    }
    setCounts((m) => {
      const next = new Map(m);
      next.set(found.id, (next.get(found.id) ?? 0) + 1);
      return next;
    });
    setScan("");
    scanRef.current?.focus();
  };

  const adjustCount = (productId: string, delta: number) => {
    setCounts((m) => {
      const next = new Map(m);
      const cur = next.get(productId) ?? 0;
      const newVal = Math.max(0, cur + delta);
      next.set(productId, newVal);
      return next;
    });
  };

  const setCount = (productId: string, value: number) => {
    setCounts((m) => {
      const next = new Map(m);
      next.set(productId, Math.max(0, value));
      return next;
    });
  };

  const rows: CountRow[] = useMemo(() => {
    return Array.from(counts.entries()).map(([id, counted]) => {
      const product = products.find((p) => p.id === id);
      if (!product) return null as any;
      return { product, counted, diff: counted - product.stock_quantity };
    }).filter(Boolean);
  }, [counts, products]);

  const stats = useMemo(() => {
    const matches = rows.filter((r) => r.diff === 0).length;
    const surplus = rows.filter((r) => r.diff > 0).length;
    const shortage = rows.filter((r) => r.diff < 0).length;
    return { contados: rows.length, matches, surplus, shortage };
  }, [rows]);

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) =>
        [p.name, p.sku, p.ean, p.location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [products, search]);

  const applyAll = async () => {
    if (!orgId || !user?.id) return;
    if (rows.length === 0) { toast.error("Nada contado"); return; }
    if (!confirm(`Aplicar ${rows.length} ajuste(s) ao estoque?`)) return;

    setSaving(true);
    let ok = 0;
    let fail = 0;
    for (const r of rows) {
      if (r.diff === 0) { ok += 1; continue; }
      try {
        const { error } = await supabase
          .from("products")
          .update({ stock_quantity: r.counted })
          .eq("id", r.product.id);
        if (error) throw error;

        await supabase.from("stock_movements" as any).insert({
          organization_id: orgId,
          user_id: user.id,
          product_id: r.product.id,
          movement_type: r.diff > 0 ? "in" : "out",
          quantity: Math.abs(r.diff),
          reason: "ajuste",
          reference_type: "inventario",
          notes: `Inventário ${new Date().toLocaleDateString("pt-BR")}: ${r.product.stock_quantity} → ${r.counted}`,
        });
        ok += 1;
      } catch (e) {
        fail += 1;
      }
    }
    setSaving(false);
    toast.success(`Ajustes aplicados: ${ok} ok, ${fail} falharam`);
    setCounts(new Map());
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Inventário" subtitle="Contagem física e ajuste de estoque" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Bipar produto
            </h3>
            <div className="flex gap-2">
              <Input
                ref={scanRef}
                placeholder="EAN, SKU ou ID — bipa com o leitor ou digita"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScan(scan);
                }}
                className="text-lg font-bold"
                autoFocus
              />
              <Button onClick={() => handleScan(scan)}>Adicionar</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cada vez que bipar/Enter, soma +1 ao produto. Pode ajustar manual depois.
            </p>
          </Card>

          <Card className="p-5">
            <Label>Buscar e contar manualmente</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome, SKU, EAN ou local..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filteredAll.length > 0 && (
              <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
                {filteredAll.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCounts((m) => {
                        const next = new Map(m);
                        if (!next.has(p.id)) next.set(p.id, 0);
                        return next;
                      });
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {p.sku ?? "—"} · saldo sistema: {p.stock_quantity}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={ClipboardList} label="Contados" value={stats.contados} color="primary" />
            <Kpi icon={CheckCircle2} label="Bate" value={stats.matches} color="success" />
            <Kpi icon={Plus} label="Sobra" value={stats.surplus} color="primary" />
            <Kpi icon={AlertCircle} label="Falta" value={stats.shortage} color="destructive" />
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-sm uppercase tracking-widest">
                Lista de contagem ({rows.length})
              </h3>
              <Button
                onClick={applyAll}
                disabled={rows.length === 0 || saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Aplicando..." : `Aplicar ${rows.length} ajustes`}
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando produtos...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Comece bipando ou buscando produtos acima.
              </p>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div
                    key={r.product.id}
                    className={`flex items-center gap-2 p-3 rounded-xl border ${
                      r.diff === 0
                        ? "border-success/30 bg-success/5"
                        : r.diff > 0
                        ? "border-warning/30 bg-warning/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{r.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {r.product.sku ?? "—"} · Sistema: {r.product.stock_quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustCount(r.product.id, -1)}
                        className="h-8 w-8 rounded-lg bg-muted hover:bg-muted-foreground/10 grid place-items-center"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        value={r.counted}
                        onChange={(e) => setCount(r.product.id, parseInt(e.target.value) || 0)}
                        className="w-16 h-8 text-center font-black"
                      />
                      <button
                        onClick={() => adjustCount(r.product.id, 1)}
                        className="h-8 w-8 rounded-lg bg-muted hover:bg-muted-foreground/10 grid place-items-center"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <Badge
                      className={
                        r.diff === 0
                          ? "bg-success/15 text-success"
                          : r.diff > 0
                          ? "bg-warning/15 text-warning"
                          : "bg-destructive/15 text-destructive"
                      }
                    >
                      {r.diff > 0 ? `+${r.diff}` : r.diff}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "primary" | "success" | "warning" | "destructive";
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="text-xl font-black truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
