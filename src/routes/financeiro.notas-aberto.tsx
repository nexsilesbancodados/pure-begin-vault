import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Download,
  Calendar,
  Loader2,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Package,
  Plus,
  Trash2,
  Store,
  Hash,
  StickyNote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { format, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/financeiro/notas-aberto")({
  component: NotasAbertoPage,
});

type ProdutoNota = {
  quantity: number;
  name: string;
  cost_unit: number;
  cost_total: number;
  loja?: string;
  imei?: string;
  observacao?: string;
  vendido?: boolean;
  data_venda?: string;
};

const LOJAS = ["Premier", "Alfatech", "Outra"];

function NotasAbertoPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newNote, setNewNote] = useState({
    description: "",
    due_date: format(new Date(), "yyyy-MM-dd"),
    supplier_name: "",
    invoice_number: "",
    category: "Compra de Mercadoria",
    loja_padrao: "Premier",
  });

  const emptyProduct: ProdutoNota = {
    quantity: 1,
    name: "",
    cost_unit: 0,
    cost_total: 0,
    loja: "Premier",
    imei: "",
    observacao: "",
  };
  const [productsList, setProductsList] = useState<ProdutoNota[]>([emptyProduct]);

  const totalNota = useMemo(
    () => productsList.reduce((acc, p) => acc + (Number(p.cost_total) || 0), 0),
    [productsList],
  );

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const base = supabase
        .from("finance_transactions")
        .select("*")
        .eq("type", "expense");
      const { data, error } = await (
        orgId ? base.eq("organization_id", orgId) : base.eq("user_id", user.id)
      ).order("due_date", { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast.error("Erro ao carregar notas.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleMarkAsPaid = async (id: string, currentlyPaid: boolean) => {
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .update({
          status: currentlyPaid ? "pending" : "paid",
          payment_date: currentlyPaid ? null : new Date().toISOString().split("T")[0],
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentlyPaid ? "Nota reaberta" : "Nota marcada como paga!");
      fetchTransactions();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDeleteNota = async (id: string) => {
    if (!confirm("Excluir esta nota?")) return;
    try {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Nota excluída");
      fetchTransactions();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir nota.");
    }
  };

  const updateProductRow = (idx: number, patch: Partial<ProdutoNota>) => {
    setProductsList((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const merged = { ...p, ...patch };
        const q = Number(merged.quantity) || 0;
        const cu = Number(merged.cost_unit) || 0;
        merged.cost_total = +(q * cu).toFixed(2);
        return merged;
      }),
    );
  };

  const addRow = () =>
    setProductsList((prev) => [
      ...prev,
      { ...emptyProduct, loja: newNote.loja_padrao },
    ]);
  const removeRow = (idx: number) =>
    setProductsList((prev) => prev.filter((_, i) => i !== idx));

  const toggleProductSold = async (notaId: string, productIdx: number) => {
    const nota = transactions.find((t) => t.id === notaId);
    if (!nota) return;
    const updated = (nota.products_list || []).map((p: any, i: number) => {
      if (i !== productIdx) return p;
      const newSold = !p.vendido;
      return {
        ...p,
        vendido: newSold,
        data_venda: newSold ? format(new Date(), "yyyy-MM-dd") : null,
      };
    });
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .update({ products_list: updated })
        .eq("id", notaId);
      if (error) throw error;
      fetchTransactions();
    } catch (e) {
      toast.error("Erro ao atualizar venda do produto");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const validProducts = productsList.filter((p) => p.name && p.quantity > 0);
    if (validProducts.length === 0) {
      toast.error("Adicione pelo menos um produto à nota");
      return;
    }
    if (!newNote.due_date) {
      toast.error("Informe a data da nota");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("finance_transactions").insert([
        {
          user_id: user.id,
          organization_id: orgId,
          description:
            newNote.description ||
            `Nota ${format(parseISO(newNote.due_date), "dd/MM/yyyy")}`,
          amount: totalNota,
          due_date: newNote.due_date,
          supplier_name: newNote.supplier_name,
          invoice_number: newNote.invoice_number,
          category: newNote.category,
          type: "expense",
          status: "pending",
          products_list: validProducts,
        },
      ]);
      if (error) throw error;
      toast.success("Nota cadastrada com sucesso!");
      setIsDialogOpen(false);
      setNewNote({
        description: "",
        due_date: format(new Date(), "yyyy-MM-dd"),
        supplier_name: "",
        invoice_number: "",
        category: "Compra de Mercadoria",
        loja_padrao: "Premier",
      });
      setProductsList([emptyProduct]);
      fetchTransactions();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao cadastrar nota.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      t.description?.toLowerCase().includes(q) ||
      t.supplier_name?.toLowerCase().includes(q) ||
      t.invoice_number?.toLowerCase().includes(q) ||
      (t.products_list || []).some(
        (p: any) =>
          p.name?.toLowerCase().includes(q) ||
          p.imei?.toLowerCase().includes(q) ||
          p.loja?.toLowerCase().includes(q),
      )
    );
  });

  const stats = {
    totalPending: transactions
      .filter((t) => t.status !== "paid")
      .reduce((acc, c) => acc + (c.amount || 0), 0),
    overdueCount: transactions.filter(
      (t) => t.status !== "paid" && t.due_date && isAfter(new Date(), parseISO(t.due_date)),
    ).length,
    paidCount: transactions.filter((t) => t.status === "paid").length,
    count: transactions.length,
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Notas"
          subtitle="Planilha de notas de compra — produtos, custos, IMEI e baixa"
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-5 rounded-2xl border bg-gradient-to-br from-amber-500/10 to-transparent">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500 text-white grid place-items-center">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Em Aberto
              </div>
              <div className="text-xl font-black text-foreground mt-1">
                {stats.totalPending.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
            </Card>
            <Card className="p-5 rounded-2xl border bg-gradient-to-br from-red-500/10 to-transparent">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-red-500 text-white grid place-items-center">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Vencidas
              </div>
              <div className="text-xl font-black text-foreground mt-1">{stats.overdueCount}</div>
            </Card>
            <Card className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-transparent">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white grid place-items-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Pagas
              </div>
              <div className="text-xl font-black text-foreground mt-1">{stats.paidCount}</div>
            </Card>
            <Card className="p-5 rounded-2xl border">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary grid place-items-center">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Total de Notas
              </div>
              <div className="text-xl font-black text-foreground mt-1">{stats.count}</div>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Buscar por nota, produto, IMEI, loja..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-border text-sm font-medium outline-none focus:ring-2 focus:ring-primary/15"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-11 rounded-xl bg-primary hover:bg-primary/90 font-bold px-6 shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4 mr-2" /> Nova Nota
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black text-foreground">
                      Cadastrar Nova Nota
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-5 py-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">
                          Data da Nota *
                        </Label>
                        <Input
                          type="date"
                          value={newNote.due_date}
                          onChange={(e) => setNewNote({ ...newNote, due_date: e.target.value })}
                          className="h-10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">
                          Loja Padrão
                        </Label>
                        <Select
                          value={newNote.loja_padrao}
                          onValueChange={(v) => setNewNote({ ...newNote, loja_padrao: v })}
                        >
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LOJAS.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">
                          Fornecedor
                        </Label>
                        <Input
                          placeholder="Nome do fornecedor"
                          value={newNote.supplier_name}
                          onChange={(e) =>
                            setNewNote({ ...newNote, supplier_name: e.target.value })
                          }
                          className="h-10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">
                          Nº NF
                        </Label>
                        <Input
                          placeholder="000.000.000"
                          value={newNote.invoice_number}
                          onChange={(e) =>
                            setNewNote({ ...newNote, invoice_number: e.target.value })
                          }
                          className="h-10 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Planilha de produtos */}
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b">
                        <div className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                          <Package className="h-4 w-4" /> Produtos da Nota
                        </div>
                        <div className="text-xs font-black text-foreground">
                          T.NOTA:{" "}
                          <span className="text-primary">
                            {totalNota.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr className="text-[10px] uppercase font-black text-muted-foreground">
                              <th className="px-2 py-2 w-12 text-center">Qtd</th>
                              <th className="px-2 py-2 text-left min-w-[200px]">Produto</th>
                              <th className="px-2 py-2 text-right w-28">C.U (R$)</th>
                              <th className="px-2 py-2 text-right w-28">C.T (R$)</th>
                              <th className="px-2 py-2 w-28">Loja</th>
                              <th className="px-2 py-2 text-left w-44">IMEI</th>
                              <th className="px-2 py-2 text-left">Observação</th>
                              <th className="px-2 py-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {productsList.map((p, idx) => (
                              <tr key={idx} className="border-t border-border/60">
                                <td className="px-1 py-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={p.quantity}
                                    onChange={(e) =>
                                      updateProductRow(idx, { quantity: Number(e.target.value) })
                                    }
                                    className="h-8 text-xs text-center px-1"
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <Input
                                    placeholder="Ex: iPhone 14 Pro 128Gb Roxo"
                                    value={p.name}
                                    onChange={(e) =>
                                      updateProductRow(idx, { name: e.target.value })
                                    }
                                    className="h-8 text-xs"
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={p.cost_unit || ""}
                                    onChange={(e) =>
                                      updateProductRow(idx, { cost_unit: Number(e.target.value) })
                                    }
                                    className="h-8 text-xs text-right"
                                  />
                                </td>
                                <td className="px-1 py-1 text-right font-black text-foreground">
                                  {p.cost_total.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </td>
                                <td className="px-1 py-1">
                                  <Select
                                    value={p.loja || newNote.loja_padrao}
                                    onValueChange={(v) => updateProductRow(idx, { loja: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {LOJAS.map((l) => (
                                        <SelectItem key={l} value={l}>
                                          {l}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-1 py-1">
                                  <Input
                                    placeholder="35 418313 626409 6"
                                    value={p.imei || ""}
                                    onChange={(e) =>
                                      updateProductRow(idx, { imei: e.target.value })
                                    }
                                    className="h-8 text-xs font-mono"
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <Input
                                    placeholder="Vendido 06-05..."
                                    value={p.observacao || ""}
                                    onChange={(e) =>
                                      updateProductRow(idx, { observacao: e.target.value })
                                    }
                                    className="h-8 text-xs"
                                  />
                                </td>
                                <td className="px-1 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeRow(idx)}
                                    className="text-red-500 hover:text-red-700 disabled:opacity-30"
                                    disabled={productsList.length === 1}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-2 border-t bg-muted/20">
                        <Button
                          type="button"
                          onClick={addRow}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-bold"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar linha
                        </Button>
                      </div>
                    </div>

                    <DialogFooter className="pt-4 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsDialogOpen(false)}
                        disabled={submitting}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="bg-primary hover:bg-primary/90 font-bold px-8"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `Salvar Nota (${totalNota.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-border font-bold px-6"
                onClick={() => {
                  import("@/lib/exportCsv").then(({ exportToCsv }) => {
                    const rows: any[] = [];
                    (transactions ?? []).forEach((t: any) => {
                      (t.products_list || []).forEach((p: any) => {
                        rows.push({
                          data_nota: t.due_date,
                          fornecedor: t.supplier_name,
                          nf: t.invoice_number,
                          qtd: p.quantity,
                          produto: p.name,
                          cu: p.cost_unit,
                          ct: p.cost_total,
                          loja: p.loja,
                          imei: p.imei,
                          observacao: p.observacao,
                          vendido: p.vendido ? "Sim" : "Não",
                          pago: t.status === "paid" ? "Sim" : "Não",
                        });
                      });
                    });
                    exportToCsv("notas.csv", rows);
                  });
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          </div>

          {/* Planilha de notas */}
          {loading ? (
            <Card className="p-20 rounded-2xl text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground mt-2 text-xs">Carregando notas...</p>
            </Card>
          ) : filteredTransactions.length === 0 ? (
            <Card className="p-20 rounded-2xl text-center text-muted-foreground italic">
              Nenhuma nota cadastrada ainda.
            </Card>
          ) : (
            <div className="space-y-5">
              {filteredTransactions.map((t) => {
                const isOverdue =
                  t.status !== "paid" && t.due_date && isAfter(new Date(), parseISO(t.due_date));
                const isPaid = t.status === "paid";
                const items: any[] = t.products_list || [];
                return (
                  <Card
                    key={t.id}
                    className="rounded-2xl overflow-hidden border-border shadow-sm"
                  >
                    {/* Cabeçalho da nota — estilo planilha */}
                    <div
                      className={`px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-b ${isPaid ? "bg-emerald-50/60" : isOverdue ? "bg-red-50/60" : "bg-muted/40"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Data
                        </span>
                        <span className="text-sm font-black text-foreground">
                          {t.due_date
                            ? format(parseISO(t.due_date), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          T.NOTA
                        </span>
                        <span className="text-sm font-black text-foreground">
                          {(t.amount || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                      {t.supplier_name && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Fornecedor
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            {t.supplier_name}
                          </span>
                        </div>
                      )}
                      {t.invoice_number && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            NF
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            {t.invoice_number}
                          </span>
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {isOverdue && (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-red-100 text-red-700">
                            Vencida
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant={isPaid ? "outline" : "default"}
                          onClick={() => handleMarkAsPaid(t.id, isPaid)}
                          className="h-8 text-[11px] font-bold"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {isPaid ? "Pago" : "Marcar como Pago"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteNota(t.id)}
                          className="h-8 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Tabela de produtos */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/20 border-b border-border/60">
                          <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                            <th className="px-3 py-2 w-12 text-center">Qtd</th>
                            <th className="px-3 py-2 text-left">Produto</th>
                            <th className="px-3 py-2 text-right w-28">C.U</th>
                            <th className="px-3 py-2 text-right w-28">C.T</th>
                            <th className="px-3 py-2 w-28">
                              <Store className="h-3 w-3 inline mr-1" />
                              Loja
                            </th>
                            <th className="px-3 py-2 text-left w-44">
                              <Hash className="h-3 w-3 inline mr-1" />
                              IMEI
                            </th>
                            <th className="px-3 py-2 text-left">
                              <StickyNote className="h-3 w-3 inline mr-1" />
                              Observação
                            </th>
                            <th className="px-3 py-2 w-24 text-center">Vendido?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-3 py-6 text-center text-muted-foreground italic text-[11px]"
                              >
                                Sem produtos cadastrados nesta nota
                              </td>
                            </tr>
                          ) : (
                            items.map((p, idx) => (
                              <tr
                                key={idx}
                                className={`hover:bg-muted/20 transition ${p.vendido ? "opacity-60" : ""}`}
                              >
                                <td className="px-3 py-2 text-center font-bold">
                                  {p.quantity || 1}
                                </td>
                                <td
                                  className={`px-3 py-2 font-bold text-foreground ${p.vendido ? "line-through" : ""}`}
                                >
                                  {p.name || "—"}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(p.cost_unit || p.price || 0).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right font-black text-foreground">
                                  {Number(
                                    p.cost_total ||
                                      (p.cost_unit || p.price || 0) * (p.quantity || 1),
                                  ).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </td>
                                <td className="px-3 py-2">
                                  {p.loja ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.loja === "Premier" ? "bg-blue-100 text-blue-700" : p.loja === "Alfatech" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}
                                    >
                                      {p.loja}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                                  {p.imei || "—"}
                                </td>
                                <td className="px-3 py-2 text-[11px] text-muted-foreground italic">
                                  {p.observacao ||
                                    (p.vendido && p.data_venda
                                      ? `Vendido ${format(parseISO(p.data_venda), "dd-MM")}`
                                      : "—")}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleProductSold(t.id, idx)}
                                    className={`h-6 px-2 rounded text-[10px] font-black uppercase transition ${p.vendido ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
                                  >
                                    {p.vendido ? "Vendido" : "Marcar"}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
