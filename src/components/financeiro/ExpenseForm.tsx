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
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [files, setFiles] = useState<{ id: string; name: string; size: number; type: string }[]>([]);

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

  // When status flips to "paid", auto-fill payment amount and a default method
  useEffect(() => {
    if (form.status === "paid" && !form.payment_amount && form.amount) {
      setForm((f) => ({
        ...f,
        payment_amount: f.amount,
        payment_method: f.payment_method || "pix",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o título");
      setTab("dados");
      return;
    }
    if (!form.amount || parseNum(form.amount) <= 0) {
      toast.error("Informe um valor maior que zero");
      setTab("dados");
      return;
    }
    if (form.status === "paid" && !form.payment_method) {
      toast.error("Selecione a forma de pagamento");
      return;
    }
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
        files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
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
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Popover open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 text-emerald-600 border-emerald-500/40" title="Adicionar categoria">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="end">
                        <Label className="text-xs font-semibold mb-1.5 block">Nova categoria</Label>
                        <Input
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          placeholder="Ex: Manutenção"
                          className="h-9 mb-2"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const name = newCategory.trim();
                              if (!name) return;
                              if (!categories.includes(name)) setCategories((arr) => [...arr, name]);
                              setForm((f) => ({ ...f, category: name }));
                              setNewCategory("");
                              setNewCategoryOpen(false);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const name = newCategory.trim();
                            if (!name) return;
                            if (!categories.includes(name)) setCategories((arr) => [...arr, name]);
                            setForm((f) => ({ ...f, category: name }));
                            setNewCategory("");
                            setNewCategoryOpen(false);
                          }}
                        >
                          Adicionar
                        </Button>
                      </PopoverContent>
                    </Popover>
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
                    onChange={(e) => {
                      const next = e.target.value.replace(/[^\d.,]/g, "");
                      setForm((f) => {
                        const shouldMirror = !f.payment_amount || f.payment_amount === f.amount;
                        return { ...f, amount: next, payment_amount: shouldMirror ? next : f.payment_amount };
                      });
                    }}
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
            <div className="p-5 space-y-4">
              <label
                htmlFor="expense-files"
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-10 cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/5 transition"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold">Clique para anexar arquivos</p>
                <p className="text-xs text-muted-foreground">Comprovantes, NFs, boletos (PDF, PNG, JPG)</p>
                <input
                  id="expense-files"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    if (!list.length) return;
                    setFiles((arr) => [
                      ...arr,
                      ...list.map((f) => ({
                        id: crypto.randomUUID(),
                        name: f.name,
                        size: f.size,
                        type: f.type,
                      })),
                    ]);
                    toast.success(`${list.length} arquivo(s) anexado(s)`);
                    e.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-9 w-9 rounded-lg bg-blue-500/15 text-blue-600 grid place-items-center">
                        <FileIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((arr) => arr.filter((x) => x.id !== f.id))}
                        className="text-red-600 hover:bg-red-500/10 p-2 rounded-md"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "detalhes" && (
            <div className="p-5 space-y-3">
              <SectionTitle>Resumo do lançamento</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DetailRow icon={<FileText className="h-4 w-4" />} label="Título" value={form.title || "—"} />
                <DetailRow icon={<UserIcon className="h-4 w-4" />} label="Pessoa" value={form.person || "—"} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Vencimento" value={form.due_date ? new Date(form.due_date + "T00:00").toLocaleDateString("pt-BR") : "—"} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Competência" value={form.competence_date ? new Date(form.competence_date + "T00:00").toLocaleDateString("pt-BR") : "—"} />
                <DetailRow icon={<Tag className="h-4 w-4" />} label="Categoria" value={form.category || "—"} />
                <DetailRow icon={<Tag className="h-4 w-4" />} label="Tags" value={form.tags || "—"} />
                <DetailRow icon={<CreditCard className="h-4 w-4" />} label="Forma de cobrança" value={BILLING_METHODS.find((b) => b.value === form.billing_method)?.label || "—"} />
                <DetailRow icon={<Hash className="h-4 w-4" />} label="Parcela" value={form.installment_number || "—"} />
                <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Valor base" value={`R$ ${brl(parseNum(form.amount))}`} />
                <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Multa/Juros" value={`R$ ${brl(parseNum(form.fees))}`} />
                <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Desconto" value={`R$ ${brl(parseNum(form.discount))}`} />
                <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Valor total" value={`R$ ${brl(totals.total)}`} highlight />
                <DetailRow icon={<CheckCircle2 className="h-4 w-4" />} label="Total pago" value={`R$ ${brl(totals.paid)}`} />
                <DetailRow icon={<ArrowLeftRight className="h-4 w-4" />} label="Saldo" value={`R$ ${brl(totals.balance)}`} highlight />
                <DetailRow icon={<Paperclip className="h-4 w-4" />} label="Anexos" value={files.length ? `${files.length} arquivo(s)` : "—"} />
                <DetailRow icon={<Info className="h-4 w-4" />} label="Pagamentos" value={payments.length ? `${payments.length} lançado(s)` : "—"} />
              </div>
              {form.notes && (
                <>
                  <SectionTitle>Observações</SectionTitle>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/40 rounded-lg p-3">{form.notes}</p>
                </>
              )}
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

function DetailRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border border-border px-3 py-2.5",
      highlight ? "bg-blue-500/5 border-blue-500/30" : "bg-card"
    )}>
      <div className="h-8 w-8 rounded-lg grid place-items-center bg-muted text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-sm font-semibold truncate", highlight && "text-blue-700 dark:text-blue-300")}>{value}</div>
      </div>
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
