import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/vendas/consulta-estoque")({
  component: ConsultaEstoquePage,
});

type Product = {
  id: string;
  name: string;
  model: string | null;
  brand: string | null;
  sku: string | null;
  ean: string | null;
  category: string;
  price: number;
  stock_quantity: number;
  min_stock: number | null;
  location: string | null;
  has_imei: boolean;
  active: boolean;
};

function ConsultaEstoquePage() {
  const { orgId, loading: orgLoading } = useOrg();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from("products")
      .select(
        "id, name, model, brand, sku, ean, category, price, stock_quantity, min_stock, location, has_imei, active",
      )
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        setItems((data as Product[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.name, p.model, p.brand, p.sku, p.ean, p.category, p.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Consulta de Estoque" subtitle="Disponibilidade em tempo real" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, modelo, marca, SKU, EAN, categoria ou local..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {orgLoading || loading
                ? "Carregando..."
                : `${filtered.length} de ${items.length} produtos`}
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => {
              const baixo = p.min_stock != null && p.stock_quantity <= p.min_stock;
              const zero = p.stock_quantity <= 0;
              return (
                <Card key={p.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm leading-tight truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.brand, p.model].filter(Boolean).join(" · ") || p.category}
                      </p>
                    </div>
                    {zero ? (
                      <Badge variant="destructive" className="shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Esgotado
                      </Badge>
                    ) : baixo ? (
                      <Badge className="bg-warning text-warning-foreground shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Baixo
                      </Badge>
                    ) : (
                      <Badge className="bg-success/15 text-success border-success/30 shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Disponível
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-end justify-between mt-1">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {p.sku && (
                        <div>
                          SKU: <span className="font-mono">{p.sku}</span>
                        </div>
                      )}
                      {p.location && <div>Local: {p.location}</div>}
                      {p.has_imei && <div>Controla IMEI</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Saldo
                      </div>
                      <div
                        className={`text-2xl font-black ${zero ? "text-destructive" : baixo ? "text-warning" : "text-foreground"}`}
                      >
                        {p.stock_quantity}
                      </div>
                      <div className="text-xs text-primary font-bold mt-0.5">
                        R$ {p.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
            {!loading && filtered.length === 0 && (
              <Card className="col-span-full p-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold">Nenhum produto encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search
                    ? "Refine sua busca ou cadastre novos produtos em Estoque."
                    : "Cadastre seus produtos em Estoque para consultá-los aqui."}
                </p>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
