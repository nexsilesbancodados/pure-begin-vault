import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const LS_KEY = "conectaphone:manager-pin";
const LS_LIMIT_KEY = "conectaphone:auto-approve-limit";

export function getManagerPin(): string {
  return localStorage.getItem(LS_KEY) ?? "";
}
export function setManagerPin(pin: string) {
  localStorage.setItem(LS_KEY, pin);
}
export function getAutoApproveLimit(): number {
  const v = parseFloat(localStorage.getItem(LS_LIMIT_KEY) ?? "5");
  return isNaN(v) ? 5 : v;
}
export function setAutoApproveLimit(percent: number) {
  localStorage.setItem(LS_LIMIT_KEY, String(percent));
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  discountPercent: number;
  saleValue: number;
  discountValue: number;
  onApproved: () => void;
}

export function DiscountApprovalDialog({
  open,
  onOpenChange,
  discountPercent,
  saleValue,
  discountValue,
  onApproved,
}: Props) {
  const [pin, setPin] = useState("");
  const expected = getManagerPin();

  const submit = () => {
    if (!expected) {
      toast.error("PIN do gerente não configurado em Configurações");
      return;
    }
    if (pin !== expected) {
      toast.error("PIN incorreto");
      return;
    }
    onApproved();
    setPin("");
    onOpenChange(false);
    toast.success("Desconto autorizado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-warning" />
            Autorização de desconto
          </DialogTitle>
          <DialogDescription>
            Desconto acima do limite. Solicite ao gerente o PIN.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-bold">Desconto solicitado</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Valor venda</p>
                <p className="font-black">R$ {saleValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Desconto</p>
                <p className="font-black text-destructive">- R$ {discountValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">%</p>
                <p className="font-black">{discountPercent.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="manager-pin">PIN do gerente</Label>
            <Input
              id="manager-pin"
              type="password"
              inputMode="numeric"
              placeholder="****"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Autorizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
