import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, Fragment } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Download, 
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Truck,
  Package,
  Receipt,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";

export const Route = createFileRoute("/financeiro/notas-aberto")({
  component: NotasAbertoPage,
});

function NotasAbertoPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
   const [searchTerm, setSearchTerm] = useState("");
   const [expandedRow, setExpandedRow] = useState<string | null>(null);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [submitting, setSubmitting] = useState(false);

   // Form states
   const [newNote, setNewNote] = useState({
     description: "",
     amount: "",
     due_date: "",
     supplier_name: "",
     invoice_number: "",
     category: "Compra de Mercadoria"
   });

   const [newProduct, setNewProduct] = useState({ name: "", quantity: "", price: "" });
   const [productsList, setProductsList] = useState<any[]>([]);


  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erro ao carregar notas em aberto:", error);
      toast.error("Erro ao carregar notas em aberto.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleMarkAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .update({ 
          status: "paid",
          payment_date: new Date().toISOString().split('T')[0]
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Nota marcada como paga!");
      fetchTransactions();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao marcar como paga.");
    }
  };

   const handleAddProduct = () => {
     if (!newProduct.name || !newProduct.quantity) {
       toast.error("Preencha o nome e a quantidade do produto");
       return;
     }
     setProductsList([...productsList, { ...newProduct, quantity: Number(newProduct.quantity), price: newProduct.price ? Number(newProduct.price) : 0 }]);
     setNewProduct({ name: "", quantity: "", price: "" });
   };

   const removeProduct = (index: number) => {
     setProductsList(productsList.filter((_, i) => i !== index));
   };

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user?.id) return;
     if (!newNote.description || !newNote.amount || !newNote.due_date) {
       toast.error("Preencha os campos obrigatórios");
       return;
     }

     setSubmitting(true);
     try {
       const { error } = await supabase
         .from("finance_transactions")
         .insert([{
           user_id: user.id,
           description: newNote.description,
           amount: Number(newNote.amount),
           due_date: newNote.due_date,
           supplier_name: newNote.supplier_name,
           invoice_number: newNote.invoice_number,
           category: newNote.category,
           type: 'expense',
           status: 'pending',
           products_list: productsList
         }]);

       if (error) throw error;
       toast.success("Nota cadastrada com sucesso!");
       setIsDialogOpen(false);
       setNewNote({ description: "", amount: "", due_date: "", supplier_name: "", invoice_number: "", category: "Compra de Mercadoria" });
       setProductsList([]);
       fetchTransactions();
     } catch (error) {
       console.error("Erro ao cadastrar nota:", error);
       toast.error("Erro ao cadastrar nota.");
     } finally {
       setSubmitting(false);
     }
   };

   const filteredTransactions = transactions.filter(t => 
     t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
     (t.supplier_name && t.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    totalPending: transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0),
    overdueCount: transactions.filter(t => t.due_date && isAfter(new Date(), parseISO(t.due_date))).length,
    overdueAmount: transactions
      .filter(t => t.due_date && isAfter(new Date(), parseISO(t.due_date)))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    count: transactions.length
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Notas em Aberto" subtitle="Gestão de contas a pagar e receber pendentes" toggleSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 border-none bg-gradient-to-br from-amber-500/10 to-transparent shadow-sm border border-amber-100 rounded-2xl">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500 text-white grid place-items-center shadow-lg shadow-amber-200">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter bg-amber-50 px-2 py-1 rounded-full">Total em Aberto</span>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valor Pendente</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {stats.totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-bold">{stats.count} registros pendentes</div>
            </Card>

            <Card className="p-5 border-none bg-gradient-to-br from-red-500/10 to-transparent shadow-sm border border-red-100 rounded-2xl">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-red-500 text-white grid place-items-center shadow-lg shadow-red-200">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter bg-red-50 px-2 py-1 rounded-full">Atenção</span>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valor Vencido</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {stats.overdueAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-red-600 mt-1 font-bold">{stats.overdueCount} contas em atraso</div>
            </Card>

            <Card className="p-5 border-border shadow-sm rounded-2xl">
              <div className="flex justify-between items-start mb-2">
                <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-600 grid place-items-center">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Projeção Próximos 7 dias</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {transactions
                  .filter(t => t.due_date && !isAfter(new Date(), parseISO(t.due_date)) && isAfter(parseISO(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')), parseISO(t.due_date)))
                  .reduce((acc, curr) => acc + (curr.amount || 0), 0)
                  .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  placeholder="Buscar notas..." 
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" className="h-11 rounded-xl border-slate-200">
                <Filter className="h-4 w-4 mr-2" /> Filtros
              </Button>
            </div>
            <div className="flex gap-2">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-6 shadow-lg shadow-blue-200">
                    <Plus className="h-4 w-4 mr-2" /> Nova Nota
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black text-slate-900">Cadastrar Nova Nota</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-[10px] font-black uppercase text-slate-500">Descrição/Título *</Label>
                        <Input 
                          id="description" 
                          placeholder="Ex: Compra de Telas iPhone 13" 
                          value={newNote.description}
                          onChange={(e) => setNewNote({...newNote, description: e.target.value})}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount" className="text-[10px] font-black uppercase text-slate-500">Valor Total (R$) *</Label>
                        <Input 
                          id="amount" 
                          type="number" 
                          step="0.01"
                          placeholder="0,00" 
                          value={newNote.amount}
                          onChange={(e) => setNewNote({...newNote, amount: e.target.value})}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="supplier" className="text-[10px] font-black uppercase text-slate-500">Fornecedor</Label>
                        <Input 
                          id="supplier" 
                          placeholder="Nome do Fornecedor" 
                          value={newNote.supplier_name}
                          onChange={(e) => setNewNote({...newNote, supplier_name: e.target.value})}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice" className="text-[10px] font-black uppercase text-slate-500">Número da NF</Label>
                        <Input 
                          id="invoice" 
                          placeholder="000.000.000" 
                          value={newNote.invoice_number}
                          onChange={(e) => setNewNote({...newNote, invoice_number: e.target.value})}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="due_date" className="text-[10px] font-black uppercase text-slate-500">Data de Vencimento *</Label>
                        <Input 
                          id="due_date" 
                          type="date" 
                          value={newNote.due_date}
                          onChange={(e) => setNewNote({...newNote, due_date: e.target.value})}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Categoria</Label>
                        <Select 
                          value={newNote.category} 
                          onValueChange={(v) => setNewNote({...newNote, category: v})}
                        >
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Compra de Mercadoria">Compra de Mercadoria</SelectItem>
                            <SelectItem value="Ferramentas">Ferramentas</SelectItem>
                            <SelectItem value="Insumos">Insumos</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                          <Package className="h-4 w-4" /> Produtos da Nota
                        </h3>
                        <span className="text-[10px] text-muted-foreground font-bold">{productsList.length} itens adicionados</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Nome do Produto</Label>
                          <Input 
                            placeholder="Ex: Tela iPhone 11 Incell" 
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                            className="h-9 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Qtd</Label>
                          <Input 
                            type="number" 
                            placeholder="1" 
                            value={newProduct.quantity}
                            onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})}
                            className="h-9 rounded-lg text-xs"
                          />
                        </div>
                        <Button type="button" onClick={handleAddProduct} variant="outline" className="h-9 rounded-lg border-dashed">
                          Adicionar
                        </Button>
                      </div>

                      {productsList.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100 max-h-40 overflow-y-auto">
                          {productsList.map((p, i) => (
                            <div key={i} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                              <span className="font-bold text-slate-700">{p.quantity}x {p.name}</span>
                              <button type="button" onClick={() => removeProduct(i)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <DialogFooter className="pt-4 border-t">
                      <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={submitting}>Cancelar</Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold px-8" disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Nota"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="h-11 rounded-xl border-slate-200 font-bold px-6">
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          </div>

          <Card className="border-border shadow-sm overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vencimento</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Valor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                     <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Produtos</th>
                     <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground mt-2 text-xs">Carregando notas em aberto...</p>
                      </td>
                    </tr>
                   ) : filteredTransactions.length > 0 ? filteredTransactions.map(t => {
                     const isOverdue = t.due_date && isAfter(new Date(), parseISO(t.due_date));
                     const isExpanded = expandedRow === t.id;
                     return (
                       <Fragment key={t.id}>
                       <tr className="hover:bg-slate-50/50 transition-colors group">
                         <td className={`px-6 py-4 text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {t.due_date ? format(parseISO(t.due_date), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                            {isOverdue && <span className="bg-red-50 text-[8px] px-1.5 py-0.5 rounded text-red-600 border border-red-100">VENCIDO</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                            </div>
                             <div className="flex flex-col">
                               <span className="font-bold text-sm text-slate-900">{t.description}</span>
                               {t.supplier_name && (
                                 <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mt-0.5">
                                   <Truck className="h-3 w-3" />
                                   Fornecedor: {t.supplier_name}
                                 </div>
                               )}
                               {t.invoice_number && (
                                 <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                   <Receipt className="h-3 w-3" />
                                   NF: {t.invoice_number}
                                 </div>
                               )}
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-tight border border-slate-200">
                            {t.category || "Geral"}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-black text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'income' ? '+' : '-'} {(t.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-700">
                            Pendente
                          </span>
                        </td>
                         <td className="px-6 py-4 text-center">
                           {t.products_list && t.products_list.length > 0 ? (
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               className="h-7 text-[10px] font-bold gap-1"
                               onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                             >
                               <Package className="h-3 w-3" />
                               {t.products_list.length} {t.products_list.length === 1 ? 'item' : 'itens'}
                               {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                             </Button>
                           ) : (
                             <span className="text-[10px] text-muted-foreground italic">—</span>
                           )}
                         </td>
                         <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-green-600 hover:bg-green-50"
                              onClick={() => handleMarkAsPaid(t.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Baixar
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && t.products_list && (
                         <tr className="bg-slate-50/80">
                           <td colSpan={7} className="px-6 py-3">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                               {t.products_list.map((item: any, idx: number) => (
                                 <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                   <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                                     <Package className="h-4 w-4" />
                                   </div>
                                   <div className="flex-1">
                                     <div className="text-[11px] font-bold text-slate-900 leading-tight">{item.name || item.description || 'Produto'}</div>
                                     <div className="text-[10px] text-muted-foreground font-medium">
                                       {item.quantity && `${item.quantity} un`}
                                       {item.price && ` • R$ ${item.price.toLocaleString('pt-BR')}`}
                                     </div>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           </td>
                         </tr>
                       )}
                      </Fragment>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground italic">
                        Nenhuma nota em aberto encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}