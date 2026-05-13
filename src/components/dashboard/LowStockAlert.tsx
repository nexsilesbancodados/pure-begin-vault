import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

type LowItem = {
  id: string;
  name: string;
  stock_quantity: number;
  min_stock: number | null;
};

export function LowStockAlert({ compact = false }: { compact?: boolean }) {
  const { orgId } = useOrg();
  const [items, setItems] = useState<LowItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from("products")
      .select("id, name, stock_quantity, min_stock")
      .eq("organization_id", orgId)
      .eq("active", true)
      .not("min_stock", "is", null)
      .order("stock_quantity", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        const low = ((data as LowItem[]) ?? []).filter(
          (p) => p.min_stock != null && p.stock_quantity <= p.min_stock,
        );
        setItems(low);
        setLoading(false);
      });
  }, [orgId]);

  if (loading || items.length === 0) return null;

  const zerados = items.filter((p) => p.stock_quantity <= 0).length;
  const baixos = items.length - zerados;

  if (compact) {
    return (
      <Link
        to="/estoque/atual"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 hover:bg-warning/20 border border-warning/30 text-warning text-xs font-bold transition"
      >
        <AlertTriangle className="h-3 w-3" />
        {items.length} produto{items.length > 1 ? "s" : ""} c/ estoque baixo
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black">Estoque crítico</h3>
            <p className="text-xs text-muted-foreground">
              {zerados > 0 && `${zerados} esgotado(s) · `}
              {baixos} abaixo do mínimo
            </p>
          </div>
        </div>
        <Link
          to="/estoque/atual"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {items.slice(0, 6).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card border border-border"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-bold truncate">{p.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs shrink-0">
              <span
                className={
                  p.stock_quantity <= 0 ? "text-destructive font-black" : "text-warning font-black"
                }
              >
                {p.stock_quantity}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{p.min_stock}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
