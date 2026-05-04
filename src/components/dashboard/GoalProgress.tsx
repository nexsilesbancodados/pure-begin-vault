 import { Target, TrendingUp, Edit2, Save, X, Calendar, Trophy, Zap, Activity, Info, BarChart3, Rocket, DollarSign, Package, TrendingDown, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
 import { Button } from "@/components/ui/button";
 import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface GoalProgressProps {
  current: number;
  goal?: number;
  onGoalUpdate?: () => void;
}

export function GoalProgress({ current, goal: initialGoal = 50000, onGoalUpdate }: GoalProgressProps) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
   const initialGoalState = {
     daily: 0,
     weekly: 0,
     monthly: initialGoal,
     type: 'revenue' as 'revenue' | 'units' | 'profit',
     goal_name: "",
     start_date: new Date().toISOString().split('T')[0],
     end_date: "",
     notes: ""
   };
   const [goals, setGoals] = useState(initialGoalState);
   const [editGoals, setEditGoals] = useState(initialGoalState);

  useEffect(() => {
    if (user?.id) {
      fetchGoals();
    }
  }, [user?.id]);

  const fetchGoals = async () => {
     const { data, error } = await (supabase
       .from('business_goals')
       .select('*') as any)
       .eq('user_id', user?.id || '')
      .maybeSingle();

    if (data) {
       const fetchedGoals = {
         daily: Number(data.daily_goal) || 0,
         weekly: Number(data.weekly_goal) || 0,
         monthly: Number(data.monthly_goal) || initialGoal,
         type: (data.goal_type as any) || 'revenue',
         goal_name: data.goal_name || "",
         start_date: data.start_date || new Date().toISOString().split('T')[0],
         end_date: data.end_date || "",
         notes: data.notes || ""
       };
       setGoals(fetchedGoals);
       setEditGoals(fetchedGoals);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
       const { error } = await (supabase
         .from('business_goals')
         .upsert({
           user_id: user.id,
           daily_goal: editGoals.daily,
           weekly_goal: editGoals.weekly,
           monthly_goal: editGoals.monthly,
           goal_type: editGoals.type,
           goal_name: editGoals.goal_name,
           start_date: editGoals.start_date,
           end_date: editGoals.end_date,
           notes: editGoals.notes,
           updated_at: new Date().toISOString()
         } as any));

      if (error) throw error;

      setGoals({ ...editGoals });
      setIsModalOpen(false);
      toast.success("Metas atualizadas com sucesso!");
      if (onGoalUpdate) onGoalUpdate();
    } catch (error) {
      console.error("Erro ao salvar metas:", error);
      toast.error("Erro ao salvar metas");
    } finally {
      setIsLoading(false);
    }
  };

  // We need to fetch the actual value based on the goal type (revenue, units, profit)
  // since the parent might only pass revenue.
  const [calculatedCurrent, setCalculatedCurrent] = useState(current);

  useEffect(() => {
    const calculateValue = async () => {
      if (!user?.id) return;
      
      const firstDayMonth = new Date();
      firstDayMonth.setDate(1);
      firstDayMonth.setHours(0, 0, 0, 0);

      const { data: sales, error } = await supabase
        .from("sales_orders")
        .select("total_amount, status, created_at")
        .eq("user_id", user.id)
        .gte("created_at", firstDayMonth.toISOString())
        .eq("status", "concluded");

      if (error) return;

      if (goals.type === 'units') {
        setCalculatedCurrent(sales?.length || 0);
      } else if (goals.type === 'profit') {
        // Assuming 30% profit if no cost data is available, otherwise sum profit field
        const revenue = sales?.reduce((acc, s) => acc + (s.total_amount || 0), 0) || 0;
        setCalculatedCurrent(revenue * 0.3);
      } else {
        const revenue = sales?.reduce((acc, s) => acc + (s.total_amount || 0), 0) || 0;
        setCalculatedCurrent(revenue);
      }
    };

    calculateValue();
  }, [goals.type, user?.id, current]);

  const displayCurrent = calculatedCurrent;
  const pct = Math.min(100, Math.round((displayCurrent / (goals.monthly || 1)) * 100)) || 0;
  const remaining = Math.max(0, (goals.monthly || 0) - displayCurrent);

  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100);
  const onTrack = pct >= expectedPct;
  
  // Projections
  const dailyProjection = editGoals.daily * daysInMonth;
  const formatValue = (val: number) => {
    if (editGoals.type === 'units') return `${val} un.`;
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // SVG ring
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="rounded-2xl bg-card border border-border p-5 shadow-card relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all group"
      >
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-10 blur-2xl bg-gradient-primary" />
        <div className="flex items-center justify-between mb-4 relative">
          <div>
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Meta do Mês
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {dayOfMonth} de {daysInMonth} dias decorridos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${onTrack ? "bg-success/15 text-success" : "bg-warning/15 text-[oklch(0.55_0.15_75)]"}`}>
              {onTrack ? "No ritmo" : "Atrasado"}
            </span>
            <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center gap-4 relative min-w-0">
          <div className="relative h-[120px] w-[120px] sm:h-[130px] sm:w-[130px] shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="goalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="oklch(0.65 0.2 330)" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={radius} stroke="var(--color-muted)" strokeWidth="10" fill="none" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="url(#goalGrad)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
               <div className="text-[32px] font-black font-display tracking-tight bg-gradient-primary bg-clip-text text-transparent leading-none">
                {pct}%
              </div>
               <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">atingido</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">Realizado</div>
            <div className="text-base sm:text-lg font-bold font-display truncate">
              {goals.type === 'units' 
                ? `${displayCurrent} un.` 
                : displayCurrent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">Meta ({goals.type === 'revenue' ? 'Faturamento' : goals.type === 'units' ? 'Aparelhos' : 'Lucro'})</div>
            <div className="text-xs sm:text-sm font-semibold text-foreground/70 truncate">
              {goals.type === 'units'
                ? `${goals.monthly} un.`
                : (goals.monthly || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <div className="pt-2 border-t border-border min-w-0">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Faltam
            </div>
            <div className="text-[13px] font-semibold text-primary truncate">
              {goals.type === 'units'
                ? `${remaining} un.`
                : remaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        </div>
      </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
         <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
           <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6">
             <DialogHeader className="mb-6">
               <div className="flex items-center gap-4">
                 <div className="h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center transform -rotate-3 hover:rotate-0 transition-transform">
                   <Trophy className="h-8 w-8 text-primary-foreground" />
                 </div>
                 <div>
                   <DialogTitle className="text-2xl font-black tracking-tight">Definição de Metas</DialogTitle>
                   <DialogDescription className="text-muted-foreground font-medium">
                     Configure seus objetivos e acelere seus resultados.
                   </DialogDescription>
                 </div>
               </div>
             </DialogHeader>
             
             <div className="space-y-6">
               {/* Goal Type Selection with Better UX */}
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <Label className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Focar em:</Label>
                   <TooltipProvider>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                       </TooltipTrigger>
                       <TooltipContent>
                         <p className="max-w-xs text-xs">Escolha a métrica principal que deseja acompanhar no seu dashboard.</p>
                       </TooltipContent>
                     </Tooltip>
                   </TooltipProvider>
                 </div>
                 <ToggleGroup 
                   type="single" 
                   value={editGoals.type} 
                   onValueChange={(val) => val && setEditGoals({ ...editGoals, type: val as any })}
                   className="grid grid-cols-3 gap-3"
                 >
                   <ToggleGroupItem 
                     value="revenue" 
                     className="flex flex-col gap-2 h-auto py-4 rounded-2xl border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/5 transition-all"
                   >
                     <DollarSign className="h-5 w-5" />
                     <span className="text-[11px] font-bold">Faturamento</span>
                   </ToggleGroupItem>
                   <ToggleGroupItem 
                     value="units" 
                     className="flex flex-col gap-2 h-auto py-4 rounded-2xl border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/5 transition-all"
                   >
                     <Package className="h-5 w-5" />
                     <span className="text-[11px] font-bold">Vendas (un)</span>
                   </ToggleGroupItem>
                   <ToggleGroupItem 
                     value="profit" 
                     className="flex flex-col gap-2 h-auto py-4 rounded-2xl border-2 data-[state=on]:border-primary data-[state=on]:bg-primary/5 transition-all"
                   >
                     <BarChart3 className="h-5 w-5" />
                     <span className="text-[11px] font-bold">Lucro</span>
                   </ToggleGroupItem>
                 </ToggleGroup>
               </div>
 
               <Separator className="bg-border/50" />
 
               {/* Inputs Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                   <div className="grid gap-2">
                     <Label htmlFor="name" className="text-[13px] font-bold">Nome da Meta</Label>
                     <Input
                       id="name"
                       value={editGoals.goal_name}
                       onChange={(e) => setEditGoals({ ...editGoals, goal_name: e.target.value })}
                       className="h-12 rounded-xl bg-card border-border/50"
                       placeholder="Ex: Vendas de Verão"
                     />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="grid gap-2">
                       <Label htmlFor="start" className="text-[13px] font-bold">Início</Label>
                       <Input
                         id="start"
                         type="date"
                         value={editGoals.start_date}
                         onChange={(e) => setEditGoals({ ...editGoals, start_date: e.target.value })}
                         className="h-12 rounded-xl bg-card border-border/50"
                       />
                     </div>
                     <div className="grid gap-2">
                       <Label htmlFor="end" className="text-[13px] font-bold">Término</Label>
                       <Input
                         id="end"
                         type="date"
                         value={editGoals.end_date}
                         onChange={(e) => setEditGoals({ ...editGoals, end_date: e.target.value })}
                         className="h-12 rounded-xl bg-card border-border/50"
                       />
                     </div>
                   </div>
                   <div className="grid gap-2">
                     <Label htmlFor="daily" className="text-[13px] font-bold flex items-center gap-2">
                       <Zap className="h-4 w-4 text-warning fill-warning/20" />
                       Meta Diária
                     </Label>
                     <div className="relative group">
                       {editGoals.type !== 'units' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>}
                       <Input
                         id="daily"
                         type="number"
                         value={editGoals.daily}
                         onChange={(e) => setEditGoals({ ...editGoals, daily: Number(e.target.value) })}
                         className={`${editGoals.type !== 'units' ? 'pl-10' : 'pl-4'} h-12 rounded-xl bg-card border-border/50 focus:border-primary focus:ring-primary/20 font-black text-lg transition-all`}
                       />
                       {editGoals.type === 'units' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">un.</span>}
                     </div>
                   </div>
 
                    <div className="grid gap-2">
                      <Label htmlFor="weekly" className="text-[13px] font-bold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-sky-500 fill-sky-500/20" />
                        Meta Semanal
                      </Label>
                      <div className="relative group">
                        {editGoals.type !== 'units' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>}
                        <Input
                          id="weekly"
                          type="number"
                          value={editGoals.weekly}
                          onChange={(e) => setEditGoals({ ...editGoals, weekly: Number(e.target.value) })}
                          className={`${editGoals.type !== 'units' ? 'pl-10' : 'pl-4'} h-12 rounded-xl bg-card border-border/50 focus:border-primary focus:ring-primary/20 font-black text-lg transition-all`}
                        />
                        {editGoals.type === 'units' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">un.</span>}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes" className="text-[13px] font-bold">Observações / Plano de Ação</Label>
                      <textarea
                        id="notes"
                        value={editGoals.notes}
                        onChange={(e) => setEditGoals({ ...editGoals, notes: e.target.value })}
                        className="flex min-h-[80px] w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none"
                        placeholder="Quais estratégias você vai usar para bater essa meta?"
                      />
                    </div>
                 </div>
 
                 <div className="space-y-4">
                   <div className="grid gap-2 h-full">
                     <Label htmlFor="monthly" className="text-[13px] font-bold flex items-center gap-2">
                       <Target className="h-4 w-4 text-primary fill-primary/20" />
                       Meta Mensal (Foco)
                     </Label>
                     <div className="relative group">
                       {editGoals.type !== 'units' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>}
                       <Input
                         id="monthly"
                         type="number"
                         value={editGoals.monthly}
                         onChange={(e) => setEditGoals({ ...editGoals, monthly: Number(e.target.value) })}
                         className={`${editGoals.type !== 'units' ? 'pl-10' : 'pl-4'} h-full min-h-[112px] rounded-xl bg-card border-border/50 focus:border-primary focus:ring-primary/20 font-black text-2xl transition-all text-primary`}
                       />
                       {editGoals.type === 'units' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">un.</span>}
                     </div>
                   </div>
                 </div>
               </div>
 
               {/* Insight/Projection Box */}
               <div className={`p-4 rounded-2xl border transition-all ${Math.abs(dailyProjection - editGoals.monthly) < 10 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                 <div className="flex gap-3">
                   <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${Math.abs(dailyProjection - editGoals.monthly) < 10 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}>
                     {Math.abs(dailyProjection - editGoals.monthly) < 10 ? <CheckCircle2 className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
                   </div>
                   <div>
                     <h4 className="text-[13px] font-bold">Projeção Baseada no Dia</h4>
                     <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                       Mantendo a meta diária de <span className="font-bold text-foreground">{formatValue(editGoals.daily)}</span>, seu resultado mensal será de <span className="font-black text-primary">{formatValue(dailyProjection)}</span>.
                     </p>
                   </div>
                 </div>
               </div>
 
               {/* Footer / Actions */}
               <div className="flex items-center gap-3 pt-4">
                 <Button 
                   variant="ghost" 
                   onClick={() => setIsModalOpen(false)} 
                   className="flex-1 h-12 rounded-xl font-bold text-muted-foreground hover:bg-muted"
                 >
                   <X className="h-4 w-4 mr-2" />
                   Cancelar
                 </Button>
                 <Button 
                   onClick={handleSave} 
                   disabled={isLoading} 
                   className="flex-[2] h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
                 >
                   {isLoading ? (
                     <Activity className="h-4 w-4 mr-2 animate-spin" />
                   ) : (
                     <Save className="h-4 w-4 mr-2" />
                   )}
                   Definir Novas Metas
                 </Button>
               </div>
             </div>
           </div>
         </DialogContent>
      </Dialog>
    </>
  );
}
