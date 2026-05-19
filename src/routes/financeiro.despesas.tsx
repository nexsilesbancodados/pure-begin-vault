import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Check,
  Receipt,
  Filter,
} from "lucide-react";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — ConectaCRM" },
      { name: "description", content: "Lançamentos de despesas e contas a pagar." },
    ],
  }),
  component: DespesasPage,
});

type Expense = {
  id: string;
  description: string | null;
  amount: number;
  category: string | null;
  due_date: string | null;
  paid_at: string | null;
  status: string | null;
  notes: string | null;
};

type StatusFilter = "all" | "pending" | "paid" | "overdue";

function brl(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function DespesasPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { user } = useAuth();
  const { orgId } = useOrg();

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts_payable")
      .select("id, description, amount, category, due_date, paid_at, status, notes")
      .eq("organization_id", orgId)
      .order("due_date", { ascending: false, nullsFirst: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar despesas");
    } else {
      setItems((data as Expense[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const todayISO = new Date().toISOString().split("T")[0];

  const isOverdue = (e: Expense) =>
    e.status !== "paid" && e.due_date && e.due_date < todayISO;

  const kpis = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let total = 0;
    let pago = 0;
    let pendente = 0;
    let vencido = 0;
    for (const e of items) {
      const amount = Number(e.amount) || 0;
      const ref = e.due_date ? new Date(e.due_date) : null;
      if (ref && ref >= monthStart) total += amount;
      if (e.status === "paid") pago += amount;
      else {
        pendente += amount;
        if (isOverdue(e)) vencido += amount;
      }
    }
    return { total, pago, pendente, vencido };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.category && s.add(i.category));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (statusFilter === "paid" && e.status !== "paid") return false;
      if (statusFilter === "pending" && (e.status === "paid" || isOverdue(e))) return false;
      if (statusFilter === "overdue" && !isOverdue(e)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          (e.description || "").toLowerCase().includes(q) ||
          (e.category || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, statusFilter, categoryFilter]);

  const handleSave = async (data: any) => {
    if (!user?.id || !orgId) return;
    try {
      const payload = {
        organization_id: orgId,
        user_id: user.id,
        description: data.description,
        amount: data.amount,
        category: data.category,
        due_date: data.due_date,
        paid_at: data.payment_date,
        status: data.status,
        notes: [
          data.supplier ? `Fornecedor: ${data.supplier}` : null,
          data.payment_method ? `Pagamento: ${data.payment_method}` : null,
          data.notes,
        ]
          .filter(Boolean)
          .join("\n") || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("accounts_payable")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Despesa atualizada!");
      } else {
        const { error } = await supabase.from("accounts_payable").insert([payload]);
        if (error) throw error;
        toast.success("Despesa lançada!");
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar despesa");
    }
  };

  const markPaid = async (e: Expense) => {
    const { error } = await supabase
      .from("accounts_payable")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: e.amount })
      .eq("id", e.id);
    if (error) toast.error("Erro ao marcar como pago");
    else {
      toast.success("Despesa quitada!");
      load();
    }
  };

  const remove = async (e: Expense) => {
    if (!confirm(`Excluir "${e.description}"?`)) return;
    const { error } = await supabase.from("accounts_payable").delete().eq("id", e.id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Despesa excluída");
      load();
    }
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (e: Expense) => {
    // Parse supplier/payment from notes
    const supplier = (e.notes || "").match(/Fornecedor:\s*(.+)/)?.[1] || "";
    const payment_method =
      (e.notes || "").match(/Pagamento:\s*(\w+)/)?.[1] || "pix";
    setEditing({ ...e, supplier, payment_method } as any);
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Despesas" subtitle="Contas a pagar e saídas" />
        <main className="flex-1 p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-black font-display tracking-tight">
                Gestão de despesas
              </h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe lançamentos, vencimentos e pagamentos.
              </p>
            </div>
            <Button
              onClick={openNew}
              size="lg"
              className="rounded-xl shadow-md bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="Total do mês"
              value={brl(kpis.total)}
              tone="neutral"
            />
            <KpiCard
              icon={<Clock className="h-5 w-5" />}
              label="Pendente"
              value={brl(kpis.pendente)}
              tone="amber"
            />
            <KpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Vencido"
              value={brl(kpis.vencido)}
              tone="red"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Pago"
              value={brl(kpis.pago)}
              tone="emerald"
            />
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-10 w-[160px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Descrição</th>
                    <th className="text-left px-4 py-3 font-bold">Categoria</th>
                    <th className="text-left px-4 py-3 font-bold">Vencimento</th>
                    <th className="text-right px-4 py-3 font-bold">Valor</th>
                    <th className="text-center px-4 py-3 font-bold">Status</th>
                    <th className="text-right px-4 py-3 font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        Carregando...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center">
                            <Receipt className="h-6 w-6" />
                          </div>
                          <p className="font-semibold">Nenhuma despesa encontrada</p>
                          <Button variant="outline" size="sm" onClick={openNew}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Cadastrar primeira despesa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((e) => {
                      const overdue = isOverdue(e);
                      const paid = e.status === "paid";
                      return (
                        <tr
                          key={e.id}
                          className="border-t border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">{e.description}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {e.category || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {e.due_date
                              ? new Date(e.due_date + "T00:00").toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-red-600 dark:text-red-400">
                            {brl(Number(e.amount) || 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={paid ? "paid" : overdue ? "overdue" : "pending"} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {!paid && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markPaid(e)}
                                  className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                  title="Marcar como pago"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(e)}
                                className="h-8 px-2"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => remove(e)}
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <ExpenseForm
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        onSave={handleSave}
        expense={editing}
        variant="expense"
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "amber" | "red" | "emerald";
}) {
  const tones = {
    neutral: "from-slate-500/10 to-slate-500/5 text-slate-700 dark:text-slate-200",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
    red: "from-red-500/15 to-red-500/5 text-red-700 dark:text-red-300",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  } as const;
  const iconBg = {
    neutral: "bg-slate-500/15",
    amber: "bg-amber-500/20",
    red: "bg-red-500/20",
    emerald: "bg-emerald-500/20",
  } as const;
  return (
    <div
      className={cn(
        "bg-gradient-to-br border border-border rounded-2xl p-5 flex items-center gap-4",
        tones[tone],
      )}
    >
      <div className={cn("h-11 w-11 rounded-xl grid place-items-center", iconBg[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</div>
        <div className="text-xl font-black tabular-nums truncate">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "paid" | "pending" | "overdue" }) {
  const map = {
    paid: {
      label: "Pago",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    pending: {
      label: "Pendente",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      icon: <Clock className="h-3 w-3" />,
    },
    overdue: {
      label: "Vencido",
      cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  } as const;
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border",
        s.cls,
      )}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
