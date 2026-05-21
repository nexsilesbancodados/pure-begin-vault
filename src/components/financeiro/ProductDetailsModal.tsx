import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Pencil, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string | null;
  fallback?: Record<string, unknown> | null;
  onEdit?: () => void;
}

const BRL = (v: unknown) =>
  v == null || v === ""
    ? "—"
    : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtVal = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

const HIDE_KEYS = new Set([
  "id",
  "organization_id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "active",
  "deleted_at",
  "metadata",
  "embedding",
  "search_vector",
]);

const LABELS: Record<string, string> = {
  name: "Nome",
  sku: "SKU",
  ean: "EAN",
  reference: "Referência",
  brand: "Marca",
  model: "Modelo",
  category: "Categoria",
  supplier: "Fornecedor",
  price: "Preço de Venda",
  cost_price: "Custo",
  wholesale_price: "Atacado",
  stock_quantity: "Estoque",
  min_stock: "Estoque Mínimo",
  unit: "Unidade",
  description: "Descrição",
  imei: "IMEI",
  imei2: "IMEI 2",
  color: "Cor",
  capacity: "Capacidade",
  storage: "Armazenamento",
  processor: "Processador",
  ram: "RAM",
  display: "Tela",
  battery_health: "Saúde da Bateria",
  bateria: "Saúde da Bateria",
  condition: "Condição",
  estado: "Estado",
  warranty: "Garantia",
  origem: "Origem",
  tipo: "Tipo",
  gigas: "GB",
};

const MONEY_KEYS = new Set(["price", "cost_price", "wholesale_price"]);

export function ProductDetailsModal({ open, onOpenChange, productId, fallback, onEdit }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        setData((row as Record<string, unknown>) ?? fallback ?? null);
      } catch (e) {
        if (!cancelled) {
          setData(fallback ?? null);
          toast.error("Não foi possível buscar o produto: " + (e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, productId, fallback]);

  const merged: Record<string, unknown> = { ...(fallback ?? {}), ...(data ?? {}) };
  const metadata =
    merged.metadata && typeof merged.metadata === "object"
      ? (merged.metadata as Record<string, unknown>)
      : {};

  // Flatten: top-level + metadata, metadata loses to top-level if both present
  const flat: Record<string, unknown> = { ...metadata, ...merged };

  const entries = Object.entries(flat)
    .filter(([k, v]) => !HIDE_KEYS.has(k) && v !== null && v !== undefined && v !== "")
    .sort(([a], [b]) => {
      const order = [
        "name",
        "brand",
        "model",
        "category",
        "tipo",
        "sku",
        "ean",
        "reference",
        "imei",
        "imei2",
        "color",
        "capacity",
        "storage",
        "gigas",
        "condition",
        "estado",
        "battery_health",
        "bateria",
        "processor",
        "ram",
        "display",
        "price",
        "cost_price",
        "wholesale_price",
        "stock_quantity",
        "min_stock",
        "supplier",
        "unit",
        "warranty",
        "description",
      ];
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  const copy = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* noop */
    }
  };

  const name = (merged.name as string) ?? "Produto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {name}
          </DialogTitle>
          <DialogDescription>
            Detalhes completos do produto cadastrado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando dados do produto...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Sem dados adicionais para este produto.
            </div>
          ) : (
            <>
              {/* Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                {[
                  { k: "imei", label: "IMEI" },
                  { k: "color", label: "Cor" },
                  { k: "capacity", label: "Capacidade", alt: "storage" },
                  { k: "battery_health", label: "Bateria", alt: "bateria" },
                ].map(({ k, label, alt }) => {
                  const v = flat[k] ?? (alt ? flat[alt] : undefined);
                  if (v == null || v === "") return null;
                  return (
                    <div
                      key={k}
                      className="rounded-xl border bg-muted/40 px-3 py-2"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </div>
                      <div className="text-sm font-semibold truncate font-mono">
                        {String(v)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border divide-y">
                {entries.map(([k, v]) => {
                  const label = LABELS[k] ?? k.replace(/_/g, " ");
                  const value = MONEY_KEYS.has(k) ? BRL(v) : fmtVal(v);
                  const isImei = k === "imei" || k === "imei2";
                  const isCopyable = isImei || k === "sku" || k === "ean";
                  return (
                    <div
                      key={k}
                      className="grid grid-cols-[140px_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <div className="text-xs uppercase tracking-wider text-muted-foreground capitalize">
                        {label}
                      </div>
                      <div
                        className={
                          isImei || k === "sku" || k === "ean"
                            ? "font-mono text-foreground break-all"
                            : "text-foreground break-words"
                        }
                      >
                        {value}
                      </div>
                      {isCopyable ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copy(k, String(v))}
                          title="Copiar"
                        >
                          {copied === k ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>

              {merged.stock_quantity != null && (
                <div className="mt-4 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      Number(merged.stock_quantity) > 0
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : "border-rose-500/40 text-rose-700 dark:text-rose-400"
                    }
                  >
                    {Number(merged.stock_quantity) > 0
                      ? `Em estoque: ${merged.stock_quantity}`
                      : "Esgotado"}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" /> Editar produto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
