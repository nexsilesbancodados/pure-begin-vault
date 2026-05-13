import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const REASONS_IN = ["compra", "ajuste", "devolucao", "transferencia"];
const REASONS_OUT = ["venda", "perda", "avaria", "ajuste", "transferencia"];

export function StockMovementForm({ open, onOpenChange, onSaved }: Props) {
  const { orgId, userId } = useOrg();
  const [products, setProducts] = useState<{ id: string; name: string; stock_quantity?: number }[]>(
    [],
  );
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [reason, setReason] = useState<string>("compra");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("id, name, stock_quantity")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("name")
        .limit(500);
      setProducts(data ?? []);
    })();
  }, [open, orgId]);

  useEffect(() => {
    // Ajusta razão default quando troca tipo
    setReason(type === "entrada" ? REASONS_IN[0] : REASONS_OUT[0]);
  }, [type]);

  const save = async () => {
    if (!orgId || !userId) return toast.error("Sem organização");
    if (!productId) return toast.error("Selecione um produto");
    if (quantity <= 0) return toast.error("Quantidade deve ser > 0");
    setSaving(true);

    const qty = type === "entrada" ? quantity : -quantity;
    const { error: movErr } = await (supabase as any).from("stock_movements").insert({
      organization_id: orgId,
      user_id: userId,
      product_id: productId,
      movement_type: type === "entrada" ? "in" : "out",
      quantity: Math.abs(quantity),
      unit_cost: unitCost || null,
      reason,
      notes: notes || null,
    });

    if (movErr) {
      setSaving(false);
      return toast.error("Erro: " + movErr.message);
    }

    // Atualiza stock_quantity do produto
    const current = products.find((p) => p.id === productId);
    const newQty = Math.max(0, (current?.stock_quantity ?? 0) + qty);
    await (supabase as any)
      .from("products")
      .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", productId);

    setSaving(false);
    toast.success(
      `${type === "entrada" ? "Entrada" : "Saída"} registrada. Estoque atual: ${newQty}`,
    );
    setProductId("");
    setQuantity(0);
    setUnitCost(0);
    setNotes("");
    onOpenChange(false);
    onSaved?.();
  };

  const reasons = type === "entrada" ? REASONS_IN : REASONS_OUT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Entrada / Saída de Mercadoria</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (estoque: {p.stock_quantity ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Quantidade</Label>
            <Input
              type="number"
              min={1}
              className="col-span-3"
              value={quantity || ""}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
          </div>
          {type === "entrada" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Custo unit.</Label>
              <Input
                type="number"
                step="0.01"
                className="col-span-3"
                value={unitCost || ""}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                placeholder="R$ 0,00"
              />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Observações</Label>
            <Textarea
              className="col-span-3"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !productId || quantity <= 0}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
