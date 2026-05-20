import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Search, ShoppingCart, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaleRow {
  id: string;
  sale_number: number | null;
  total_amount: number | null;
  created_at: string;
  customer_id: string | null;
  customer_name?: string | null;
  payment_method?: string | null;
}

interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  imei: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_cost: number | null;
  total: number | null;
  metadata: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  userId: string | null;
  nextNoteNumber: number;
  onCreated: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function SalesNoteModal({
  open,
  onOpenChange,
  orgId,
  userId,
  nextNoteNumber,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [items, setItems] = useState<Record<string, SaleItem[]>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dataVenda, setDataVenda] = useState(todayISO());
  const [prazo, setPrazo] = useState(plusDaysISO(7));
  const [saving, setSaving] = useState(false);

  // Auto recompute prazo when dataVenda changes
  useEffect(() => {
    if (!dataVenda) return;
    const d = new Date(dataVenda);
    d.setDate(d.getDate() + 7);
    setPrazo(d.toISOString().slice(0, 10));
  }, [dataVenda]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Pull already-assigned sale ids to filter them out
      const { data: existing } = await supabase
        .from("purchase_notes" as never)
        .select("sale_ids")
        .eq("organization_id", orgId)
        .eq("kind", "venda");
      const taken = new Set<string>();
      ((existing ?? []) as Array<{ sale_ids?: string[] | null }>).forEach((r) => {
        (r.sale_ids ?? []).forEach((id) => taken.add(id));
      });

      const { data: salesData, error } = await supabase
        .from("sales_orders")
        .select("id, sale_number, total_amount, created_at, customer_id, payment_method")
        .eq("organization_id", orgId)
        .eq("channel", "pdv")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = ((salesData ?? []) as SaleRow[]).filter((s) => !taken.has(s.id));
      const customerIds = Array.from(
        new Set(rows.map((r) => r.customer_id).filter((v): v is string => !!v)),
      );
      let customerMap = new Map<string, string>();
      if (customerIds.length) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds);
        customerMap = new Map(
          ((customers ?? []) as Array<{ id: string; name: string | null }>).map((c) => [
            c.id,
            c.name ?? "",
          ]),
        );
      }
      const enriched = rows.map((r) => ({
        ...r,
        customer_name: r.customer_id ? (customerMap.get(r.customer_id) ?? "") : "",
      }));
      setSales(enriched);

      if (rows.length) {
        const { data: itemsData } = await supabase
          .from("sale_items")
          .select(
            "id, sale_id, product_id, product_name, sku, imei, quantity, unit_price, unit_cost, total, metadata",
          )
          .in(
            "sale_id",
            rows.map((r) => r.id),
          );
        const grouped: Record<string, SaleItem[]> = {};
        ((itemsData ?? []) as SaleItem[]).forEach((it) => {
          (grouped[it.sale_id] ||= []).push(it);
        });
        setItems(grouped);
      } else {
        setItems({});
      }
    } catch (e) {
      toast.error("Erro ao carregar vendas: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (open) {
      setSelected({});
      setCustomerName("");
      setDataVenda(todayISO());
      void load();
    }
  }, [open, load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const s = search.toLowerCase();
    return sales.filter(
      (r) =>
        String(r.sale_number ?? "").includes(s) ||
        (r.customer_name ?? "").toLowerCase().includes(s) ||
        (r.payment_method ?? "").toLowerCase().includes(s),
    );
  }, [sales, search]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const selectedSales = sales.filter((s) => selected[s.id]);
  const total = selectedSales.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const itemCount = selectedSales.reduce(
    (sum, s) => sum + (items[s.id]?.reduce((a, b) => a + Number(b.quantity ?? 0), 0) ?? 0),
    0,
  );

  // Auto-suggest customer based on first selected sale
  useEffect(() => {
    if (!customerName && selectedSales.length === 1 && selectedSales[0].customer_name) {
      setCustomerName(selectedSales[0].customer_name);
    }
  }, [selectedSales, customerName]);

  const confirm = async () => {
    if (!orgId) return;
    if (selectedIds.length === 0) {
      toast.error("Selecione ao menos uma venda do PDV.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      // Build items array (one entry per sale item)
      const noteItems = selectedSales.flatMap((s) =>
        (items[s.id] ?? []).map((it) => ({
          id: it.product_id || it.id,
          name: it.product_name ?? "Produto",
          organization_id: orgId,
          sku: it.sku,
          imei: it.imei,
          price: Number(it.unit_price ?? 0),
          cost_price: Number(it.unit_cost ?? 0),
          stock_quantity: null,
          metadata: {
            sale_id: s.id,
            sale_number: s.sale_number,
            quantity: it.quantity,
            line_total: it.total,
          },
        })),
      );

      let attempt = nextNoteNumber;
      for (let i = 0; i < 5; i++) {
        const { error } = await supabase.from("purchase_notes" as never).insert({
          organization_id: orgId,
          note_number: attempt,
          kind: "venda",
          customer_name: customerName.trim(),
          fornecedor: customerName.trim(),
          sale_ids: selectedIds,
          items: noteItems,
          total,
          data_compra: dataVenda,
          prazo_pagamento: prazo,
          paga: false,
          created_by: userId,
          updated_by: userId,
        } as never);
        if (!error) {
          toast.success(`Nota de venda ${attempt} criada. Prazo de pagamento: ${prazo}.`);
          onCreated();
          onOpenChange(false);
          return;
        }
        if ((error as { code?: string }).code !== "23505") {
          toast.error("Erro ao criar nota: " + error.message);
          return;
        }
        attempt += 1;
      }
      toast.error("Não foi possível gerar a numeração da nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Cadastrar Nota de Venda (Prazo 7 dias)
          </DialogTitle>
          <DialogDescription>
            Selecione vendas concluídas no PDV para registrar como nota a receber do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Cliente</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Data da venda</Label>
            <Input
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Vencimento (prazo 7 dias)</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nº da venda, cliente ou forma de pagamento..."
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando vendas do PDV...
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Nenhuma venda do PDV disponível</p>
              <p className="text-xs text-muted-foreground mt-1">
                Todas as vendas já estão vinculadas a uma nota ou não há vendas concluídas.
              </p>
            </Card>
          ) : (
            filtered.map((s) => {
              const checked = !!selected[s.id];
              const its = items[s.id] ?? [];
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSelected((p) => ({ ...p, [s.id]: !p[s.id] }))}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    checked
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                        checked ? "bg-primary border-primary" : "border-border"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">
                          Venda #{s.sale_number ?? s.id.slice(0, 6)}
                          {s.customer_name && (
                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                              · {s.customer_name}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-primary">
                          R$ {Number(s.total_amount ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                        {s.payment_method && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {s.payment_method}
                          </Badge>
                        )}
                      </div>
                      {its.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                          {its.slice(0, 3).map((it) => (
                            <div key={it.id} className="truncate">
                              • {it.quantity ?? 1}x {it.product_name}
                              {it.imei && (
                                <span className="ml-1 text-[10px] text-primary">
                                  IMEI {it.imei}
                                </span>
                              )}
                            </div>
                          ))}
                          {its.length > 3 && <div>+{its.length - 3} item(ns)...</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="border-t pt-3 flex-row items-center justify-between sm:justify-between">
          <div className="text-sm">
            <span className="font-semibold">{selectedIds.length}</span> venda(s) ·{" "}
            <span className="font-semibold">{itemCount}</span> item(ns) ·{" "}
            <span className="font-bold text-primary">R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={confirm}
              disabled={saving || selectedIds.length === 0 || !customerName.trim()}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Nota de Venda
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
