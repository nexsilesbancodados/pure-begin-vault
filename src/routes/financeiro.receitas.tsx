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

type Income = {
  id: string;
  description: string;
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
  source_table: "receivable" | "transaction";
  notes?: string | null;
  type: string;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const noteField = (notes: string | null | undefined, label: string) => {
  const line = (notes || "").split("\n").find((l) => l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : null;
};

const customerFromDescription = (description: string | null | undefined) =>
  (description || "").includes(" · ") ? (description || "").split(" · ").slice(1).join(" · ") : null;

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

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const receivableBase = supabase
        .from("accounts_receivable")
        .select("*");
      const transactionBase = supabase
        .from("finance_transactions")
        .select("*")
        .eq("type", "income");

      const [receivableRes, txRes] = await Promise.all([
        (orgId ? receivableBase.eq("organization_id", orgId) : receivableBase.eq("user_id", user.id))
          .order("due_date", { ascending: false, nullsFirst: false }),
        (orgId ? transactionBase.eq("organization_id", orgId) : transactionBase.eq("user_id", user.id))
          .order("transaction_date", { ascending: false, nullsFirst: false }),
      ]);
      if (receivableRes.error) throw receivableRes.error;
      if (txRes.error) throw txRes.error;

      const receivables = ((receivableRes.data as any[]) || []).map((r) => ({
        id: r.id,
        description: r.description,
        category: r.sale_id ? "sales" : "income",
        amount: Number(r.amount) || 0,
        status: r.status || "pending",
        due_date: r.due_date,
        payment_date: r.paid_at,
        transaction_date: r.paid_at || r.due_date,
        supplier: noteField(r.notes, "Cliente") || customerFromDescription(r.description),
        reference_type: r.sale_id ? "sale" : "manual",
        reference_id: r.sale_id || null,
        customer_id: r.customer_id || null,
        source_table: "receivable" as const,
        notes: r.notes,
        type: "income",
      }));
      const receivableSaleIds = new Set(receivables.map((r) => r.reference_id).filter(Boolean));
      const transactions = ((txRes.data as any[]) || [])
        .filter((t) => !(t.reference_type === "sale" && t.reference_id && receivableSaleIds.has(t.reference_id)))
        .map((t) => ({
          ...t,
          due_date: t.transaction_date,
          payment_date: t.transaction_date,
          supplier: customerFromDescription(t.description),
          source_table: "transaction" as const,
        }));
      setItems([...receivables, ...transactions]);
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
      if (fCategoria && !(it.category || "").toLowerCase().includes(fCategoria.toLowerCase()))
        return false;
      if (fOrigem) {
        const origem = (it.reference_type || "manual").toLowerCase();
        if (origem !== fOrigem.toLowerCase()) return false;
      }
      if (fTitulo && !(it.description || "").toLowerCase().includes(fTitulo.toLowerCase()))
        return false;
      if (fSituacao) {
        const s = (it.status || "pending").toLowerCase();
        if (!s.includes(fSituacao.toLowerCase())) return false;
      }
      if (fPessoa && !((it.supplier as string) || "").toLowerCase().includes(fPessoa.toLowerCase()))
        return false;
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
  }, [items, from, to, fId, fOrigem, fCategoria, fTitulo, fSituacao, fPessoa, quickFilter]);

  const visible = filtered.slice(0, pageSize);

  const clearFilters = () => {
    setQuickFilter("");
    setFId("");
    setFOrigem("");
    setFCategoria("");
    setFTitulo("");
    setFSituacao("");
    setFPessoa("");
    setFrom(format(subDays(new Date(), 260), "yyyy-MM-dd"));
    setTo(format(addDays(new Date(), 365), "yyyy-MM-dd"));
  };

  const kpiCards = [
    { label: "Recebem hoje (R$)", value: kpis.receberHoje, icon: Hourglass, key: "hoje" },
    { label: "Vencidos (R$)", value: kpis.vencidos, icon: X, key: "vencidos" },
    { label: "A receber (R$)", value: kpis.aReceber, icon: Calendar, key: "a_receber" },
    { label: "Recebidos (R$)", value: kpis.recebidos, icon: CheckCircle2, key: "recebidos" },
    { label: "Total no período (R$)", value: kpis.total, icon: DollarSign, key: "" },
  ];

  const statusBadge = (status: string | null, due: string | null) => {
    if (status === "paid")
      return <span className="px-3 py-1 rounded-md bg-emerald-500 text-white text-[11px] font-bold">Recebido</span>;
    if (due) {
      const d = startOfDay(new Date(due));
      const t = startOfDay(new Date());
      if (isBefore(d, t))
        return <span className="px-3 py-1 rounded-md bg-red-500 text-white text-[11px] font-bold">Vencido</span>;
      if (isToday(d))
        return <span className="px-3 py-1 rounded-md bg-amber-500 text-white text-[11px] font-bold">Recebe hoje</span>;
    }
    return <span className="px-3 py-1 rounded-md bg-slate-400 text-white text-[11px] font-bold">A receber</span>;
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
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
            <Home className="h-3.5 w-3.5" />
            <span>Financeiro</span>
            <ChevronRight className="h-3 w-3" />
            <span>Receitas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              const active = quickFilter === k.key && k.key !== "";
              return (
                <div
                  key={k.label}
                  className={cn(
                    "rounded-md overflow-hidden border border-emerald-600 bg-emerald-500 text-white shadow-sm transition hover:shadow-md",
                    active && "ring-2 ring-emerald-900",
                  )}
                >
                  <div className="px-4 py-3 flex items-start justify-between">
                    <div>
                      <div className="text-2xl font-black leading-tight">{fmt(k.value)}</div>
                      <div className="text-[11px] opacity-90 mt-1 font-medium">{k.label}</div>
                    </div>
                    <Icon className="h-7 w-7 opacity-70" strokeWidth={2.2} />
                  </div>
                  <button
                    onClick={() => k.key && setQuickFilter(quickFilter === k.key ? "" : k.key)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-[11px] font-bold uppercase tracking-wide py-2 flex items-center justify-center gap-1 transition border-t border-emerald-700"
                  >
                    Ver detalhes <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-wrap items-center gap-2 justify-end">
            <Button
              onClick={() => {
                setEditing(null);
                setIsFormOpen(true);
              }}
              className="h-9 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-md"
            >
              <Plus className="h-4 w-4 mr-1" /> Nova receita
            </Button>
            <Button variant="outline" className="h-9 text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-bold rounded-md">
              <RefreshCw className="h-4 w-4 mr-1" /> Receitas Fixas
            </Button>
            <Button variant="outline" className="h-9 text-xs font-bold rounded-md">
              <List className="h-4 w-4 mr-1" /> Modelo de lista
            </Button>
            <Button variant="outline" className="h-9 text-xs font-bold rounded-md">
              <Filter className="h-4 w-4 mr-1" /> Filtros
            </Button>
            <Button
              variant="outline"
              onClick={clearFilters}
              className="h-9 text-xs font-bold rounded-md text-amber-700 border-amber-300"
            >
              <Eraser className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Button variant="outline" className="h-9 text-xs font-bold rounded-md">
              <LayoutGrid className="h-4 w-4 mr-1" /> Ações em lote
            </Button>
            <Button variant="outline" className="h-9 text-xs font-bold rounded-md">
              <Wrench className="h-4 w-4 mr-1" /> Ferramentas
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Filtro rápido
              </label>
              <select
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                className="h-9 w-52 px-3 rounded-md border border-slate-300 text-xs bg-white"
              >
                <option value="">Selecionar</option>
                <option value="hoje">Recebem hoje</option>
                <option value="vencidos">Vencidos</option>
                <option value="a_receber">A receber</option>
                <option value="recebidos">Recebidos</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Período de vencimento
              </label>
              <div className="flex items-center gap-2">
                <button className="h-9 w-9 grid place-items-center border border-slate-300 rounded-md hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 px-3 rounded-md border border-slate-300 text-xs"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 px-3 rounded-md border border-slate-300 text-xs"
                />
                <button className="h-9 w-9 grid place-items-center border border-slate-300 rounded-md hover:bg-slate-50">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button
              onClick={() => fetchData()}
              className="h-9 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-md"
            >
              <Search className="h-4 w-4 mr-1" /> Buscar
            </Button>
          </div>

          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
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
                    <th className="px-3 py-2">Categoria</th>
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
                        <option value="manual">Manual</option>
                        <option value="sale">Venda</option>
                      </select>
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        value={fCategoria}
                        onChange={(e) => setFCategoria(e.target.value)}
                        placeholder="Selecionar"
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px]"
                      />
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
                      const origem = (it.reference_type || "manual").toLowerCase();
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
                            <span className="px-2 py-0.5 rounded bg-slate-500 text-white text-[10px] font-bold capitalize">
                              {origem}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-700 uppercase">
                            {(it.category || "RECEITA").toUpperCase()}
                          </td>
                          <td className="px-3 py-2 text-emerald-700 font-semibold uppercase">
                            {it.description}
                          </td>
                          <td className="px-3 py-2">{statusBadge(it.status, it.due_date)}</td>
                          <td className="px-3 py-2 uppercase">{it.supplier || "—"}</td>
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
