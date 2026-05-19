import {
  Target,
  TrendingUp,
  Edit2,
  Save,
  X,
  Calendar,
  Trophy,
  Zap,
  Activity,
  Info,
  BarChart3,
  Rocket,
  DollarSign,
  Package,
  CheckCircle2,
  PieChart,
} from "lucide-react";
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
  current,
  goal: initialGoal = 50000,
  onGoalUpdate,
}: GoalProgressProps) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const initialGoalState = {
    daily: 0,
    weekly: 0,
    monthly: initialGoal,
    type: "revenue" as "revenue" | "units" | "profit",
    goal_name: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    notes: "",
  };
  const [goals, setGoals] = useState(initialGoalState);
  const [editGoals, setEditGoals] = useState(initialGoalState);
  const [stats, setStats] = useState({ revenue: 0, units: 0, profit: 0 });

  useEffect(() => {
    if (user?.id) fetchGoals();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && orgId) fetchStats();
  }, [user?.id, orgId]);

  const fetchGoals = async () => {
    const { data } = await (supabase.from("business_goals").select("*") as any)
      .eq("user_id", user?.id || "")
      .maybeSingle();
    if (data) {
      const fetchedGoals = {
        daily: Number(data.daily_goal) || 0,
        weekly: Number(data.weekly_goal) || 0,
        monthly: Number(data.monthly_goal) || initialGoal,
        type: (data.goal_type as any) || "revenue",
        goal_name: data.goal_name || "",
        start_date: data.start_date || new Date().toISOString().split("T")[0],
        end_date: data.end_date || "",
        notes: data.notes || "",
      };
      setGoals(fetchedGoals);
      setEditGoals(fetchedGoals);
    }
  };

  const fetchStats = async () => {
    const firstDayMonth = new Date();
    firstDayMonth.setDate(1);
    firstDayMonth.setHours(0, 0, 0, 0);

    const { data: sales } = await supabase
      .from("sales_orders")
      .select("total_amount")
      .gte("created_at", firstDayMonth.toISOString())
      .eq("status", "concluded")
      .eq("organization_id", orgId);

    const revenue = sales?.reduce((acc, s) => acc + (s.total_amount || 0), 0) || 0;
    setStats({
      revenue,
      units: sales?.length || 0,
      profit: revenue * 0.3,
    });
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from("business_goals").upsert({
        user_id: user.id,
        daily_goal: editGoals.daily,
        weekly_goal: editGoals.weekly,
        monthly_goal: editGoals.monthly,
        goal_type: editGoals.type,
        goal_name: editGoals.goal_name,
        start_date: editGoals.start_date,
        end_date: editGoals.end_date,
        notes: editGoals.notes,
        updated_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      setGoals({ ...editGoals });
      setIsModalOpen(false);
      toast.success("Metas atualizadas!");
      if (onGoalUpdate) onGoalUpdate();
    } catch (e) {
      toast.error("Erro ao salvar metas");
    } finally {
      setIsLoading(false);
    }
  };

  const currentDisplay = goals.type === "units" ? stats.units : goals.type === "profit" ? stats.profit : stats.revenue;
  const pct = Math.min(100, Math.round((currentDisplay / (goals.monthly || 1)) * 100)) || 0;

  return (
    <>
      <div onClick={() => setIsModalOpen(true)} className="rounded-2xl bg-card border border-border p-5 shadow-card cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Meta do Mês</h3>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">{pct}%</span>
        </div>
        <div className="text-[32px] font-black font-display tracking-tight bg-gradient-primary bg-clip-text text-transparent">
          {pct}%
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <Tabs defaultValue="overview" className="w-full">
            <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 pb-0">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl font-black">Performance e Metas</DialogTitle>
                <DialogDescription>Acompanhe seus resultados de vendas e lucro.</DialogDescription>
              </DialogHeader>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
                <TabsTrigger value="overview" className="rounded-xl font-bold data-[state=active]:bg-background">Visão Geral</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-xl font-bold data-[state=active]:bg-background">Configurações</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Faturamento", value: stats.revenue, icon: DollarSign, color: "text-emerald-500" },
                  { label: "Vendas", value: stats.units, icon: Package, color: "text-blue-500", isUnit: true },
                  { label: "Lucro (est.)", value: stats.profit, icon: PieChart, color: "text-amber-500" },
                ].map((m) => (
                  <div key={m.label} className="p-4 rounded-2xl bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                      <span className="text-[11px] font-bold uppercase">{m.label}</span>
                    </div>
                    <div className="text-lg font-black tracking-tight">
                      {m.isUnit ? m.value : m.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="p-6 pt-2 space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-bold">Focar em:</Label>
                    <ToggleGroup type="single" value={editGoals.type} onValueChange={(v) => v && setEditGoals({...editGoals, type: v as any})} className="grid grid-cols-3 gap-2">
                      <ToggleGroupItem value="revenue">Faturamento</ToggleGroupItem>
                      <ToggleGroupItem value="units">Vendas (un)</ToggleGroupItem>
                      <ToggleGroupItem value="profit">Lucro</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="grid gap-2">
                      <Label className="text-[13px] font-bold">Meta Mensal</Label>
                      <Input type="number" value={editGoals.monthly} onChange={(e) => setEditGoals({...editGoals, monthly: Number(e.target.value)})} className="h-12 rounded-xl" />
                  </div>
                  <Button onClick={handleSave} className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground">Salvar Metas</Button>
                </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
