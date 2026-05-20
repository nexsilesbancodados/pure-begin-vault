import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
  DollarSign,
  CheckCircle2,
  ArrowLeftRight,
  X,
  Save,
  Eraser,
  Settings2,
  Plus,
  Trash2,
  Paperclip,
  FileText,
  Info,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SupplierPicker } from "@/components/estoque/SupplierPicker";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Package, User as UserIcon, Upload, File as FileIcon, Calendar, Tag, CreditCard, Hash } from "lucide-react";
import { toast } from "sonner";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void> | void;
  expense?: any;
  /** Pre-set type: "expense" (default) or "income" */
  variant?: "expense" | "income";
}

const DEFAULT_CATEGORIES = [
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
  { value: "debit", label: "Cartão de Débito" },
  { value: "credit", label: "Cartão de Crédito" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

const BILLING_METHODS = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "deposito", label: "Depósito" },
  { value: "dinheiro", label: "Dinheiro" },
];

type Payment = {
  id: string;
  method: string;
  installments: string;
  amount: string;
  date: string;
  cashbox: string;
};

function parseNum(s: string) {
  return parseFloat((s || "").toString().replace(/\./g, "").replace(",", ".")) || 0;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ExpenseForm({
  open,
  onOpenChange,
  onSave,
  expense,
  variant = "expense",
}: ExpenseFormProps) {
  const isExpense = variant === "expense";
  const titleNoun = isExpense ? "Despesa" : "Receita";

  const [tab, setTab] = useState<"dados" | "arquivos" | "detalhes">("dados");
  const [saving, setSaving] = useState(false);
  const { orgId } = useOrg();
  const [people, setPeople] = useState<any[]>([]);
  const [searchPerson, setSearchPerson] = useState("");
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [personPopoverOpen, setPersonPopoverOpen] = useState(false);

  const todayISO = () => new Date().toISOString().split("T")[0];
  const cashboxDefault = `Caixa do dia ${new Date().toLocaleDateString("pt-BR")} - Sistema`;

  const blankForm = () => ({
    title: "",
    person: "",
    due_date: todayISO(),
    competence_date: todayISO(),
    status: "pending" as "pending" | "paid",
    category: "",
    billing_method: "",
    installment_number: "",
    tags: "",
    notes: "",
    amount: "",
    fees: "",
    discount: "",
    payment_method: "",
    payment_amount: "",
    installments: "",
    cashbox: cashboxDefault,
  });

  const [form, setForm] = useState(blankForm());
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    async function loadPeople() {
      if (!orgId || !open) return;
      setLoadingPeople(true);
      
      // Load both customers and suppliers to have a broad "Person" list
      const [customersRes, suppliersRes] = await Promise.all([
        supabase.from("customers").select("id, name, email").eq("organization_id", orgId).limit(50),
        supabase.from("suppliers").select("id, name, email").eq("organization_id", orgId).limit(50)
      ]);

      const combined = [
        ...(customersRes.data || []).map(c => ({ ...c, type: 'cliente' })),
        ...(suppliersRes.data || []).map(s => ({ ...s, type: 'fornecedor' }))
      ].sort((a, b) => a.name.localeCompare(b.name));

      setPeople(combined);
      setLoadingPeople(false);
    }
    loadPeople();
  }, [orgId, open]);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        title: expense.description || "",
        person: expense.supplier || "",
        due_date: expense.due_date
          ? new Date(expense.due_date).toISOString().split("T")[0]
          : todayISO(),
        competence_date: expense.competence_date || todayISO(),
        status: expense.status === "paid" ? "paid" : "pending",
        category: expense.category || "",
        billing_method: expense.billing_method || "",
        installment_number: expense.installment_number || "",
        tags: expense.tags || "",
        notes: expense.notes_clean || expense.notes || "",
        amount: expense.amount != null ? String(expense.amount).replace(".", ",") : "",
        fees: "",
        discount: "",
        payment_method: expense.payment_method || "",
        payment_amount: "",
        installments: "",
        cashbox: cashboxDefault,
      });
    } else {
      setForm(blankForm());
      setPayments([]);
    }
    setTab("dados");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  const totals = useMemo(() => {
    const base = parseNum(form.amount);
    const fees = parseNum(form.fees);
    const discount = parseNum(form.discount);
    const total = Math.max(0, base + fees - discount);
    const paid =
      payments.reduce((s, p) => s + parseNum(p.amount), 0) +
      (form.status === "paid" && payments.length === 0 ? parseNum(form.payment_amount || form.amount) : 0);
    const balance = total - paid;
    return { total, paid, balance };
  }, [form, payments]);

  const addPayment = () => {
    setPayments((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        method: form.payment_method || "pix",
        installments: form.installments || "1",
        amount: form.payment_amount || "",
        date: todayISO(),
        cashbox: form.cashbox,
      },
    ]);
    setForm((f) => ({ ...f, payment_amount: "", installments: "" }));
  };

  const removePayment = (id: string) =>
    setPayments((arr) => arr.filter((p) => p.id !== id));

  const reset = () => {
    setForm(blankForm());
    setPayments([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) return;
    setSaving(true);
    try {
      await onSave({
        description: form.title.trim(),
        amount: totals.total || parseNum(form.amount),
        category: form.category || null,
        supplier: form.person.trim() || null,
        due_date: form.due_date || null,
        payment_date:
          form.status === "paid"
            ? new Date().toISOString()
            : null,
        payment_method: form.payment_method || null,
        status: form.status,
        notes: form.notes.trim() || null,
        // extras packed by parent into notes
        competence_date: form.competence_date,
        billing_method: form.billing_method,
        installment_number: form.installment_number,
        tags: form.tags,
        fees: parseNum(form.fees),
        discount: parseNum(form.discount),
        payments,
        transaction_date: form.due_date || new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 rounded-2xl overflow-hidden gap-0 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 via-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between text-white">
          <h2 className="text-lg font-black font-display tracking-tight">
            {expense ? `Editar ${titleNoun}` : `Nova ${titleNoun}`}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 grid place-items-center rounded-full border border-white/40 hover:bg-white/15 transition"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5 bg-muted/30">
            <SummaryCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Valor Total"
              value={brl(totals.total)}
              tone="emerald"
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Total do Pagamento"
              value={brl(totals.paid)}
              tone="emerald"
            />
            <SummaryCard
              icon={<ArrowLeftRight className="h-5 w-5" />}
              label="Saldo"
              value={brl(totals.balance)}
              tone={totals.balance > 0 ? "amber" : "emerald"}
            />
          </div>

          {/* Tabs */}
          <div className="px-5 border-b border-border bg-card">
            <div className="flex gap-1">
              <TabBtn active={tab === "dados"} onClick={() => setTab("dados")} icon={<FileText className="h-4 w-4" />}>
                Dados gerais
              </TabBtn>
              <TabBtn active={tab === "arquivos"} onClick={() => setTab("arquivos")} icon={<Paperclip className="h-4 w-4" />}>
                Arquivos
              </TabBtn>
              <TabBtn active={tab === "detalhes"} onClick={() => setTab("detalhes")} icon={<Info className="h-4 w-4" />}>
                Detalhes
              </TabBtn>
            </div>
          </div>

          {tab === "dados" && (
            <div className="p-5 space-y-6">
              {/* Row 1: Título + Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
                <Field required label="Título">
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    autoFocus
                    className="h-10"
                    placeholder="Ex: Aluguel do escritório"
                  />
                </Field>
                <Field required label="Tipo de financeiro">
                  <div className="h-10 rounded-md border border-input bg-muted/60 px-3 flex items-center text-sm">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold",
                      isExpense ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", isExpense ? "bg-red-500" : "bg-emerald-500")} />
                      {titleNoun}
                    </span>
                  </div>
                </Field>
              </div>

              {/* Row 2: Pessoa + Datas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Pessoa (Fornecedor / Cliente)">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Popover open={personPopoverOpen} onOpenChange={setPersonPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full h-10 justify-between font-normal bg-card hover:bg-accent/50"
                          >
                            <span className="truncate">
                              {form.person || "Selecionar pessoa..."}
                            </span>
                            <Users className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[400px]" align="start">
                          <div className="p-2 border-b">
                            <Input 
                              placeholder="Pesquisar por nome ou e-mail..."
                              value={searchPerson}
                              onChange={(e) => setSearchPerson(e.target.value)}
                              className="h-9"
                              autoFocus
                            />
                          </div>
                          <ScrollArea className="h-64">
                            <div className="p-1">
                              {loadingPeople ? (
                                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                                </div>
                              ) : people.filter(p => 
                                p.name.toLowerCase().includes(searchPerson.toLowerCase()) || 
                                p.email?.toLowerCase().includes(searchPerson.toLowerCase())
                              ).length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  Nenhuma pessoa encontrada
                                </div>
                              ) : (
                                people.filter(p => 
                                  p.name.toLowerCase().includes(searchPerson.toLowerCase()) || 
                                  p.email?.toLowerCase().includes(searchPerson.toLowerCase())
                                ).map((p) => (
                                  <button
                                    key={`${p.type}-${p.id}`}
                                    type="button"
                                    onClick={() => {
                                      setForm({ ...form, person: p.name });
                                      setPersonPopoverOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-accent rounded-md flex items-center justify-between gap-2 group"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{p.name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tight">{p.type} {p.email ? `• ${p.email}` : ''}</p>
                                    </div>
                                    <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                          <div className="p-2 border-t bg-muted/30">
                            <div className="grid grid-cols-1 gap-1">
                              <p className="text-[10px] text-muted-foreground px-2 mb-1 font-bold uppercase">Cadastrar Novo</p>
                              <div className="flex gap-2">
                                <SupplierPicker 
                                  value="" 
                                  onChange={(name) => {
                                    setForm({ ...form, person: name });
                                    setPersonPopoverOpen(false);
                                  }}
                                  placeholder="Novo Fornecedor"
                                />
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </Field>
                <Field required label="Data de vencimento">
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="h-10"
                    required
                  />
                </Field>
                <Field required label="Data de competência">
                  <Input
                    type="date"
                    value={form.competence_date}
                    onChange={(e) => setForm({ ...form, competence_date: e.target.value })}
                    className="h-10"
                    required
                  />
                </Field>
              </div>

              {/* Row 3: Situação + Categoria + Forma cobrança + Parcela */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field required label="Situação">
                  <Select
                    value={form.status}
                    onValueChange={(v: "pending" | "paid") => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Em aberto
                        </span>
                      </SelectItem>
                      <SelectItem value="paid">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {isExpense ? "Pago" : "Recebido"}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Categoria">
                  <div className="flex gap-2">
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 text-emerald-600 border-emerald-500/40">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
                <Field label="Forma de cobrança">
                  <Select value={form.billing_method} onValueChange={(v) => setForm({ ...form, billing_method: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Número da Parcela">
                  <Input
                    value={form.installment_number}
                    onChange={(e) => setForm({ ...form, installment_number: e.target.value })}
                    placeholder="Ex: 1/12"
                    className="h-10"
                  />
                </Field>
              </div>

              {/* Row 4: Tags + Observações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tags">
                  <Input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="Separadas por vírgula"
                    className="h-10"
                  />
                </Field>
                <Field label="Observações">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="Notas adicionais"
                  />
                </Field>
              </div>

              {/* Section: Valores do lançamento */}
              <SectionTitle>Valores do lançamento</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field required label="Valor (R$)">
                  <Input
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.,]/g, "") })}
                    placeholder="0,00"
                    className="h-10 tabular-nums"
                    required
                  />
                </Field>
                <Field label="Multa/Juros">
                  <Input
                    value={form.fees}
                    onChange={(e) => setForm({ ...form, fees: e.target.value.replace(/[^\d.,]/g, "") })}
                    placeholder="0,00"
                    className="h-10 tabular-nums"
                  />
                </Field>
                <Field label="Desconto">
                  <Input
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value.replace(/[^\d.,]/g, "") })}
                    placeholder="0,00"
                    className="h-10 tabular-nums"
                  />
                </Field>
                <Field label="Valor Total (R$)">
                  <Input
                    readOnly
                    value={brl(totals.total)}
                    className="h-10 tabular-nums bg-muted/60 font-bold"
                  />
                </Field>
              </div>

              {/* Section: Valores do Pagamento */}
              <SectionTitle>Valores do Pagamento</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field required label="Forma de pagamento">
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field required label="Valor do pagamento (R$)">
                  <Input
                    value={form.payment_amount}
                    onChange={(e) => setForm({ ...form, payment_amount: e.target.value.replace(/[^\d.,]/g, "") })}
                    placeholder="0,00"
                    className="h-10 tabular-nums"
                  />
                </Field>
                <Field label="Número de parcelas">
                  <Select value={form.installments} onValueChange={(v) => setForm({ ...form, installments: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                        <SelectItem key={n} value={n}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Caixa">
                  <Input
                    value={form.cashbox}
                    onChange={(e) => setForm({ ...form, cashbox: e.target.value })}
                    className="h-10"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
                  ▸ Mais informações
                </button>
                <Button type="button" size="sm" onClick={addPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar pagamento
                </Button>
              </div>

              {/* Payments table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-bold">Forma de pagamento</th>
                      <th className="text-left px-4 py-2.5 font-bold">Número de parcelas</th>
                      <th className="text-right px-4 py-2.5 font-bold">Valor Pagamento (R$)</th>
                      <th className="text-left px-4 py-2.5 font-bold">Data do pagamento</th>
                      <th className="text-left px-4 py-2.5 font-bold">Caixa</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                          Nenhum pagamento adicionado · 0
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-4 py-2.5">{PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}</td>
                          <td className="px-4 py-2.5">{p.installments}x</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold">{brl(parseNum(p.amount))}</td>
                          <td className="px-4 py-2.5">{new Date(p.date + "T00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="px-4 py-2.5 truncate max-w-[200px]">{p.cashbox}</td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => removePayment(p.id)}
                              className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "arquivos" && (
            <div className="p-10 text-center text-muted-foreground">
              <Paperclip className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Anexos serão habilitados em breve.</p>
            </div>
          )}

          {tab === "detalhes" && (
            <div className="p-10 text-center text-muted-foreground">
              <Info className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Detalhes adicionais serão exibidos aqui.</p>
            </div>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !form.title.trim() || !form.amount} className="bg-blue-600 hover:bg-blue-700 text-white h-10">
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="h-10 text-red-600 border-red-500/30 hover:bg-red-500/10">
                <Eraser className="h-4 w-4 mr-1.5" />
                Limpar formulário
              </Button>
            </div>
            <Button type="button" variant="ghost" className="h-10 text-muted-foreground">
              <Settings2 className="h-4 w-4 mr-1.5" />
              Configurar campos
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold mb-1.5 block">
        {required && <span className="text-red-500 mr-0.5">*</span>}
        {label}
      </Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-1.5">
      <h3 className="text-sm font-bold text-foreground">{children}</h3>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-semibold border-b-2 transition flex items-center gap-1.5",
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red";
}) {
  const map = {
    emerald: "bg-emerald-500 text-white",
    amber: "bg-amber-500 text-white",
    red: "bg-red-500 text-white",
  } as const;
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
      <div className={cn("h-11 w-11 rounded-lg grid place-items-center shrink-0", map[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-black tabular-nums truncate">R$ {value}</div>
      </div>
    </div>
  );
}
