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
import { useState, useEffect, useCallback } from "react";
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

const COMPLETED_STATUSES = ["completed", "concluded", "paid"];
const DEVICE_CATEGORY_TERMS = ["smartphone", "celular", "celulares", "aparelho", "aparelhos"];
const DEVICE_NAME_TERMS = [
  "iphone",
  "galaxy",
  "samsung",
  "xiaomi",
  "redmi",
  "motorola",
  "moto g",
  "poco",
  "realme",
];
const ACCESSORY_TERMS = [
  "capa",
  "película",
  "pelicula",
  "carregador",
  "cabo",
  "fone",
  "airpod",
  "airpods",
  "serviço",
  "servico",
  "mão de obra",
  "mao de obra",
];

type Metadata = Record<string, unknown>;
type SaleRow = { id: string };
type SaleItemRow = {
  sale_id: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | string | null;
  imei: string | null;
  metadata: Metadata | null;
};
type ProductRow = {
  id: string;
  name: string | null;
  category: string | null;
  model: string | null;
  metadata: Metadata | null;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isDeviceItem = (item: SaleItemRow, product?: ProductRow) => {
  const category = normalizeText(product?.category);
  if (category) return DEVICE_CATEGORY_TERMS.some((term) => category.includes(term));

  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const searchable = normalizeText(
    [
      item?.product_name,
      product?.name,
      product?.model,
      metadata.model,
      metadata.imei,
      metadata.IMEI,
      metadata.imei1,
      metadata.capacity,
      metadata.battery_health,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!searchable) return false;
  if (ACCESSORY_TERMS.some((term) => searchable.includes(term))) return false;
  return (
    DEVICE_NAME_TERMS.some((term) => searchable.includes(term)) ||
    Boolean(metadata.imei || metadata.IMEI || metadata.imei1)
  );
};

const ADMIN_EMAILS = ["alfatech791@gmail.com", "contato@focussdev.art"];

export function GoalProgress({
  current: parentCurrent,
  goal: initialGoal = 50000,
  onGoalUpdate,
}: GoalProgressProps) {
  const { user, profile } = useAuth();
  const { orgId } = useOrg();
  const role = String(profile?.role ?? "").toLowerCase();
  const canEdit =
    ADMIN_EMAILS.includes(String(user?.email ?? "").toLowerCase()) ||
    ["super_admin", "owner", "admin"].includes(role);
  const baselineKey = orgId ? `goal-baseline:${orgId}` : "";
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
    baseline: 0,
  };
  const [goals, setGoals] = useState(initialGoalState);
  const [editGoals, setEditGoals] = useState(initialGoalState);
  const [stats, setStats] = useState({ units: 0 });
  const [baseline, setBaseline] = useState<{ value: number; at: string }>({ value: 0, at: "" });

  useEffect(() => {
    if (!baselineKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(baselineKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setBaseline({ value: Number(parsed?.value) || 0, at: String(parsed?.at ?? "") });
      } else {
        setBaseline({ value: 0, at: "" });
      }
    } catch {
      /* ignore */
    }
  }, [baselineKey]);

  const fetchGoals = useCallback(async () => {
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
        baseline: 0,
      };
      setGoals(fetchedGoals);
      setEditGoals(fetchedGoals);
    }
  }, [user?.id, orgId]);

  const getPeriodRange = useCallback(() => {
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
  }, [period]);

  const fetchStats = useCallback(async () => {
    if (!user?.id || !orgId) return;
    const { start, end } = getPeriodRange();
    // Quando admin define um baseline, conta apenas vendas após esse momento
    const effectiveStart =
      baseline.at && new Date(baseline.at) > start ? new Date(baseline.at) : start;
    const { data: sales, error: salesError } = await supabase
      .from("sales_orders")
      .select("id")
      .gte("created_at", effectiveStart.toISOString())
      .lte("created_at", end.toISOString())
      .in("status", COMPLETED_STATUSES)
      .in("channel", ["pdv", "import"])
      .eq("organization_id", orgId);

    if (salesError) {
      console.error("Erro ao buscar vendas da meta:", salesError);
      return;
    }

    const saleIds = ((sales || []) as SaleRow[]).map((s) => s.id).filter(Boolean);
    if (!saleIds.length) {
      setStats({ units: 0 });
      return;
    }

    const { data: items, error: itemsError } = await supabase
      .from("sale_items")
      .select("sale_id, product_id, product_name, quantity, imei, metadata")
      .eq("organization_id", orgId)
      .in("sale_id", saleIds);

    if (itemsError) {
      console.error("Erro ao buscar itens vendidos da meta:", itemsError);
      return;
    }

    const saleItems = (items || []) as SaleItemRow[];
    const productIds = Array.from(
      new Set(saleItems.map((i) => i.product_id).filter((id): id is string => Boolean(id))),
    );
    const productsById = new Map<string, ProductRow>();
    if (productIds.length) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, category, model, metadata")
        .eq("organization_id", orgId)
        .in("id", productIds);
      if (productsError) {
        console.error("Erro ao buscar produtos da meta:", productsError);
      } else {
        ((products || []) as ProductRow[]).forEach((product) =>
          productsById.set(product.id, product),
        );
      }
    }

    let units = 0;
    saleItems.forEach((item) => {
      if (isDeviceItem(item, item.product_id ? productsById.get(item.product_id) : undefined)) {
        units += Math.max(1, Number(item.quantity) || 1);
      }
    });
    setStats({ units });
  }, [user?.id, orgId, getPeriodRange, baseline.at]);

  useEffect(() => {
    if (user?.id) fetchGoals();
  }, [user?.id, fetchGoals]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime: atualiza automaticamente o contador quando uma venda/itens/produto mudam na loja atual.
  useEffect(() => {
    if (!user?.id || !orgId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poller = window.setInterval(() => fetchStats(), 10000);
    const refreshOnFocus = () => fetchStats();
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fetchStats();
      }, 700);
    };
    const channel = supabase.channel(`goal-progress-${orgId}`);
    (["sales_orders", "sale_items", "products"] as const).forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `organization_id=eq.${orgId}` },
        schedule,
      );
    });
    channel.subscribe();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.clearInterval(poller);
      window.removeEventListener("focus", refreshOnFocus);
      supabase.removeChannel(channel);
    };
  }, [user?.id, orgId, fetchStats]);

  const handleSave = async () => {
    if (!user?.id || !orgId) {
      toast.error("Usuário ou organização não identificados");
      return;
    }
    if (!canEdit) {
      toast.error("Apenas administradores podem editar a meta");
      return;
    }
    setIsLoading(true);
    try {
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
        current_value: stats.units,
      };

      let error;
      if (existingGoal?.id) {
        const { error: updateError } = await supabase
          .from("business_goals")
          .update(goalData)
          .eq("id", existingGoal.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("business_goals").insert([goalData]);
        error = insertError;
      }

      if (error) throw error;

      // Persiste baseline (quantidade inicial estipulada pelo admin) no localStorage da loja
      const prevBaseline = baseline.value;
      const newBaseline = Number(editGoals.baseline) || 0;
      if (newBaseline !== prevBaseline) {
        const next = { value: newBaseline, at: new Date().toISOString() };
        if (typeof window !== "undefined" && baselineKey) {
          window.localStorage.setItem(baselineKey, JSON.stringify(next));
        }
        setBaseline(next);
      }

      setGoals({ ...editGoals });
      setIsModalOpen(false);
      toast.success("Metas atualizadas com sucesso!");
      if (onGoalUpdate) onGoalUpdate();
    } catch (e: unknown) {
      console.error("Erro ao salvar metas:", e);
      const message = e instanceof Error ? e.message : "Tente novamente";
      toast.error(`Erro ao salvar metas: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveUnits = baseline.value + stats.units;
  const currentDisplay = effectiveUnits;
  const pct = Math.min(100, Math.round((currentDisplay / (goals.monthly || 1)) * 100)) || 0;
  const projection = Math.round((effectiveUnits / (new Date().getDate() || 1)) * 30);
  const remaining = Math.max(0, goals.monthly - effectiveUnits);

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
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke="var(--color-muted)"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke="var(--color-primary)"
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
                <div className="text-[28px] font-black font-display tracking-tight text-primary leading-none">
                  {pct}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                <span>Aparelhos vendidos</span>
              </div>
              <div className="text-lg font-bold font-display truncate">
                {effectiveUnits}{" "}
                <span className="text-muted-foreground text-sm font-medium">
                  / {goals.monthly} un.
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" /> Faltam para meta
              </div>
              <div className="text-[13px] font-semibold text-primary truncate">{remaining} un.</div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v === "settings" ? "settings" : "overview")}
            className="w-full"
          >
            <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 pb-0">
              <DialogHeader className="mb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                      <Trophy className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-black tracking-tight">
                        Análise de Metas
                      </DialogTitle>
                      <DialogDescription className="font-medium">
                        Meta de aparelhos vendidos por período.
                      </DialogDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
                      <Filter className="h-4 w-4" />
                    </div>
                    <Select
                      value={period}
                      onValueChange={(v) =>
                        setPeriod(
                          ["month", "last_month", "last30", "year"].includes(v)
                            ? (v as "month" | "last_month" | "last30" | "year")
                            : "month",
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[150px] rounded-xl text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Este mês</SelectItem>
                        <SelectItem value="last_month">Mês passado</SelectItem>
                        <SelectItem value="last30">Últimos 30 dias</SelectItem>
                        <SelectItem value="year">Este ano</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditGoals(initialGoalState);
                        setActiveTab("settings");
                      }}
                      className="h-9 rounded-xl font-bold gap-1.5"
                    >
                      <Plus className="h-4 w-4" /> Adicionar Meta
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12 rounded-2xl">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Visão Geral de Performance
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Ajustar Objetivos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                          <Package className="h-4 w-4" />
                        </div>
                        <span className="text-[12px] font-bold text-muted-foreground">
                          Aparelhos Vendidos
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black">{stats.units} un.</div>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="text-primary">
                        {pct}% de {goals.monthly} un.
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-[12px] font-bold text-muted-foreground">
                        Faltam para bater a meta
                      </span>
                    </div>
                    <div className="text-2xl font-black">{remaining} un.</div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Ritmo necessário:{" "}
                      {Math.ceil(remaining / Math.max(1, daysInMonth - dayOfMonth))} un./dia
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <Calculator className="h-5 w-5" />
                        <h4 className="font-bold text-sm">Insights do Período</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground font-medium">
                            Média diária
                          </span>
                          <span className="font-bold">
                            {(stats.units / (dayOfMonth || 1)).toFixed(1)} un.
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground font-medium">
                            Projeção final
                          </span>
                          <span className="font-bold">{projection} un.</span>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-4 bg-primary/10" />
                    <div className="flex gap-3">
                      <div
                        className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${onTrack ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                      >
                        {onTrack ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Rocket className="h-5 w-5" />
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                        {onTrack
                          ? "Excelente! Você está acima do ritmo esperado para bater a meta."
                          : "Atenção: acelere o ritmo de vendas para alcançar a meta no prazo."}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-muted/30 border border-border">
                    <h4 className="text-[13px] font-bold mb-3 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" /> Próximos Passos
                    </h4>
                    <ul className="space-y-2">
                      <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" /> Reforçar abordagem em
                        loja
                      </li>
                      <li className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" /> Aumentar conversão de
                        orçamentos
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
                    <Label className="text-[13px] font-bold">Nome da Meta</Label>
                    <Input
                      value={editGoals.goal_name}
                      onChange={(e) => setEditGoals({ ...editGoals, goal_name: e.target.value })}
                      placeholder="Ex.: Meta de aparelhos — Novembro"
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" /> Aparelhos vendidos (meta mensal)
                    </Label>
                    <Input
                      type="number"
                      value={editGoals.monthly}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setEditGoals({
                          ...editGoals,
                          monthly: v,
                          daily: Math.round(v / 30),
                          weekly: Math.round(v / 4),
                        });
                      }}
                      className="h-12 rounded-xl text-lg font-black"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Quantidade de aparelhos a vender no período.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[13px] font-bold">Meta Diária</Label>
                      <Input
                        type="number"
                        value={editGoals.daily}
                        onChange={(e) =>
                          setEditGoals({ ...editGoals, daily: Number(e.target.value) })
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[13px] font-bold">Meta Semanal</Label>
                      <Input
                        type="number"
                        value={editGoals.weekly}
                        onChange={(e) =>
                          setEditGoals({ ...editGoals, weekly: Number(e.target.value) })
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold">Prazo (opcional)</Label>
                    <Input
                      type="date"
                      value={editGoals.end_date}
                      onChange={(e) => setEditGoals({ ...editGoals, end_date: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold">Plano de Ação</Label>
                    <textarea
                      value={editGoals.notes}
                      onChange={(e) => setEditGoals({ ...editGoals, notes: e.target.value })}
                      className="w-full min-h-[180px] rounded-2xl border border-border bg-card p-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
                      placeholder="Descreva as estratégias para alcançar esta meta de aparelhos..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 h-12 rounded-xl font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isLoading}
                      className="flex-[2] h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                    >
                      {isLoading ? (
                        <Activity className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
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
