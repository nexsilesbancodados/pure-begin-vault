import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Filter,
  MoreHorizontal,
  Plus,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Trash2,
  Edit,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TransactionForm } from "@/components/financeiro/TransactionForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/financeiro/caixa")({
  component: FinanceCaixaPage,
});

function FinanceCaixaPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const base = supabase.from("finance_transactions").select("*");
      const { data, error } = await (
        orgId ? base.eq("organization_id", orgId) : base.eq("user_id", user.id)
      ).order("payment_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erro financeiro:", error);
      toast.error("Erro ao carregar transações.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSave = async (data: any) => {
    if (!user?.id) return;

    try {
      if (editingTransaction) {
        const { error } = await supabase
          .from("finance_transactions")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTransaction.id);

        if (error) throw error;
        toast.success("Lançamento atualizado!");
      } else {
        const { error } = await supabase.from("finance_transactions").insert([
          {
            ...data,
            user_id: user.id,
            organization_id: orgId,
          },
        ]);

        if (error) throw error;
        toast.success("Lançamento criado!");
      }
      fetchTransactions();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar lançamento.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este lançamento?")) return;

    try {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);

      if (error) throw error;
      toast.success("Lançamento excluído!");
      fetchTransactions();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir lançamento.");
    }
  };

  const filteredTransactions = transactions.filter(
    (t) =>
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const stats = {
    todayIncome: transactions
      .filter(
        (t) =>
          t.type === "income" &&
          t.payment_date &&
          new Date(t.payment_date).toDateString() === new Date().toDateString(),
      )
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    todayExpense: transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.payment_date &&
          new Date(t.payment_date).toDateString() === new Date().toDateString(),
      )
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    balance: transactions.reduce(
      (acc, curr) => acc + (curr.type === "income" ? curr.amount || 0 : -(curr.amount || 0)),
      0,
    ),
    planned: transactions
      .filter((t) => t.status === "pending")
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Caixa e Bancos"
          subtitle="Controle detalhado de entradas e saídas"
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 border-none bg-white shadow-sm border border-border/60 rounded-[2rem] hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500 text-white grid place-items-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                  <ArrowUpCircle className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
                  Hoje
                </span>
              </div>
              <div className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-4">
                Entradas
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {stats.todayIncome.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </Card>
            <Card className="p-5 border-none bg-white shadow-sm border border-border/60 rounded-[2rem] hover:shadow-xl hover:shadow-red-500/5 transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div className="h-10 w-10 rounded-2xl bg-red-500 text-white grid place-items-center shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                  <ArrowDownCircle className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-lg">
                  Hoje
                </span>
              </div>
              <div className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-4">
                Saídas
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {stats.todayExpense.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </Card>
            <Card className="p-5 border-none bg-white shadow-sm border border-border/60 rounded-[2rem] hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div className="h-10 w-10 rounded-2xl bg-indigo-500 text-white grid place-items-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-4">
                Saldo Atual
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {stats.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </Card>
            <Card className="p-5 border-none bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 rounded-[2rem] hover:shadow-xl hover:shadow-primary/30 transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Calendar className="h-24 w-24" />
              </div>
              <div className="flex justify-between items-start mb-2">
                <div className="h-10 w-10 rounded-2xl bg-white/10 text-white grid place-items-center backdrop-blur-sm">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[11px] font-bold text-primary-foreground/70 uppercase tracking-widest mt-4">
                Previsto
              </div>
              <div className="text-2xl font-black mt-1 text-primary-foreground">
                {stats.planned.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Buscar transação..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-border text-sm font-medium outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary transition shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setEditingTransaction(null);
                  setIsFormOpen(true);
                }}
                className="h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-bold px-6 shadow-lg shadow-primary/20"
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
              </Button>
            </div>
          </div>

          <Card className="border-border shadow-sm overflow-hidden rounded-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Data
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Descrição
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Categoria
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">
                    Valor
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">
                    Status
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      <p className="text-muted-foreground mt-2 text-xs">Carregando transações...</p>
                    </td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                        {t.payment_date
                          ? format(new Date(t.payment_date), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                          >
                            {t.type === "income" ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownLeft className="h-4 w-4" />
                            )}
                          </div>
                          <span className="font-bold text-sm text-foreground">{t.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-muted text-slate-600 text-[10px] font-black uppercase tracking-tight border border-border">
                          {t.category || "Geral"}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-black text-sm ${t.type === "income" ? "text-green-600" : "text-red-600"}`}
                      >
                        {t.type === "income" ? "+" : "-"}{" "}
                        {(t.amount || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${t.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {t.status === "paid" ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all text-muted-foreground/70 hover:text-slate-600"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingTransaction(t);
                                setIsFormOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-muted-foreground italic"
                    >
                      Nenhuma transação encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </main>

        <TransactionForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSave={handleSave}
          transaction={editingTransaction}
        />
      </div>
    </div>
  );
}
