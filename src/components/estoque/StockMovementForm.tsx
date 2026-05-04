import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StockMovementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockMovementForm({ open, onOpenChange }: StockMovementFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Entrada / Saída de Mercadoria</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Tipo</Label>
            <Select defaultValue="entrada">
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (Compra/Ajuste)</SelectItem>
                <SelectItem value="saida">Saída (Avaria/Perda)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Produto</Label>
            <Select>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Buscar produto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">iPhone 15 Pro Max</SelectItem>
                <SelectItem value="2">Samsung S24 Ultra</SelectItem>
                <SelectItem value="3">Capa Silicone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Quantidade</Label>
            <Input type="number" className="col-span-3" placeholder="0" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Custo Un.</Label>
            <Input type="number" className="col-span-3" placeholder="R$ 0,00" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Observação</Label>
            <Textarea className="col-span-3" placeholder="Motivo da movimentação..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onOpenChange(false)}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}