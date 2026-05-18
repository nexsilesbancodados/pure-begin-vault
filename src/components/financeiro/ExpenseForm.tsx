import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingDown,
  DollarSign,
  Calendar,
  Tag,
  User,
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void> | void;
  expense?: any;
  /** Pre-set type: "expense" (default) or "income" */
  variant?: "expense" | "income";
}

const CATEGORIES = [
  "Despesa",
  "Compras",
  "Folha de pagamento",
  "Logística",
  "Marketing",
  "Operacional",
  "Aluguel",
  "Energia",
  "Internet/Telefone",
  "Impostos",
  "Outros",
];

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

export function ExpenseForm({
  open,
  onOpenChange,
  onSave,
  expense,
  variant = "expense",
}: ExpenseFormProps) {
  const isExpense = variant === "expense";
  const title = isExpense ? "Despesa" : "Receita";
  const titleArt = isExpense ? "uma despesa" : "uma receita";

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: isExpense ? "Despesa" : "Vendas",
    supplier: "",
    due_date: new Date().toISOString().split("T")[0],
    payment_date: "",
    payment_method: "pix",
    status: "pending" as "pending" | "paid",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        description: expense.description || "",
        amount: String(expense.amount ?? ""),
        category: expense.category || (isExpense ? "Despesa" : "Vendas"),
        supplier: expense.supplier || "",
        due_date: expense.due_date
          ? new Date(expense.due_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        payment_date: expense.payment_date
          ? new Date(expense.payment_date).toISOString().split("T")[0]
          : "",
        payment_method: expense.payment_method || "pix",
        status: expense.status === "paid" ? "paid" : "pending",
        notes: expense.notes || "",
      });
    } else {
      setForm({
        description: "",
        amount: "",
        category: isExpense ? "Despesa" : "Vendas",
        supplier: "",
        due_date: new Date().toISOString().split("T")[0],
        payment_date: "",
        payment_method: "pix",
        status: "pending",
        notes: "",
      });
    }
  }, [open, expense, isExpense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      await onSave({
        description: form.description.trim(),
        amount: parseFloat(form.amount.replace(",", ".")) || 0,
        category: form.category,
        supplier: form.supplier.trim() || null,
        due_date: form.due_date || null,
        payment_date:
          form.status === "paid"
            ? form.payment_date || new Date().toISOString()
            : null,
        payment_method: form.payment_method,
        status: form.status,
        notes: form.notes.trim() || null,
        transaction_date: form.due_date || new Date().toISOString(),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const accent = isExpense
    ? { bg: "bg-red-500", text: "text-red-600 dark:text-red-400", soft: "bg-red-500/10" }
    : { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-500/10" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 rounded-2xl overflow-hidden gap-0">
        {/* Header */}
        <div className={cn("p-6 text-white relative overflow-hidden", isExpense ? "bg-gradient-to-br from-red-500 to-rose-600" : "bg-gradient-to-br from-emerald-500 to-teal-600")}>
          <div className="absolute -top-8 -right-8 opacity-20">
            <TrendingDown className="h-40 w-40" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-black font-display flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md grid place-items-center">
                {isExpense ? <TrendingDown className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
              </div>
              {expense ? `Editar ${title}` : `Cadastrar ${titleArt}`}
            </DialogTitle>
            <DialogDescription className="text-white/85 mt-1">
              Preencha os campos abaixo para {expense ? "atualizar" : "registrar"} {titleArt} no
              caixa.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Status toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, status: "pending" }))}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition",
                form.status === "pending"
                  ? "bg-amber-500 text-white shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock className="h-4 w-4" /> Pendente
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, status: "paid" }))}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition",
                form.status === "paid"
                  ? "bg-emerald-500 text-white shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CheckCircle2 className="h-4 w-4" /> {isExpense ? "Pago" : "Recebido"}
            </button>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <FileText className="h-3.5 w-3.5" /> Título / Descrição *
            </Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={isExpense ? "Ex: Compra de aparelhos, Aluguel..." : "Ex: Venda balcão, Serviço..."}
              required
              autoFocus
              className="h-11"
            />
          </div>

          {/* Amount + due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Valor *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                  R$
                </span>
                <Input
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value.replace(/[^\d.,]/g, "") })
                  }
                  placeholder="0,00"
                  required
                  className={cn("h-11 pl-10 text-lg font-bold tabular-nums", accent.text)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3.5 w-3.5" /> Vencimento
              </Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          {/* Category + supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Tag className="h-3.5 w-3.5" /> Categoria
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <User className="h-3.5 w-3.5" /> {isExpense ? "Fornecedor" : "Cliente"}
              </Label>
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Nome..."
                className="h-11"
              />
            </div>
          </div>

          {/* Payment method + payment date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Forma de pagamento
              </Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.status === "paid" && (
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Data do pagamento
                </Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  className="h-11"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <FileText className="h-3.5 w-3.5" /> Observações
            </Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas adicionais (opcional)"
              rows={3}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            <div className={cn("flex-1 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2", accent.soft, accent.text)}>
              <DollarSign className="h-4 w-4" />
              Total:{" "}
              <span className="text-lg ml-1 tabular-nums">
                R${" "}
                {(parseFloat(form.amount.replace(",", ".")) || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-11 rounded-xl"
            >
              <X className="h-4 w-4 mr-1.5" /> Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.description.trim() || !form.amount}
              className={cn("h-11 rounded-xl font-bold text-white shadow-md", accent.bg, "hover:opacity-90")}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Salvando..." : expense ? "Atualizar" : `Cadastrar ${title.toLowerCase()}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
