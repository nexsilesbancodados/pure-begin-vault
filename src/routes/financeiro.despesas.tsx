import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Hourglass,
  XCircle,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Plus,
  RefreshCw,
  Filter,
  Eraser,
  Wrench,
  Search,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  ArrowRight,
  ArrowLeft,
  Download,
  TrendingDown,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { format, isBefore, isToday, isAfter, startOfDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro/despesas")({
  component: DespesasPage,
});

type Expense = {
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
  type: string;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DespesasPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const today = new Date();
  const [from, setFrom] = useState(format(subDays(today, 260), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(addDays(today, 365), "yyyy-MM-dd"));
  const [quickFilter, setQuickFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fSituacao, setFSituacao] = useState("");

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const base = supabase.from("finance_transactions").select("*").eq("type", "expense");
      const { data, error } = await (
        orgId ? base.eq("organization_id", orgId) : base.eq("user_id", user.id)
      ).order("due_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      setItems((data as any) || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar despesas");
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
      const payload = { ...data, type: "expense" };
      if (editing) {
        const { error } = await supabase
          .from("finance_transactions")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Despesa atualizada!");
      } else {
        const { error } = await supabase
          .from("finance_transactions")
          .insert([{ ...payload, user_id: user.id, organization_id: orgId }]);
        if (error) throw error;
        toast.success("Despesa criada!");
      }
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar despesa");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Despesa excluída");
    fetchData();
  };

  const togglePaid = async (it: Expense) => {
    const newStatus = it.status === "paid" ? "pending" : "paid";
    const { error } = await supabase
      .from("finance_transactions")
      .update({
        status: newStatus,
        payment_date: newStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", it.id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(newStatus === "paid" ? "Marcado como pago" : "Marcado como pendente");
    fetchData();
  };

  const kpis = useMemo(() => {
    const t = startOfDay(new Date());
    let venceHoje = 0,
      vencidos = 0,
      aVencer = 0,
      pagos = 0,
      total = 0;
    items.forEach((it) => {
      const amount = Number(it.amount) || 0;
      const valorPendente = it.status !== "paid" ? amount : 0;
      total += amount;
      if (it.status === "paid") pagos += amount;
      else if (it.due_date) {
        const d = startOfDay(new Date(it.due_date));
        if (isToday(d)) venceHoje += valorPendente;
        else if (isBefore(d, t)) vencidos += valorPendente;
        else if (isAfter(d, t)) aVencer += valorPendente;
      } else aVencer += valorPendente;
    });
    return { venceHoje, vencidos, aVencer, pagos, total };
  }, [items]);

  const filtered = useMemo(() => {
    const fromD = from ? startOfDay(new Date(from)) : null;
    const toD = to ? startOfDay(new Date(to)) : null;
    const q = search.toLowerCase().trim();
    return items.filter((it) => {
      if (it.due_date && fromD && toD) {
        const d = startOfDay(new Date(it.due_date));
        if (isBefore(d, fromD) || isAfter(d, toD)) return false;
      }
      if (q) {
        const hay = `${it.description ?? ""} ${it.category ?? ""} ${it.supplier ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fSituacao && (it.status || "pending") !== fSituacao) return false;
      if (quickFilter === "vencidos") {
        if (it.status === "paid" || !it.due_date) return false;
        if (!isBefore(startOfDay(new Date(it.due_date)), startOfDay(new Date()))) return false;
      } else if (quickFilter === "hoje") {
        if (it.status === "paid" || !it.due_date || !isToday(new Date(it.due_date))) return false;
      } else if (quickFilter === "pagos") {
        if (it.status !== "paid") return false;
      } else if (quickFilter === "a_vencer") {
        if (it.status === "paid") return false;
        if (!it.due_date) return true;
        if (!isAfter(startOfDay(new Date(it.due_date)), startOfDay(new Date()))) return false;
      }
      return true;
    });
  }, [items, from, to, search, fSituacao, quickFilter]);

  const visible = filtered.slice(0, pageSize);

  const clearFilters = () => {
    setQuickFilter("");
    setSearch("");
    setFSituacao("");
    setFrom(format(subDays(new Date(), 260), "yyyy-MM-dd"));
    setTo(format(addDays(new Date(), 365), "yyyy-MM-dd"));
  };

  const exportCsv = () => {
    const rows = [
      ["Id", "Origem", "Categoria", "Título", "Situação", "Fornecedor", "Valor", "Vencimento", "Pago", "A pagar"],
      ...filtered.map((it) => {
        const amount = Number(it.amount) || 0;
        const paid = it.status === "paid" ? amount : 0;
        return [
          it.id,
          it.reference_type || "manual",
          it.category || "",
          it.description || "",
          it.status || "pending",
          it.supplier || "",
          amount.toFixed(2),
          it.due_date || "",
          paid.toFixed(2),
          (amount - paid).toFixed(2),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despesas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} despesas exportadas`);
  };

  const kpiCards = [
    {
      label: "Vencem hoje",
      value: kpis.venceHoje,
      icon: Hourglass,
      key: "hoje",
      tone: "from-amber-500/15 to-amber-500/5 border-amber-500/20",
      iconBg: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
    },
    {
      label: "Vencidos",
      value: kpis.vencidos,
      icon: XCircle,
      key: "vencidos",
      tone: "from-red-500/15 to-red-500/5 border-red-500/20",
      iconBg: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
    },
    {
      label: "A vencer",
      value: kpis.aVencer,
      icon: CalendarClock,
      key: "a_vencer",
      tone: "from-sky-500/15 to-sky-500/5 border-sky-500/20",
      iconBg: "bg-sky-500",
      text: "text-sky-700 dark:text-sky-400",
    },
    {
      label: "Pagos",
      value: kpis.pagos,
      icon: CheckCircle2,
      key: "pagos",
      tone: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20",
      iconBg: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "Total no período",
      value: kpis.total,
      icon: DollarSign,
      key: "",
      tone: "from-primary/15 to-primary/5 border-primary/20",
      iconBg: "bg-primary",
      text: "text-primary",
    },
  ];

  const statusBadge = (status: string | null, due: string | null) => {
    if (status === "paid")
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Pago
        </span>
      );
    if (due) {
      const d = startOfDay(new Date(due));
      const t = startOfDay(new Date());
      if (isBefore(d, t))
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 text-[11px] font-bold border border-red-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Vencido
          </span>
        );
      if (isToday(d))
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Vence hoje
          </span>
        );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-bold border border-border">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> A pagar
      </span>
    );
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Despesas"
          subtitle="Gerencie todas as despesas e contas a pagar"
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <HubHero
            eyebrow="Financeiro · Despesas"
            title="Controle total das suas contas a pagar"
            description="Acompanhe vencimentos, marque pagamentos e exporte relatórios em tempo real. Tudo sincronizado com o caixa, DRE e fornecedores."
            icon={TrendingDown}
            actions={[
              {
                label: "Nova despesa",
                icon: Plus,
                onClick: () => {
                  setEditing(null);
                  setIsFormOpen(true);
                },
              },
              { label: "Atualizar", icon: RefreshCw, onClick: () => fetchData(), variant: "ghost" },
              { label: "Exportar CSV", icon: Download, onClick: exportCsv, variant: "ghost" },
            ]}
          />

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              const active = quickFilter === k.key && k.key !== "";
              return (
                <button
                  key={k.label}
                  onClick={() => k.key && setQuickFilter(quickFilter === k.key ? "" : k.key)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left transition-all hover:shadow-lg hover:-translate-y-0.5",
                    k.tone,
                    active && "ring-2 ring-primary shadow-lg",
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-xl grid place-items-center text-white shadow-md transition-transform group-hover:scale-110",
                        k.iconBg,
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    {k.label}
                  </div>
                  <div className={cn("text-xl md:text-2xl font-black tabular-nums", k.text)}>
                    R$ {fmt(k.value)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <Card className="p-4 rounded-2xl border-border/60 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Título, categoria ou fornecedor..."
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Situação
                </label>
                <select
                  value={fSituacao}
                  onChange={(e) => setFSituacao(e.target.value)}
                  className="h-10 w-44 px-3 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="">Todas</option>
                  <option value="paid">Pagas</option>
                  <option value="pending">Pendentes</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Vencimento
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setFrom(format(subDays(new Date(from), 30), "yyyy-MM-dd"));
                      setTo(format(subDays(new Date(to), 30), "yyyy-MM-dd"));
                    }}
                    className="h-10 w-10 grid place-items-center border border-border rounded-xl hover:bg-muted transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-border bg-background text-sm"
                  />
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-border bg-background text-sm"
                  />
                  <button
                    onClick={() => {
                      setFrom(format(addDays(new Date(from), 30), "yyyy-MM-dd"));
                      setTo(format(addDays(new Date(to), 30), "yyyy-MM-dd"));
                    }}
                    className="h-10 w-10 grid place-items-center border border-border rounded-xl hover:bg-muted transition"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="h-10 rounded-xl text-xs font-bold"
                >
                  <Eraser className="h-4 w-4 mr-1.5" /> Limpar
                </Button>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setIsFormOpen(true);
                  }}
                  className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/20"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Nova despesa
                </Button>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/30">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">
                  {filtered.length} despesa{filtered.length === 1 ? "" : "s"}
                </h3>
                {selected.size > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    {selected.size} selecionada(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-bold"
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n} / página
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/20 border-b border-border/60">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={visible.length > 0 && selected.size === visible.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(visible.map((i) => i.id)));
                          else setSelected(new Set());
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-3">Despesa</th>
                    <th className="px-3 py-3">Categoria</th>
                    <th className="px-3 py-3">Fornecedor</th>
                    <th className="px-3 py-3">Situação</th>
                    <th className="px-3 py-3">Vencimento</th>
                    <th className="px-3 py-3 text-right">Valor</th>
                    <th className="px-3 py-3 text-right">A pagar</th>
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-20 text-center">
                        <Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground mt-3 text-xs">Carregando despesas...</p>
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-20 text-center">
                        <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-3">
                          <Receipt className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-bold text-sm">Nenhuma despesa encontrada</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Ajuste os filtros ou cadastre sua primeira despesa
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visible.map((it) => {
                      const amount = Number(it.amount) || 0;
                      const paid = it.status === "paid" ? amount : 0;
                      const aPagar = amount - paid;
                      const isPaid = it.status === "paid";
                      const origem = (it.reference_type || "manual").toLowerCase();
                      return (
                        <tr
                          key={it.id}
                          className={cn(
                            "hover:bg-muted/30 transition-colors group",
                            selected.has(it.id) && "bg-primary/5",
                          )}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(it.id)}
                              onChange={(e) => {
                                const s = new Set(selected);
                                if (e.target.checked) s.add(it.id);
                                else s.delete(it.id);
                                setSelected(s);
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-9 w-9 rounded-xl grid place-items-center shrink-0",
                                  isPaid
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400",
                                )}
                              >
                                <TrendingDown className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-sm truncate max-w-[260px]">
                                  {it.description || "Sem título"}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  #{String(it.id).replace(/-/g, "").slice(0, 6).toUpperCase()} ·{" "}
                                  <span className="capitalize">{origem}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-1 rounded-md bg-muted text-foreground/80 text-[11px] font-semibold border border-border">
                              {it.category || "Geral"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-muted-foreground">
                            {it.supplier || "—"}
                          </td>
                          <td className="px-3 py-3">{statusBadge(it.status, it.due_date)}</td>
                          <td className="px-3 py-3 text-sm">
                            {it.due_date ? (
                              <div>
                                <div className="font-semibold">
                                  {format(new Date(it.due_date), "dd MMM yyyy", { locale: ptBR })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-bold tabular-nums">
                            R$ {fmt(amount)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-3 text-right font-bold tabular-nums",
                              aPagar > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            R$ {fmt(aPagar)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg opacity-50 group-hover:opacity-100 transition"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => togglePaid(it)}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                  {isPaid ? "Marcar pendente" : "Marcar como pago"}
                                </DropdownMenuItem>
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && visible.length > 0 && (
                  <tfoot className="bg-muted/30 border-t-2 border-border font-bold text-sm">
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                        Totais ({visible.length} de {filtered.length})
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        R$ {fmt(visible.reduce((s, i) => s + (Number(i.amount) || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                        R${" "}
                        {fmt(
                          visible.reduce(
                            (s, i) => s + (i.status !== "paid" ? Number(i.amount) || 0 : 0),
                            0,
                          ),
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </main>

        <ExpenseForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSave={handleSave}
          expense={editing}
          variant="expense"
        />
      </div>
    </div>
  );
}
