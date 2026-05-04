  import { DollarSign, ArrowUpRight, ArrowDownRight, Wallet, Building2, Receipt, ArrowRight, TrendingUp, TrendingDown, PieChart, Plus, Calendar, Loader2, Edit, Trash2, Info } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
 import { useState, useEffect, useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { startOfMonth, endOfMonth, subMonths, format, isWithinInterval } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { TransactionForm } from "./TransactionForm";
 import { toast } from "sonner";

export function FinanceDashboard() {
  const navigate = useNavigate();
   const { user } = useAuth();
   const [transactions, setTransactions] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
 
   const fetchTransactions = async () => {
     if (!user?.id) return;
     setLoading(true);
      try {
        const { data, error } = await supabase
          .from("finance_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order('created_at', { ascending: false });
       if (error) throw error;
       setTransactions(data || []);
     } catch (error) {
       console.error("Erro:", error);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchTransactions();
   }, [user?.id]);
 
   const stats = useMemo(() => {
     const now = new Date();
     const currentMonthStart = startOfMonth(now);
     const currentMonthEnd = endOfMonth(now);
     
     const monthIncome = transactions
       .filter(t => t.type === 'income' && t.payment_date && isWithinInterval(new Date(t.payment_date), { start: currentMonthStart, end: currentMonthEnd }))
       .reduce((acc, t) => acc + (t.amount || 0), 0);
       
     const monthExpense = transactions
       .filter(t => t.type === 'expense' && t.payment_date && isWithinInterval(new Date(t.payment_date), { start: currentMonthStart, end: currentMonthEnd }))
       .reduce((acc, t) => acc + (t.amount || 0), 0);
 
     const totalBalance = transactions
       .reduce((acc, t) => acc + (t.type === 'income' ? (t.amount || 0) : -(t.amount || 0)), 0);
 
     return { monthIncome, monthExpense, totalBalance };
   }, [transactions]);
 
   const chartData = useMemo(() => {
     const data = [];
     for (let i = 5; i >= 0; i--) {
       const date = subMonths(new Date(), i);
       const start = startOfMonth(date);
       const end = endOfMonth(date);
       const monthName = format(date, "MMM", { locale: ptBR });
       
       const receitas = transactions
         .filter(t => t.type === 'income' && t.payment_date && isWithinInterval(new Date(t.payment_date), { start, end }))
         .reduce((acc, t) => acc + (t.amount || 0), 0);
         
       const despesas = transactions
         .filter(t => t.type === 'expense' && t.payment_date && isWithinInterval(new Date(t.payment_date), { start, end }))
         .reduce((acc, t) => acc + (t.amount || 0), 0);
         
       data.push({ name: monthName, receitas, despesas });
     }
     return data;
   }, [transactions]);
 
    const despesasPorCategoria = useMemo(() => {
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);

      const cats: Record<string, number> = {};
      const colors = ["#2563eb", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
      
      const currentMonthExpenses = transactions
        .filter(t => 
          t.type === 'expense' && 
          t.payment_date && 
          isWithinInterval(new Date(t.payment_date), { start: currentMonthStart, end: currentMonthEnd })
        );

      const totalMonthExpense = currentMonthExpenses.reduce((acc, t) => acc + (t.amount || 0), 0);
        
      currentMonthExpenses.forEach(t => {
        const cat = t.category || "Geral";
        cats[cat] = (cats[cat] || 0) + (t.amount || 0);
      });
        
      return Object.entries(cats).map(([name, value], i) => ({
        name,
        value,
        percentage: totalMonthExpense > 0 ? (value / totalMonthExpense) * 100 : 0,
        color: colors[i % colors.length]
      })).sort((a, b) => b.value - a.value).slice(0, 5);
    }, [transactions]);
 
   const [editingTransaction, setEditingTransaction] = useState<any>(null);
 
   const handleSave = async (data: any) => {
     if (!user?.id) return;
     try {
       if (editingTransaction) {
         const { error } = await supabase
           .from("finance_transactions")
           .update(data)
           .eq("id", editingTransaction.id);
         if (error) throw error;
         toast.success("Lançamento atualizado!");
       } else {
         const { error } = await supabase
           .from("finance_transactions")
           .insert([{ ...data, user_id: user.id }]);
         if (error) throw error;
         toast.success("Lançamento criado!");
       }
       fetchTransactions();
       setIsFormOpen(false);
       setEditingTransaction(null);
     } catch (error) {
       toast.error("Erro ao salvar lançamento");
     }
   };
 
   const handleDelete = async (id: string) => {
     if (!window.confirm("Deseja excluir este lançamento?")) return;
     try {
       const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
       if (error) throw error;
       toast.success("Lançamento excluído!");
       fetchTransactions();
     } catch (error) {
       toast.error("Erro ao excluir lançamento");
     }
   };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Dashboard Financeiro</h1>
          <p className="text-muted-foreground text-sm font-medium">Acompanhe a saúde financeira da sua empresa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2 font-bold rounded-xl border-slate-200 shadow-sm">
            <Calendar className="h-4 w-4" /> Últimos 30 dias
          </Button>
           <Button onClick={() => setIsFormOpen(true)} size="sm" className="h-9 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200">
            <Plus className="h-4 w-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="border-border shadow-sm overflow-hidden rounded-2xl cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setSelectedCard('entradas')}
          >
            <CardContent className="p-6">
             <div className="flex items-center justify-between mb-4">
               <div className="h-10 w-10 rounded-xl bg-green-100/50 text-green-600 grid place-items-center">
                 <TrendingUp className="h-5 w-5" />
               </div>
               <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase tracking-tighter">+15.2% vs mês ant.</span>
             </div>
             <div className="text-[11px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1.5">
               Entradas (Mês)
               <Info className="h-3 w-3 opacity-30" />
             </div>
              {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" /> : (
                <div className="text-3xl font-black mt-1 flex items-baseline gap-1 text-slate-900">
                  <span className="text-sm font-bold text-muted-foreground">R$</span>
                  {stats.monthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              )}
           </CardContent>
         </Card>

          <Card 
            className="border-border shadow-sm overflow-hidden rounded-2xl cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setSelectedCard('saidas')}
          >
            <CardContent className="p-6">
             <div className="flex items-center justify-between mb-4">
               <div className="h-10 w-10 rounded-xl bg-red-100/50 text-red-600 grid place-items-center">
                 <TrendingDown className="h-5 w-5" />
               </div>
               <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase tracking-tighter">-2.4% vs mês ant.</span>
             </div>
             <div className="text-[11px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1.5">
               Saídas (Mês)
               <Info className="h-3 w-3 opacity-30" />
             </div>
              {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" /> : (
                <div className="text-3xl font-black mt-1 flex items-baseline gap-1 text-slate-900">
                  <span className="text-sm font-bold text-muted-foreground">R$</span>
                  {stats.monthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              )}
           </CardContent>
         </Card>

          <Card 
            className="border-border shadow-sm overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/50 to-transparent cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setSelectedCard('saldo')}
          >
            <CardContent className="p-6">
             <div className="flex items-center justify-between mb-4">
               <div className="h-10 w-10 rounded-xl bg-blue-100/50 text-blue-600 grid place-items-center">
                 <Wallet className="h-5 w-5" />
               </div>
               <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-tighter">Meta: 92% atingida</span>
             </div>
             <div className="text-[11px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1.5">
               Saldo Projetado
               <Info className="h-3 w-3 opacity-30" />
             </div>
              {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" /> : (
                <div className="text-3xl font-black mt-1 text-blue-600 flex items-baseline gap-1">
                  <span className="text-sm font-bold">R$</span>
                  {stats.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              )}
           </CardContent>
         </Card>
       </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card 
           className="lg:col-span-2 border-border shadow-sm rounded-2xl cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.99]"
           onClick={() => navigate({ to: "/financeiro/caixa" })}
         >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
                <TrendingUp className="h-4 w-4 text-blue-600" /> Fluxo de Caixa (6 Meses)
              </CardTitle>
              <CardDescription className="font-medium text-xs">Comparativo entre entradas e saídas mensais</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                <span>Entradas</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <span>Saídas</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }}
                    tickFormatter={(value) => `R$ ${value/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="receitas" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorReceitas)" />
                  <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesas)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

         <Card 
           className="border-border shadow-sm rounded-2xl cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
           onClick={() => navigate({ to: "/financeiro/caixa" })}
         >
          <CardHeader className="pb-7">
            <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
              <PieChart className="h-4 w-4 text-blue-600" /> Gastos por Categoria
            </CardTitle>
            <CardDescription className="font-medium text-xs">Distribuição de despesas no mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {despesasPorCategoria.length > 0 ? despesasPorCategoria.map((cat, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <span className="font-bold text-slate-700 truncate max-w-[120px] uppercase tracking-tighter">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">{cat.percentage.toFixed(1)}%</span>
                      <span className="font-black text-slate-900">R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out" 
                      style={{ 
                        width: `${cat.percentage}%`, 
                        backgroundColor: cat.color,
                        boxShadow: `0 0 8px ${cat.color}40`
                      }}
                    ></div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                    <PieChart className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Nenhum gasto registrado este mês</p>
                </div>
              )}
            </div>
            
            {despesasPorCategoria.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total do Mês</div>
                  <div className="text-sm font-black text-red-600">
                    R$ {despesasPorCategoria.reduce((acc, c) => acc + c.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

 
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card 
           className="border-border shadow-sm flex flex-col rounded-2xl cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
           onClick={() => navigate({ to: "/financeiro/caixa" })}
         >
           <CardHeader className="flex flex-row items-center justify-between pb-4">
             <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
               <Building2 className="h-4 w-4 text-blue-600" /> Contas e Bancos
             </CardTitle>
             <button 
               onClick={() => navigate({ to: "/financeiro/caixa" })}
               className="text-[11px] font-black text-blue-600 hover:underline flex items-center gap-1 uppercase tracking-wider"
             >
               Ver Tudo <ArrowRight className="h-3 w-3" />
             </button>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
               <div className="flex items-center gap-3">
                 <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 grid place-items-center shadow-sm">
                   <Wallet className="h-4 w-4 text-blue-600" />
                 </div>
                 <div>
                   <div className="text-xs font-black text-slate-900 uppercase tracking-tighter">Caixa Geral</div>
                   <div className="text-[10px] font-bold text-muted-foreground uppercase">Saldo Disponível</div>
                 </div>
               </div>
               <div className="text-right">
                    <div className="text-sm font-black text-slate-900">R$ {(stats.totalBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card 
           className="border-border shadow-sm flex flex-col rounded-2xl cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
           onClick={() => navigate({ to: "/financeiro/caixa" })}
         >
           <CardHeader className="pb-4">
             <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
               <Receipt className="h-4 w-4 text-blue-600" /> Lançamentos Recentes
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
                {transactions.slice(0, 5).map((t, i) => (
                  <div key={i} className="group flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                     <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                       {t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                     </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 truncate">{t.description}</div>
                        <div className="text-[10px] text-muted-foreground">{t.category} • {t.payment_date ? new Date(t.payment_date).toLocaleDateString('pt-BR') : 'Sem data'}</div>
                     </div>
                   </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xs font-black ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR')}
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTransaction(t);
                            setIsFormOpen(true);
                          }}
                          className="p-1 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t.id);
                          }}
                          className="p-1 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                   </div>
                 </div>
               ))}
               {transactions.length === 0 && (
                 <div className="text-center text-xs text-muted-foreground py-8 italic border border-dashed border-slate-100 rounded-xl">
                   Nenhum lançamento recente
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       </div>
 
          <TransactionForm 
            open={isFormOpen} 
            onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingTransaction(null); }} 
            onSave={handleSave} 
            transaction={editingTransaction}
          />

          <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
            <DialogContent className="sm:max-w-[500px] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                  {selectedCard === 'entradas' && <><TrendingUp className="h-5 w-5 text-green-600" /> Detalhes de Entradas</>}
                  {selectedCard === 'saidas' && <><TrendingDown className="h-5 w-5 text-red-600" /> Detalhes de Saídas</>}
                  {selectedCard === 'saldo' && <><Wallet className="h-5 w-5 text-blue-600" /> Detalhes do Saldo</>}
                </DialogTitle>
                <DialogDescription className="font-medium">
                  Análise detalhada do período atual
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Valor Total</div>
                  <div className={`text-3xl font-black ${
                    selectedCard === 'entradas' ? 'text-green-600' : 
                    selectedCard === 'saidas' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    R$ {
                      selectedCard === 'entradas' ? stats.monthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) :
                      selectedCard === 'saidas' ? stats.monthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) :
                      stats.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    }
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Resumo por Categoria</h4>
                  <div className="space-y-2">
                    {transactions
                      .filter(t => {
                        if (selectedCard === 'entradas') return t.type === 'income';
                        if (selectedCard === 'saidas') return t.type === 'expense';
                        return true;
                      })
                      .reduce((acc: any[], t) => {
                        const existing = acc.find(a => a.name === (t.category || 'Geral'));
                        if (existing) existing.value += t.amount;
                        else acc.push({ name: t.category || 'Geral', value: t.amount });
                        return acc;
                      }, [])
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 4)
                      .map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                          <span className="text-xs font-bold text-slate-700">{item.name}</span>
                          <span className="text-xs font-black text-slate-900">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    setSelectedCard(null);
                    navigate({ to: "/financeiro/caixa" });
                  }}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                >
                  Ver Fluxo de Caixa Completo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>
   );
 }