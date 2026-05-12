import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShoppingCart, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useNavigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/EmptyState";

type Product = {
  id: string;
  name: string;
  stock_quantity: number;
  min_stock: number | null;
};

export function Stockouts() {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSales, setLastSales] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const { data: prods } = await (supabase as any)
        .from("products")
        .select("id, name, stock_quantity, min_stock")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("stock_quantity", { ascending: true })
        .limit(500);

      const list = (prods ?? []) as Product[];

      // Última venda por produto via stock_movements (saída)
      if (list.length > 0) {
        const ids = list.map((p) => p.id);
        const { data: movs } = await (supabase as any)
          .from("stock_movements")
          .select("product_id, created_at")
          .eq("organization_id", orgId)
          .in("product_id", ids)
          .in("movement_type", ["out", "saida"])
          .order("created_at", { ascending: false })
          .limit(2000);
        const map = new Map<string, string>();
        for (const m of (movs ?? []) as any[]) {
          if (!map.has(m.product_id)) map.set(m.product_id, m.created_at);
        }
        setLastSales(map);
      }

      setProducts(list);
      setLoading(false);
    })();
  }, [orgId]);

  const stockouts = useMemo(
    () => products.filter((p) => p.stock_quantity === 0),
    [products]
  );
  const critical = useMemo(
    () => products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock ?? 0)),
    [products]
  );

  const all = [...stockouts, ...critical];

  if (loading) {
    return <Card className="p-12"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" /> Produtos sem Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stockouts.length} {stockouts.length === 1 ? "item" : "itens"}</div>
            <p className="text-xs text-red-600/70">Necessitam reposição imediata</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <TrendingDown className="h-4 w-4" /> Estoque Crítico (Abaixo do Mínimo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{critical.length} {critical.length === 1 ? "item" : "itens"}</div>
            <p className="text-xs text-orange-600/70">Abaixo do nível de segurança</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reposição Necessária</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {all.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Estoque saudável"
              description="Nenhum produto está em estoque crítico ou esgotado. Você pode configurar o estoque mínimo de cada produto no catálogo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última saída</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {all.map((p) => {
                  const lastSold = lastSales.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-center">
                        <span className={p.stock_quantity === 0 ? "text-red-600 font-bold" : "text-orange-600 font-bold"}>
                          {p.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{p.min_stock ?? "—"}</TableCell>
                      <TableCell>
                        {p.stock_quantity === 0 ? (
                          <Badge variant="destructive">Esgotado</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Crítico</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastSold ? new Date(lastSold).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="gap-2" onClick={() => navigate({ to: "/estoque/movimentacoes" })}>
                          <ShoppingCart className="h-3 w-3" /> Repor
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
