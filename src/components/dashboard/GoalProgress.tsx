import {
  Target,
  Edit2,
  Save,
  Trophy,
  Activity,
  Rocket,
  Package,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Plus,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function GoalProgress({
  current: parentCurrent,
  goal: initialGoal = 50000,
  onGoalUpdate,
}: GoalProgressProps) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "settings">("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<"month" | "last_month" | "last30" | "year">("month");
  const initialGoalState = {
    daily: 0,
    weekly: 0,
    monthly: 100,
    type: "units" as const,
    goal_name: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    notes: "",
  };
  const [goals, setGoals] = useState(initialGoalState);
  const [editGoals, setEditGoals] = useState(initialGoalState);
  const [stats, setStats] = useState({ units: 0 });

  useEffect(() => {
    if (user?.id) fetchGoals();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && orgId) fetchStats();
  }, [user?.id, orgId, period]);

  const fetchGoals = async () => {
    if (!user?.id || !orgId) return;
    const { data } = await supabase
      .from("business_goals")
      .select("*")
      .eq("organization_id", orgId)
      .eq("type", "units")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const target = Number(data.target_value) || 100;
      const fetchedGoals = {
        daily: target / 30,
        weekly: target / 4,
        monthly: target,
        type: "units" as const,
        goal_name: data.title || "",
        start_date: data.created_at || new Date().toISOString().split("T")[0],
        end_date: data.deadline || "",
        notes: "",
      };
      setGoals(fetchedGoals);
      setEditGoals(fetchedGoals);
    }
  };

  const getPeriodRange = () => {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    switch (period) {
      case "month":
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case "last_month": {
        start.setMonth(now.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start, end: e };
      }
      case "last30":
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case "year":
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    return { start, end };
  };

  const fetchStats = async () => {
    const { start, end } = getPeriodRange();
    const { data: sales } = await supabase
      .from("sales_orders")
      .select("id, total_amount, sale_items:sale_items(quantity)")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .in("status", ["completed", "concluded"])
      .in("channel", ["pdv", "import"])
      .eq("organization_id", orgId);

    let units = 0;
    (sales || []).forEach((s: any) => {
      const items = s.sale_items || [];
      if (items.length) {
        units += items.reduce((a: number, i: any) => a + (Number(i.quantity) || 0), 0);
      } else {
        units += 1;
      }
    });
    setStats({ units });
  };

  const handleSave = async () => {
    if (!user?.id || !orgId) {
      toast.error("Usuário ou organização não identificados");
      return;
    }
    setIsLoading(true);
    try {
      // Find existing goal for this org to update it, or it will create a new one
      const { data: existingGoal } = await supabase
        .from("business_goals")
        .select("id")
        .eq("organization_id", orgId)
        .maybeSingle();

      const goalData = {
        organization_id: orgId,
        title: editGoals.goal_name || "Meta de Vendas",
        target_value: editGoals.monthly,
        type: editGoals.type,
        deadline: editGoals.end_date || null,
        current_value: currentDisplay,
      };

      let error;
      if (existingGoal?.id) {
        const { error: updateError } = await supabase
          .from("business_goals")
          .update(goalData)
          .eq("id", existingGoal.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("business_goals")
          .insert([goalData]);
        error = insertError;
      }

      if (error) throw error;
      
      setGoals({ ...editGoals });
      setIsModalOpen(false);
      toast.success("Metas atualizadas com sucesso!");
      if (onGoalUpdate) onGoalUpdate();
    } catch (e: any) {
      console.error("Erro ao salvar metas:", e);
      toast.error(`Erro ao salvar metas: ${e.message || "Tente novamente"}`);
    } finally {
      setIsLoading(false);
    }
  };


  const currentDisplay = stats.units;
  const pct = Math.min(100, Math.round((currentDisplay / (goals.monthly || 1)) * 100)) || 0;
  const projection = Math.round((stats.units / (new Date().getDate() || 1)) * 30);
  const remaining = Math.max(0, goals.monthly - stats.units);

  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100);
  const onTrack = pct >= expectedPct;

  // SVG ring logic
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
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-full ${onTrack ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
            >
              {onTrack ? "No ritmo" : "Atrasado"}
            </span>
            <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center gap-4 relative min-w-0">
          <div className="relative h-[110px] w-[110px] shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} stroke="var(--color-muted)" strokeWidth="10" fill="none" />
              <circle
                cx="70" cy="70" r={radius}
                stroke="var(--color-primary)" strokeWidth="10" fill="none" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[28px] font-black font-display tracking-tight text-primary leading-none">
                  {pct}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="text-[11px] text-muted-foreground">Realizado</div>
              <div className="text-lg font-bold font-display truncate">
                {goals.type === "units" ? `${stats.units} un.` : stats.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <PieChart className="h-3 w-3" /> Lucro Est.
              </div>
              <div className="text-[13px] font-semibold text-emerald-600 truncate">
                {stats.profit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <Tabs defaultValue="overview" className="w-full">
            <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 pb-0">
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Trophy className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">Análise de Metas</DialogTitle>
                    <DialogDescription className="font-medium">Gestão integrada de vendas, faturamento e lucratividade.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12 rounded-2xl">
                <TabsTrigger value="overview" className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Visão Geral de Performance</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Ajustar Objetivos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Main Progress Cards */}
                <div className="space-y-4">
                  {[
                    { label: "Vendas Concluídas", value: stats.units, goal: goals.type === "units" ? goals.monthly : null, unit: "un.", icon: Package, color: "bg-blue-500", progress: goals.type === "units" ? pct : Math.min(100, (stats.units / 100) * 100) },
                    { label: "Faturamento Total", value: stats.revenue, goal: goals.type === "revenue" ? goals.monthly : null, icon: DollarSign, color: "bg-emerald-500", progress: goals.type === "revenue" ? pct : Math.min(100, (stats.revenue / 50000) * 100) },
                    { label: "Lucro Estimado (30%)", value: stats.profit, goal: goals.type === "profit" ? goals.monthly : null, icon: PieChart, color: "bg-amber-500", progress: goals.type === "profit" ? pct : Math.min(100, (stats.profit / 15000) * 100) },
                  ].map((m) => (
                    <div key={m.label} className="p-4 rounded-2xl bg-card border border-border shadow-sm group hover:border-primary/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl ${m.color}/10 ${m.color.replace('bg-', 'text-')}`}>
                            <m.icon className="h-4 w-4" />
                          </div>
                          <span className="text-[12px] font-bold text-muted-foreground">{m.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black">{m.unit ? `${m.value} ${m.unit}` : m.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${m.color} transition-all duration-1000`} style={{ width: `${m.progress}%` }} />
                      </div>
                      {m.goal && (
                        <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="text-primary">{m.progress}% da meta</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Insights and Calculations */}
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <Calculator className="h-5 w-5" />
                        <h4 className="font-bold text-sm">Insights do Mês</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground font-medium">Ticket Médio</span>
                          <span className="font-bold">{stats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground font-medium">Projeção Final</span>
                          <span className="font-bold">{(stats.revenue / (dayOfMonth || 1) * daysInMonth).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-4 bg-primary/10" />
                    <div className="flex gap-3">
                      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${onTrack ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                        {onTrack ? <CheckCircle2 className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                        {onTrack 
                          ? "Excelente! Você está acima do ritmo esperado para este dia do mês."
                          : "Atenção: Para bater sua meta, você precisa acelerar o ritmo de vendas diárias."}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-muted/30 border border-border">
                    <h4 className="text-[13px] font-bold mb-3 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" /> Próximos Passos
                    </h4>
                    <ul className="space-y-2">
                      <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" /> Aumentar ticket médio em 10%
                      </li>
                      <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" /> Focar em produtos de maior margem
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="p-6 pt-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold">Métrica de Foco</Label>
                    <ToggleGroup 
                      type="single" 
                      value={editGoals.type} 
                      onValueChange={(v) => v && setEditGoals({...editGoals, type: v as any})}
                      className="grid grid-cols-3 gap-2"
                    >
                      <ToggleGroupItem value="revenue" className="h-10 rounded-xl border data-[state=on]:bg-primary/10">Vendas R$</ToggleGroupItem>
                      <ToggleGroupItem value="units" className="h-10 rounded-xl border data-[state=on]:bg-primary/10">Qtd. un</ToggleGroupItem>
                      <ToggleGroupItem value="profit" className="h-10 rounded-xl border data-[state=on]:bg-primary/10">Lucro R$</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold">Meta Mensal (Alvo)</Label>
                    <div className="relative">
                      {editGoals.type !== "units" && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>}
                      <Input 
                        type="number" 
                        value={editGoals.monthly} 
                        onChange={(e) => setEditGoals({...editGoals, monthly: Number(e.target.value)})}
                        className={`h-12 rounded-xl text-lg font-black ${editGoals.type !== "units" ? "pl-11" : "pl-4"}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[13px] font-bold">Meta Diária</Label>
                      <Input 
                        type="number" 
                        value={editGoals.daily} 
                        onChange={(e) => setEditGoals({...editGoals, daily: Number(e.target.value)})}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[13px] font-bold">Meta Semanal</Label>
                      <Input 
                        type="number" 
                        value={editGoals.weekly} 
                        onChange={(e) => setEditGoals({...editGoals, weekly: Number(e.target.value)})}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold">Plano de Ação</Label>
                    <textarea
                      value={editGoals.notes}
                      onChange={(e) => setEditGoals({ ...editGoals, notes: e.target.value })}
                      className="w-full min-h-[120px] rounded-2xl border border-border bg-card p-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
                      placeholder="Descreva as estratégias para alcançar estes objetivos..."
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold">Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading} className="flex-[2] h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
                      {isLoading ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Meta
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
