import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import {
  Hourglass,
  X,
  Calendar,
  CheckCircle2,
  DollarSign,
  Plus,
  RefreshCw,
  List,
  Filter,
  Eraser,
  LayoutGrid,
  Wrench,
  Search,
  ChevronRight,
  Home,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { format, isBefore, isToday, isAfter, startOfDay, addDays, subDays } from "date-fns";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro/receitas")({
  component: ReceitasPage,
});

type IncomeOrigin = "sale" | "deposit" | "transfer" | "manual";

type Income = {
  id: string;
  description: string;
  title: string;
  person: string | null;
  category: string | null;
  amount: number;
  status: string | null;
  due_date: string | null;
  payment_date: string | null;
  transaction_date: string | null;
  supplier?: string | null;
  metadata?: any;
  reference_type?: string | null;
  reference_id?: string | null;
  customer_id?: string | null;
  source_table: "receivable" | "transaction" | "cash_movement" | "sale";
  origin: IncomeOrigin;
  payment_method?: string | null;
  notes?: string | null;
  type: string;
};

const ORIGIN_LABEL: Record<IncomeOrigin, string> = {
  sale: "Venda",
  deposit: "Depósito",
  transfer: "Transferência",
  manual: "Manual",
};

const ORIGIN_STYLE: Record<IncomeOrigin, string> = {
  sale: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deposit: "bg-blue-50 text-blue-700 ring-blue-200",
  transfer: "bg-violet-50 text-violet-700 ring-violet-200",
  manual: "bg-slate-100 text-slate-600 ring-slate-200",
};

const inferOrigin = (params: {
  reference_type?: string | null;
  category?: string | null;
  payment_method?: string | null;
  description?: string | null;
}): IncomeOrigin => {
  const ref = (params.reference_type || "").toLowerCase();
  if (ref === "sale" || ref === "sales_order") return "sale";
  const blob = `${params.category || ""} ${params.payment_method || ""} ${params.description || ""}`.toLowerCase();
  if (/transfer|transferência|transferencia|ted|doc|pix.*transfer/.test(blob)) return "transfer";
  if (/dep[óo]sito|deposit/.test(blob)) return "deposit";
  if (ref === "deposit") return "deposit";
  if (ref === "transfer") return "transfer";
  return "manual";
};

const EXPENSE_CATEGORY_RE =
  /^(marketing|public[ií]?dade|log[ií]?stica|insumo|insumos|uniforme|aluguel|sal[áa]rio|fornecedor|fornecedores|compra|despesa|imposto|taxa|combust[ií]vel|energia|[áa]gua|internet|telefone)/i;

const isExpenseLikeIncome = (t: {
  category?: string | null;
  description?: string | null;
  reference_type?: string | null;
}) => {
  if ((t.reference_type || "").toLowerCase().includes("sale")) return false;
  const cat = (t.category || "").trim();
  if (cat && EXPENSE_CATEGORY_RE.test(cat)) return true;
  return false;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const noteField = (notes: string | null | undefined, label: string) => {
  const line = (notes || "").split("\n").find((l) => l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : null;
};

// Extrai nome do cliente de descrições "CLIENTE: NOME" ou "Algo · NOME"
const extractPerson = (description: string | null | undefined): string | null => {
  if (!description) return null;
  const m = description.match(/^\s*(?:cliente|client|customer)\s*[:\-]\s*(.+)$/i);
  if (m) return m[1].trim();
  if (description.includes(" · ")) return description.split(" · ").slice(1).join(" · ").trim();
  return null;
};

// Limpa título removendo prefixo "CLIENTE:" para evitar duplicação com Pessoa
const buildTitle = (params: {
  description: string | null | undefined;
  reference_type?: string | null;
  origin: IncomeOrigin;
  category?: string | null;
  saleNumber?: string | number | null;
}) => {
  const desc = (params.description || "").trim();
  const ref = (params.reference_type || "").toLowerCase();
  if (ref.includes("sale")) {
    return params.saleNumber ? `Venda #${params.saleNumber}` : "Venda";
  }
  if (/^\s*(cliente|client|customer)\s*[:\-]/i.test(desc)) {
    if (params.origin === "sale") return "Venda";
    if (params.category && params.category !== "income" && params.category !== "sales") return params.category;
    return "Receita avulsa";
  }
  if (desc.includes(" · ")) return desc.split(" · ")[0].trim();
  return desc || params.category || ORIGIN_LABEL[params.origin];
};

// Padroniza forma de pagamento
type PayKey = "pix" | "cash" | "credit" | "debit" | "crediario" | "boleto" | "transfer" | "other";

const normalizeMethod = (raw: string | null | undefined): PayKey => {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "other";
  if (/pix/.test(s)) return "pix";
  if (/(esp[ée]cie|dinheiro|cash|money)/.test(s)) return "cash";
  if (/(d[ée]bito|debit)/.test(s)) return "debit";
  if (/(cr[ée]dito|credit)/.test(s)) return "credit";
  if (/(credi[áa]rio|prazo|carn[êe]|parcelad|7d)/.test(s)) return "crediario";
  if (/(boleto|bank_slip)/.test(s)) return "boleto";
  if (/(transfer|ted|doc)/.test(s)) return "transfer";
  return "other";
};

const PAY_META: Record<PayKey, { label: string; grad: string; ring: string; text: string; chip: string }> = {
  pix:       { label: "PIX",            grad: "from-teal-500 to-emerald-500",     ring: "ring-teal-200",     text: "text-teal-700",    chip: "bg-teal-50" },
  cash:      { label: "Espécie",        grad: "from-emerald-500 to-green-600",    ring: "ring-emerald-200",  text: "text-emerald-700", chip: "bg-emerald-50" },
  credit:    { label: "Cartão Crédito", grad: "from-indigo-500 to-violet-600",    ring: "ring-indigo-200",   text: "text-indigo-700",  chip: "bg-indigo-50" },
  debit:     { label: "Cartão Débito",  grad: "from-sky-500 to-blue-600",         ring: "ring-sky-200",      text: "text-sky-700",     chip: "bg-sky-50" },
  crediario: { label: "Crediário",      grad: "from-amber-500 to-orange-500",     ring: "ring-amber-200",    text: "text-amber-700",   chip: "bg-amber-50" },
  boleto:    { label: "Boleto",         grad: "from-slate-500 to-slate-700",      ring: "ring-slate-200",    text: "text-slate-700",   chip: "bg-slate-100" },
  transfer:  { label: "Transferência",  grad: "from-violet-500 to-purple-600",    ring: "ring-violet-200",   text: "text-violet-700",  chip: "bg-violet-50" },
  other:     { label: "Outros",         grad: "from-slate-400 to-slate-500",      ring: "ring-slate-200",    text: "text-slate-600",   chip: "bg-slate-50" },
};

function ReceitasPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const today = new Date();
  const [from, setFrom] = useState(format(subDays(today, 260), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(addDays(today, 365), "yyyy-MM-dd"));
  const [quickFilter, setQuickFilter] = useState("");
  const [fId, setFId] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fTitulo, setFTitulo] = useState("");
  const [fSituacao, setFSituacao] = useState("");
  const [fPessoa, setFPessoa] = useState("");
  const [fMethod, setFMethod] = useState<PayKey | "">("");

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const receivableBase = supabase.from("accounts_receivable").select("*");
      const transactionBase = supabase
        .from("finance_transactions")
        .select("*")
        .eq("type", "income");
      const cashBase = supabase
        .from("cash_register_movements")
        .select("*")
        .in("type", ["deposit", "transfer_in", "sale", "deposito", "transferencia"]);
      const salesBase = supabase
        .from("sales_orders")
        .select("id,total_amount,status,created_at,customer_id,sale_number,payment_method,notes")
        .in("status", ["completed", "concluded", "paid", "concluído", "pago"]);

      const scoped = (q: any) =>
        orgId ? q.eq("organization_id", orgId) : q.eq("user_id", user.id);

      const [receivableRes, txRes, cashRes, salesRes] = await Promise.all([
        scoped(receivableBase).order("due_date", { ascending: false, nullsFirst: false }),
        scoped(transactionBase).order("transaction_date", { ascending: false, nullsFirst: false }),
        scoped(cashBase).order("created_at", { ascending: false, nullsFirst: false }),
        scoped(salesBase).order("created_at", { ascending: false, nullsFirst: false }),
      ]);
      if (receivableRes.error) throw receivableRes.error;
      if (txRes.error) throw txRes.error;

      const receivables: Income[] = ((receivableRes.data as any[]) || []).map((r) => {
        const person = noteField(r.notes, "Cliente") || extractPerson(r.description);
        const origin: IncomeOrigin = r.sale_id ? "sale" : "manual";
        return {
          id: r.id,
          description: r.description,
          title: buildTitle({
            description: r.description,
            reference_type: r.sale_id ? "sale" : "manual",
            origin,
            category: r.category,
          }),
          person,
          category: r.sale_id ? "sales" : "income",
          amount: Number(r.amount) || 0,
          status: r.status || "pending",
          due_date: r.due_date,
          payment_date: r.paid_at,
          transaction_date: r.paid_at || r.due_date,
          supplier: person,
          reference_type: r.sale_id ? "sale" : "manual",
          reference_id: r.sale_id || null,
          customer_id: r.customer_id || null,
          source_table: "receivable",
          origin,
          payment_method: r.payment_method || null,
          notes: r.notes,
          type: "income",
        };
      });
      const receivableSaleIds = new Set(
        receivables.map((r) => r.reference_id).filter(Boolean) as string[],
      );

      const transactions: Income[] = ((txRes.data as any[]) || [])
        .filter(
          (t) =>
            !(t.reference_type === "sale" && t.reference_id && receivableSaleIds.has(t.reference_id)),
        )
        .filter((t) => !isExpenseLikeIncome(t))
        .map((t) => {
          const person = extractPerson(t.description);
          const origin = inferOrigin({
            reference_type: t.reference_type,
            category: t.category,
            payment_method: t.payment_method,
            description: t.description,
          });
          return {
            id: t.id,
            description: t.description,
            title: buildTitle({ description: t.description, reference_type: t.reference_type, origin, category: t.category }),
            person,
            category: t.category,
            amount: Number(t.amount) || 0,
            status: "paid",
            due_date: t.transaction_date,
            payment_date: t.transaction_date,
            transaction_date: t.transaction_date,
            supplier: person,
            reference_type: t.reference_type,
            reference_id: t.reference_id,
            source_table: "transaction",
            origin,
            payment_method: t.payment_method || null,
            type: "income",
          };
        });

      const cashMovements: Income[] = !cashRes.error
        ? ((cashRes.data as any[]) || [])
            .filter((m) => !(m.reference_type === "sale" && m.reference_id && receivableSaleIds.has(m.reference_id)))
            .map((m) => {
              const t = String(m.type || "").toLowerCase();
              const origin: IncomeOrigin =
                t === "transfer_in" || t === "transferencia"
                  ? "transfer"
                  : t === "sale"
                  ? "sale"
                  : "deposit";
              return {
                id: m.id,
                description: m.description || ORIGIN_LABEL[origin],
                title: ORIGIN_LABEL[origin],
                person: extractPerson(m.description),
                category: "caixa",
                amount: Number(m.amount) || 0,
                status: "paid",
                due_date: m.created_at,
                payment_date: m.created_at,
                transaction_date: m.created_at,
                supplier: null,
                reference_type: m.reference_type || origin,
                reference_id: m.reference_id || null,
                source_table: "cash_movement",
                origin,
                payment_method: m.payment_method || null,
                type: "income",
              };
            })
        : [];

      // Mapa de pagamentos de venda para descobrir customer + payment_method por sale_id
      // Para vendas vindas do sales_orders direto (sem receivable)
      const sales: Income[] = !salesRes.error
        ? ((salesRes.data as any[]) || [])
            .filter((s) => !receivableSaleIds.has(s.id))
            .map((s) => {
              const person = extractPerson(s.notes);
              return {
                id: `sale:${s.id}`,
                description: `Venda #${s.sale_number ?? String(s.id).slice(0, 6).toUpperCase()}`,
                title: `Venda #${s.sale_number ?? String(s.id).slice(0, 6).toUpperCase()}`,
                person,
                category: "sales",
                amount: Number(s.total_amount) || 0,
                status: "paid",
                due_date: s.created_at,
                payment_date: s.created_at,
                transaction_date: s.created_at,
                supplier: person,
                reference_type: "sale",
                reference_id: s.id,
                customer_id: s.customer_id || null,
                source_table: "sale",
                origin: "sale",
                payment_method: s.payment_method || null,
                type: "income",
              };
            })
        : [];

      setItems([...receivables, ...transactions, ...cashMovements, ...sales]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar receitas");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (data: any) => {
    if (!user?.id) return;
    try {
      const payload = { ...data, type: "income" };
      if (editing) {
        const table = editing.source_table === "receivable" ? "accounts_receivable" : "finance_transactions";
        const receivablePayload = {
          description: payload.description,
          amount: payload.amount,
          due_date: payload.due_date || payload.transaction_date,
          status: payload.status,
          paid_at: payload.status === "paid" ? payload.payment_date || new Date().toISOString() : null,
          paid_amount: payload.status === "paid" ? payload.amount : null,
          notes: payload.notes,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from(table as any)
          .update(table === "accounts_receivable" ? receivablePayload : { ...payload, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Receita atualizada!");
      } else {
        const { error } = await supabase.from("finance_transactions").insert([
          { ...payload, user_id: user.id, organization_id: orgId },
        ]);
        if (error) throw error;
        toast.success("Receita criada!");
      }
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar receita");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta receita?")) return;
    const item = items.find((it) => it.id === id);
    const table = item?.source_table === "receivable" ? "accounts_receivable" : "finance_transactions";
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Receita excluída");
    fetchData();
  };

  const kpis = useMemo(() => {
    const t = startOfDay(new Date());
    let receberHoje = 0,
      vencidos = 0,
      aReceber = 0,
      recebidos = 0,
      total = 0;
    items.forEach((it) => {
      const amount = Number(it.amount) || 0;
      const valorPendente = it.status !== "paid" ? amount : 0;
      total += amount;
      if (it.status === "paid") {
        recebidos += amount;
      } else if (it.due_date) {
        const d = startOfDay(new Date(it.due_date));
        if (isToday(d)) receberHoje += valorPendente;
        else if (isBefore(d, t)) vencidos += valorPendente;
        else if (isAfter(d, t)) aReceber += valorPendente;
      } else {
        aReceber += valorPendente;
      }
    });
    return { receberHoje, vencidos, aReceber, recebidos, total };
  }, [items]);

  const filtered = useMemo(() => {
    const fromD = from ? startOfDay(new Date(from)) : null;
    const toD = to ? startOfDay(new Date(to)) : null;
    return items.filter((it) => {
      if (it.due_date && fromD && toD) {
        const d = startOfDay(new Date(it.due_date));
        if (isBefore(d, fromD) || isAfter(d, toD)) return false;
      }
      if (fId && !String(it.id).toLowerCase().includes(fId.toLowerCase())) return false;
      if (fCategoria && !ORIGIN_LABEL[(it.origin || "manual") as IncomeOrigin].toLowerCase().includes(fCategoria.toLowerCase()))
        return false;
      if (fOrigem) {
        if ((it.origin || "manual") !== fOrigem) return false;
      }
      if (fTitulo) {
        const hay = `${it.title || ""} ${it.description || ""}`.toLowerCase();
        if (!hay.includes(fTitulo.toLowerCase())) return false;
      }
      if (fSituacao) {
        const s = (it.status || "pending").toLowerCase();
        if (!s.includes(fSituacao.toLowerCase())) return false;
      }
      if (fPessoa && !((it.person || it.supplier || "") as string).toLowerCase().includes(fPessoa.toLowerCase()))
        return false;
      if (fMethod && normalizeMethod(it.payment_method) !== fMethod) return false;
      if (quickFilter === "vencidos") {
        if (it.status === "paid") return false;
        if (!it.due_date) return false;
        if (!isBefore(startOfDay(new Date(it.due_date)), startOfDay(new Date()))) return false;
      } else if (quickFilter === "hoje") {
        if (it.status === "paid") return false;
        if (!it.due_date || !isToday(new Date(it.due_date))) return false;
      } else if (quickFilter === "recebidos") {
        if (it.status !== "paid") return false;
      } else if (quickFilter === "a_receber") {
        if (it.status === "paid") return false;
        if (!it.due_date) return true;
        if (!isAfter(startOfDay(new Date(it.due_date)), startOfDay(new Date()))) return false;
      }
      return true;
    });
  }, [items, from, to, fId, fOrigem, fCategoria, fTitulo, fSituacao, fPessoa, fMethod, quickFilter]);

  const visible = filtered.slice(0, pageSize);

  // Breakdown por forma de pagamento (somente recebidos no período filtrado)
  const methodBreakdown = useMemo(() => {
    const acc: Record<PayKey, { total: number; count: number }> = {
      pix: { total: 0, count: 0 },
      cash: { total: 0, count: 0 },
      credit: { total: 0, count: 0 },
      debit: { total: 0, count: 0 },
      crediario: { total: 0, count: 0 },
      boleto: { total: 0, count: 0 },
      transfer: { total: 0, count: 0 },
      other: { total: 0, count: 0 },
    };
    filtered.forEach((it) => {
      if (it.status !== "paid") return;
      const k = normalizeMethod(it.payment_method);
      acc[k].total += Number(it.amount) || 0;
      acc[k].count += 1;
    });
    return acc;
  }, [filtered]);

  const clearFilters = () => {
    setQuickFilter("");
    setFId("");
    setFOrigem("");
    setFCategoria("");
    setFTitulo("");
    setFSituacao("");
    setFPessoa("");
    setFMethod("");
    setFrom(format(subDays(new Date(), 260), "yyyy-MM-dd"));
    setTo(format(addDays(new Date(), 365), "yyyy-MM-dd"));
  };

  const kpiCards = [
    { label: "Recebem hoje", value: kpis.receberHoje, icon: Hourglass, key: "hoje", tone: "blue" as const },
    { label: "Vencidos", value: kpis.vencidos, icon: X, key: "vencidos", tone: "red" as const },
    { label: "A receber", value: kpis.aReceber, icon: Calendar, key: "a_receber", tone: "amber" as const },
    { label: "Recebidos", value: kpis.recebidos, icon: CheckCircle2, key: "recebidos", tone: "emerald" as const },
    { label: "Total no período", value: kpis.total, icon: DollarSign, key: "", tone: "dark" as const },
  ];

  const toneStyles: Record<string, { border: string; accent: string; chip: string }> = {
    blue: { border: "border-l-blue-500", accent: "text-blue-600", chip: "bg-blue-50 text-blue-600" },
    red: { border: "border-l-red-500", accent: "text-red-600", chip: "bg-red-50 text-red-600" },
    amber: { border: "border-l-amber-500", accent: "text-amber-600", chip: "bg-amber-50 text-amber-600" },
    emerald: { border: "border-l-emerald-500", accent: "text-emerald-600", chip: "bg-emerald-50 text-emerald-600" },
    dark: { border: "border-l-slate-700", accent: "text-white", chip: "bg-white/10 text-white" },
  };

  const statusBadge = (status: string | null, due: string | null) => {
    const base = "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset";
    if (status === "paid")
      return <span className={cn(base, "bg-emerald-50 text-emerald-700 ring-emerald-200")}>Recebido</span>;
    if (due) {
      const d = startOfDay(new Date(due));
      const t = startOfDay(new Date());
      if (isBefore(d, t))
        return <span className={cn(base, "bg-red-50 text-red-700 ring-red-200")}>Vencido</span>;
      if (isToday(d))
        return <span className={cn(base, "bg-amber-50 text-amber-700 ring-amber-200")}>Recebe hoje</span>;
    }
    return <span className={cn(base, "bg-blue-50 text-blue-700 ring-blue-200")}>A receber</span>;
  };


  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Receitas"
          subtitle="Gerencie todas as receitas e contas a receber"
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Home className="h-3.5 w-3.5" />
            <span>Financeiro</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-900 font-semibold">Receitas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              const active = quickFilter === k.key && k.key !== "";
              const t = toneStyles[k.tone];
              const isDark = k.tone === "dark";
              return (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => k.key && setQuickFilter(quickFilter === k.key ? "" : k.key)}
                  className={cn(
                    "group relative text-left rounded-xl border border-slate-200 border-l-4 p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5",
                    t.border,
                    isDark ? "bg-slate-900 text-white" : "bg-white",
                    active && "ring-2 ring-emerald-500/40",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-slate-300" : "text-slate-500")}>
                        {k.label}
                      </p>
                      <p className={cn("text-2xl font-bold mt-1 tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                        R$ {fmt(k.value)}
                      </p>
                    </div>
                    <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", t.chip)}>
                      <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className={cn("mt-3 inline-flex items-center text-[10px] font-bold uppercase tracking-wider", isDark ? "text-slate-300 group-hover:text-white" : t.accent)}>
                    Ver detalhes <ArrowRight className="h-3 w-3 ml-1 transition group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Recebido por forma de pagamento */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recebido por forma de pagamento</h3>
                <p className="text-[11px] text-slate-500">Considera apenas receitas recebidas dentro do período filtrado</p>
              </div>
              {fMethod && (
                <button
                  onClick={() => setFMethod("")}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <Eraser className="h-3 w-3" /> Limpar forma
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {(["pix","cash","credit","debit","crediario","transfer","other"] as PayKey[]).map((k) => {
                const meta = PAY_META[k];
                const data = methodBreakdown[k];
                const active = fMethod === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFMethod(active ? "" : k)}
                    className={cn(
                      "group relative overflow-hidden text-left rounded-xl ring-1 ring-inset p-3 transition hover:-translate-y-0.5 hover:shadow-md",
                      meta.chip, meta.ring,
                      active && "ring-2 ring-offset-2 ring-emerald-500 shadow-md -translate-y-0.5",
                    )}
                  >
                    <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", meta.grad)} />
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.text)}>{meta.label}</span>
                      <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-white/70", meta.text)}>{data.count}</span>
                    </div>
                    <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">R$ {fmt(data.total)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    setEditing(null);
                    setIsFormOpen(true);
                  }}
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Nova receita
                </Button>
                <Button variant="outline" className="h-9 text-xs font-medium rounded-lg border-slate-200">
                  <RefreshCw className="h-4 w-4 mr-1.5 text-slate-400" /> Receitas Fixas
                </Button>
                <div className="h-6 w-px bg-slate-200 mx-1" />
                <Button variant="ghost" className="h-9 text-xs font-medium rounded-lg text-slate-600">
                  <List className="h-4 w-4 mr-1.5 text-slate-400" /> Modelo de lista
                </Button>
                <Button variant="ghost" className="h-9 text-xs font-medium rounded-lg text-slate-600">
                  <Filter className="h-4 w-4 mr-1.5 text-slate-400" /> Filtros
                </Button>
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-9 text-xs font-medium rounded-lg text-amber-600 hover:bg-amber-50"
                >
                  <Eraser className="h-4 w-4 mr-1.5" /> Limpar filtros
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n} por página
                    </option>
                  ))}
                </select>
                <Button variant="outline" className="h-9 text-xs font-medium rounded-lg border-slate-200">
                  <LayoutGrid className="h-4 w-4 mr-1.5 text-slate-400" /> Ações em lote
                </Button>
                <Button variant="outline" className="h-9 text-xs font-medium rounded-lg border-slate-200">
                  <Wrench className="h-4 w-4 mr-1.5 text-slate-400" /> Ferramentas
                </Button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Filtro rápido
                </label>
                <select
                  value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)}
                  className="h-9 w-full px-3 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                >
                  <option value="">Selecionar</option>
                  <option value="hoje">Recebem hoje</option>
                  <option value="vencidos">Vencidos</option>
                  <option value="a_receber">A receber</option>
                  <option value="recebidos">Recebidos</option>
                </select>
              </div>
              <div className="lg:col-span-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Período de vencimento
                </label>
                <div className="flex items-center gap-2">
                  <button className="h-9 w-9 grid place-items-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 flex-1 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                  <span className="text-slate-400 text-xs">até</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 flex-1 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                  <button className="h-9 w-9 grid place-items-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <Button
                  onClick={() => fetchData()}
                  className="h-9 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg"
                >
                  <Search className="h-4 w-4 mr-1.5" /> Buscar
                </Button>
              </div>
            </div>
          </div>


          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] font-bold text-slate-600">
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(visible.map((i) => i.id)));
                          else setSelected(new Set());
                        }}
                      />
                    </th>
                    <th className="px-3 py-2">Id</th>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2">Forma Pgto</th>
                    <th className="px-3 py-2">Título</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2">Pessoa</th>
                    <th className="px-3 py-2 text-right">Valor Total (R$)</th>
                    <th className="px-3 py-2">Data de Vencimento</th>
                    <th className="px-3 py-2 text-right">Valor Recebido (R$)</th>
                    <th className="px-3 py-2 text-right">Valor a receber (R$)</th>
                  </tr>
                  <tr className="bg-white border-b border-slate-200">
                    <th></th>
                    <th></th>
                    <th className="px-2 py-1.5">
                      <input
                        value={fId}
                        onChange={(e) => setFId(e.target.value)}
                        placeholder="Ex: Cód."
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px]"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <select
                        value={fOrigem}
                        onChange={(e) => setFOrigem(e.target.value)}
                        className="w-full h-7 px-1 rounded border border-slate-200 text-[11px] bg-white"
                      >
                        <option value="">Selecionar</option>
                        <option value="sale">Venda</option>
                        <option value="deposit">Depósito</option>
                        <option value="transfer">Transferência</option>
                        <option value="manual">Manual</option>
                      </select>
                    </th>
                    <th className="px-2 py-1.5">
                      <select
                        value={fCategoria}
                        onChange={(e) => setFCategoria(e.target.value)}
                        className="w-full h-7 px-1 rounded border border-slate-200 text-[11px] bg-white"
                      >
                        <option value="">Selecionar</option>
                        <option value="venda">Venda</option>
                        <option value="depósito">Depósito</option>
                        <option value="transferência">Transferência</option>
                        <option value="manual">Manual</option>
                      </select>
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        value={fTitulo}
                        onChange={(e) => setFTitulo(e.target.value)}
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px]"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        value={fSituacao}
                        onChange={(e) => setFSituacao(e.target.value)}
                        placeholder="Buscar"
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px]"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        value={fPessoa}
                        onChange={(e) => setFPessoa(e.target.value)}
                        placeholder="Buscar"
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px]"
                      />
                    </th>
                    <th></th>
                    <th className="px-2 py-1.5">
                      <input
                        placeholder="Inicial"
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px] mb-0.5"
                      />
                      <input
                        placeholder="Final"
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px]"
                      />
                    </th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-16 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-500" />
                        <p className="text-slate-500 mt-2 text-xs">Carregando receitas...</p>
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-16 text-center text-slate-400 italic">
                        Nenhuma receita encontrada
                      </td>
                    </tr>
                  ) : (
                    visible.map((it, idx) => {
                      const amount = Number(it.amount) || 0;
                      const paid = it.status === "paid" ? amount : 0;
                      const aReceber = amount - paid;
                      const shortId = String(it.id).replace(/-/g, "").slice(0, 6).toUpperCase();
                      const origin = (it.origin || "manual") as IncomeOrigin;
                      return (
                        <tr key={it.id} className={cn("hover:bg-emerald-50/40", idx % 2 && "bg-slate-50/40")}>
                          <td className="px-3 py-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(it);
                                    setIsFormOpen(true);
                                  }}
                                >
                                  <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(it.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(it.id)}
                              onChange={(e) => {
                                const s = new Set(selected);
                                if (e.target.checked) s.add(it.id);
                                else s.delete(it.id);
                                setSelected(s);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">{shortId}</td>
                          <td className="px-3 py-2">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset", ORIGIN_STYLE[origin])}>
                              {ORIGIN_LABEL[origin]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const k = normalizeMethod(it.payment_method);
                              const meta = PAY_META[k];
                              return (
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset",
                                  meta.chip, meta.ring, meta.text,
                                )}>
                                  {meta.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{it.title}</div>
                            {it.category && it.category !== "income" && it.category !== "sales" && (
                              <div className="text-[10px] text-slate-400 uppercase tracking-wide">{it.category}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">{statusBadge(it.status, it.due_date)}</td>
                          <td className="px-3 py-2">
                            <span className="text-slate-700">{it.person || it.supplier || <span className="text-slate-300">—</span>}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(amount)}</td>
                          <td className="px-3 py-2">
                            {it.due_date ? format(new Date(it.due_date), "dd/MM/yyyy") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                            {fmt(paid)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600">
                            {fmt(aReceber)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && visible.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right">
                        Totais ({visible.length} de {filtered.length}):
                      </td>
                      <td className="px-3 py-2 text-right">
                        {fmt(visible.reduce((s, i) => s + (Number(i.amount) || 0), 0))}
                      </td>
                      <td></td>
                      <td className="px-3 py-2 text-right text-emerald-700">
                        {fmt(
                          visible.reduce(
                            (s, i) => s + (i.status === "paid" ? Number(i.amount) || 0 : 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-red-700">
                        {fmt(
                          visible.reduce(
                            (s, i) => s + (i.status !== "paid" ? Number(i.amount) || 0 : 0),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </main>

        <ExpenseForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSave={handleSave}
          expense={editing}
          variant="income"
        />
      </div>
    </div>
  );
}
