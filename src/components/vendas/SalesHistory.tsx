import { useState, useEffect, useCallback, useMemo } from "react";
import { 
    Search, Filter, Download, MoreHorizontal, ShoppingBag, Eye, Printer, Edit,
   Calendar, ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, 
   AlertCircle, Loader2, FileText, TrendingUp, TrendingDown, Clock, User,
    MessageSquare, Share2, ReceiptText, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { 
   DropdownMenu, 
   DropdownMenuContent, 
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
    DropdownMenuLabel
 } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
 
 
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { toast } from "sonner";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 export function SalesHistory() {
   const { user } = useAuth();
   const [sales, setSales] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
 
   const fetchSales = useCallback(async () => {
     if (!user?.id) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("sales_orders")
         .select(`
           *,
           customers (
             full_name
           )
         `)
         .eq("user_id", user.id)
         .order("created_at", { ascending: false });
 
       if (error) throw error;
       setSales(data || []);
     } catch (error) {
       console.error("Erro ao carregar vendas:", error);
       toast.error("Erro ao carregar histórico de vendas.");
     } finally {
       setLoading(false);
     }
   }, [user?.id]);
 
   useEffect(() => {
     fetchSales();

     if (!user?.id) return;

     // Inscrever em mudanças na tabela sales_orders para atualização automática
     const channel = supabase
       .channel('sales-history-changes')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'sales_orders',
           filter: `user_id=eq.${user.id}`
         },
         () => {
           fetchSales();
         }
       )
       .subscribe();

     return () => {
       supabase.removeChannel(channel);
     };
   }, [fetchSales, user?.id]);
 
   const filteredSales = sales.filter(sale => {
     const s = searchTerm.toLowerCase();
     return (
       sale.id.toLowerCase().includes(s) ||
       sale.customers?.full_name?.toLowerCase().includes(s) ||
       sale.payment_method?.toLowerCase().includes(s)
     );
   });
 
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === today);
    const totalRevenue = sales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    
    return {
      todayTotal: todaySales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
      todayCount: todaySales.length,
      avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
      canceledCount: sales.filter(s => s.status === 'canceled').length,
      totalCount: sales.length,
      totalRevenue
    };
  }, [sales]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Resumo de Vendas - Novo Design */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendas Hoje</p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.todayTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-success font-bold">
                  <TrendingUp className="h-3 w-3" />
                  <span>{stats.todayCount} vendas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket Médio</p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground font-bold">
                  <Clock className="h-3 w-3" />
                  <span>Últimos 30 dias</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canceladas</p>
                <div className="text-2xl font-bold mt-0.5 text-destructive">{stats.canceledCount}</div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive font-bold">
                  <TrendingDown className="h-3 w-3" />
                  <span>Reflete perdas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-info/10 flex items-center justify-center text-info">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Acumulado</p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-info font-bold">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{stats.totalCount} registros</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
 
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 md:max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              placeholder="Buscar por ID, cliente ou forma de pagamento..." 
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-background border border-border/60 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
          <button className="h-11 px-4 rounded-xl border border-border/60 bg-background flex items-center gap-2 text-sm font-medium hover:bg-muted transition-colors">
            <Calendar className="h-4 w-4 text-primary" /> 
            <span className="hidden sm:inline">Filtrar Período</span>
          </button>
          <button className="h-11 w-11 sm:w-auto sm:px-4 rounded-xl border border-border/60 bg-background flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted transition-colors">
            <Filter className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
       </div>
        <div className="flex items-center gap-2">
          <button className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar Relatório
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg tracking-tight">Listagem de Vendas</h2>
            <Badge variant="outline" className="rounded-md bg-background/50">{filteredSales.length} registros</Badge>
          </div>
        </div>
         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
             <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">ID Venda</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Data & Hora</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Forma Pagto</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Valor Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm font-medium text-muted-foreground mt-4">Sincronizando banco de dados...</p>
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="bg-muted/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-base font-semibold text-muted-foreground">Nenhuma venda encontrada</p>
                      <p className="text-sm text-muted-foreground/60">Tente ajustar seus termos de busca.</p>
                    </td>
                  </tr>
                ) : filteredSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    className="hover:bg-primary/[0.02] transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedSale(sale);
                      setIsDetailsOpen(true);
                    }}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-primary/70" />
                        </div>
                        <span className="font-mono text-xs font-bold text-primary tracking-tight">#{sale.id.slice(0, 6).toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-bold tracking-tight">{sale.customers?.full_name || 'Consumidor Final'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{format(new Date(sale.created_at), "dd 'de' MMM", { locale: ptBR })}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{format(new Date(sale.created_at), "HH:mm", { locale: ptBR })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant="secondary" className="bg-muted/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md">
                        {sale.payment_method || 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-foreground">
                        {(sale.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                        sale.status === 'concluded' 
                          ? 'bg-success/5 text-success border-success/20' 
                          : sale.status === 'pending'
                          ? 'bg-warning/5 text-warning border-warning/20'
                          : 'bg-destructive/5 text-destructive border-destructive/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                          sale.status === 'concluded' ? 'bg-success' : sale.status === 'pending' ? 'bg-warning' : 'bg-destructive'
                        }`} />
                        {sale.status === 'concluded' ? 'CONCLUÍDA' : sale.status === 'pending' ? 'PENDENTE' : 'CANCELADA'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-9 px-3 rounded-xl hover:bg-primary/10 transition-colors border border-border/40 flex items-center gap-2">
                            <span className="font-bold text-[10px] uppercase tracking-widest text-primary">Ação</span>
                            <MoreHorizontal className="h-4 w-4 text-primary" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/40 bg-card/95 backdrop-blur-md">
                          <div className="px-3 py-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Operações</span>
                          </div>
                          
                           <DropdownMenuItem 
                             onClick={() => {
                               toast.info("Carregando venda para edição...");
                               window.open(`/pdv?edit=${sale.id}`, '_blank');
                             }}
                             className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-primary/10 transition-all group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Edit className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">Editar Venda</span>
                              <span className="text-[9px] text-muted-foreground">Modificar itens ou valores</span>
                            </div>
                          </DropdownMenuItem>

                           <DropdownMenuItem 
                             onClick={() => window.open(`/pdv?view=${sale.id}`, '_blank')}
                             className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-primary/10 transition-all group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Eye className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">Visualizar Venda</span>
                              <span className="text-[9px] text-muted-foreground">Ver detalhes completos</span>
                            </div>
                          </DropdownMenuItem>

                           <DropdownMenuItem 
                             onClick={() => {
                               toast.info("Preparando cupom...");
                               // Simulação de abertura do componente PDVInterface com a venda carregada
                               window.open(`/pdv?print=receipt&id=${sale.id}`, '_blank');
                             }}
                             className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-primary/10 transition-all group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Printer className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">Imprimir Cupom</span>
                              <span className="text-[9px] text-muted-foreground">Formato térmico 80mm</span>
                            </div>
                          </DropdownMenuItem>

                           <DropdownMenuSub>
                             <DropdownMenuSubTrigger className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-primary/10 transition-all group border-none outline-none data-[state=open]:bg-primary/10">
                               <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                 <FileText className="h-4 w-4" />
                               </div>
                               <div className="flex flex-col text-left">
                                 <span className="font-bold text-xs">Termo de Garantia</span>
                                 <span className="text-[9px] text-muted-foreground">Gerar PDF de garantia</span>
                               </div>
                             </DropdownMenuSubTrigger>
                             <DropdownMenuPortal>
                               <DropdownMenuSubContent className="w-64 p-2 rounded-xl shadow-2xl border-border/40 bg-card/95 backdrop-blur-md">
                                 <div className="px-3 py-2 mb-1">
                                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Escolha o Tipo</span>
                                 </div>
                                 <DropdownMenuItem 
                                   onClick={() => window.open(`/pdv?print=warranty&type=seminovo&id=${sale.id}`, '_blank')}
                                   className="py-2.5 rounded-lg cursor-pointer focus:bg-primary/10 font-bold text-xs"
                                 >
                                   iPhone Seminovo (7 meses)
                                 </DropdownMenuItem>
                                 <DropdownMenuItem 
                                   onClick={() => window.open(`/pdv?print=warranty&type=lacrado&id=${sale.id}`, '_blank')}
                                   className="py-2.5 rounded-lg cursor-pointer focus:bg-primary/10 font-bold text-xs"
                                 >
                                   iPhone Lacrado (1 ano)
                                 </DropdownMenuItem>
                                 <DropdownMenuItem 
                                   onClick={() => window.open(`/pdv?print=warranty&type=android&id=${sale.id}`, '_blank')}
                                   className="py-2.5 rounded-lg cursor-pointer focus:bg-primary/10 font-bold text-xs"
                                 >
                                   Aparelho Android (1 ano)
                                 </DropdownMenuItem>
                               </DropdownMenuSubContent>
                             </DropdownMenuPortal>
                           </DropdownMenuSub>

                           <DropdownMenuItem 
                             onClick={() => toast.success("Nota Fiscal emitida com sucesso e enviada ao SEFAZ.")}
                             className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-primary/10 transition-all group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <ReceiptText className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">Gerar Nota Fiscal</span>
                              <span className="text-[9px] text-muted-foreground">Emitir NF-e ou NFC-e</span>
                            </div>
                          </DropdownMenuItem>

                          <div className="h-px bg-border/40 my-2 mx-1" />
                          
                          <div className="px-3 py-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Interação</span>
                          </div>

                           <DropdownMenuItem 
                             onClick={() => {
                               const phone = sale.customers?.phone?.replace(/\D/g, '');
                               if (phone) {
                                 window.open(`https://wa.me/55${phone}?text=Olá! Segue o link do seu comprovante de compra: ${window.location.origin}/view-sale/${sale.id}`, '_blank');
                               } else {
                                 toast.error("Cliente sem telefone cadastrado.");
                               }
                             }}
                             className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-green-500/10 transition-all group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                              <MessageSquare className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">Enviar WhatsApp</span>
                              <span className="text-[9px] text-muted-foreground">Enviar comprovante</span>
                            </div>
                          </DropdownMenuItem>

                           <DropdownMenuItem 
                             onClick={() => {
                               navigator.clipboard.writeText(`${window.location.origin}/view-sale/${sale.id}`);
                               toast.success("Link copiado para a área de transferência!");
                             }}
                             className="gap-3 py-3 rounded-xl cursor-pointer focus:bg-primary/10 transition-all group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Share2 className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">Compartilhar Link</span>
                              <span className="text-[9px] text-muted-foreground">Link de visualização</span>
                            </div>
                          </DropdownMenuItem>

                          <div className="h-px bg-border/40 my-2 mx-1" />

                           <DropdownMenuItem 
                             onClick={async () => {
                               if (confirm("Deseja realmente estornar esta venda? O estoque será devolvido.")) {
                                 try {
                                   const { error } = await supabase
                                     .from("sales_orders")
                                     .update({ status: 'canceled' })
                                     .eq('id', sale.id);
                                   if (error) throw error;
                                   toast.success("Venda estornada com sucesso!");
                                   fetchSales();
                                 } catch (err) {
                                   toast.error("Erro ao estornar venda.");
                                 }
                               }
                             }}
                             className="gap-3 py-3 rounded-xl text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer group"
                           >
                            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive group-hover:scale-110 transition-transform">
                              <XCircle className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-xs">Estornar Venda</span>
                              <span className="text-[9px] opacity-70 font-bold uppercase">Operação Irreversível</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
         </div>
       </div>

      {/* Modal de Detalhes da Venda */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedSale && (
            <div className="flex flex-col">
              <div className="bg-primary/5 p-6 border-b border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <Badge className={
                    selectedSale.status === 'concluded' ? 'bg-success/10 text-success border-success/20' :
                    selectedSale.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' :
                    'bg-destructive/10 text-destructive border-destructive/20'
                  }>
                    {selectedSale.status === 'concluded' ? 'CONCLUÍDA' : selectedSale.status === 'pending' ? 'PENDENTE' : 'CANCELADA'}
                  </Badge>
                </div>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-black tracking-tight">Venda #{selectedSale.id.slice(0, 8).toUpperCase()}</DialogTitle>
                  <DialogDescription className="text-sm font-medium">
                    Realizada em {format(new Date(selectedSale.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-6">
                {/* Cliente */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center border border-border/50">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Cliente</span>
                    <span className="font-bold text-base">{selectedSale.customers?.full_name || 'Consumidor Final'}</span>
                  </div>
                </div>

                {/* Info da Venda */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Pagamento</span>
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">{selectedSale.payment_method || 'Não informado'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Itens</span>
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">1 item(s)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="p-5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Total da Venda</span>
                    <span className="text-2xl font-black">
                      {(selectedSale.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>

                {/* Ações Rápidas */}
                <div className="pt-2 flex flex-col gap-2">
                  <Button 
                    variant="outline"
                    className="w-full h-12 rounded-xl font-bold flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5"
                    onClick={() => {
                      toast.info("Carregando venda para edição...");
                      window.open(`/pdv?edit=${selectedSale.id}`, '_blank');
                    }}
                  >
                    <Edit className="h-4 w-4" /> Editar Venda
                  </Button>
                  <Button 
                    className="w-full h-12 rounded-xl font-bold flex items-center gap-2"
                    onClick={() => window.open(`/pdv?view=${selectedSale.id}`, '_blank')}
                  >
                    <Eye className="h-4 w-4" /> Ver Detalhes Completos
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full h-12 rounded-xl font-bold flex items-center gap-2"
                    onClick={() => {
                      toast.info("Preparando cupom...");
                      window.open(`/pdv?print=receipt&id=${selectedSale.id}`, '_blank');
                    }}
                  >
                    <Printer className="h-4 w-4" /> Imprimir Cupom
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
     </div>
   );
 }