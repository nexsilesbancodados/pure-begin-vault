import {
  Activity,
  ShoppingBag,
  Wrench,
  Box,
  DollarSign,
  Users,
  TrendingUp,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Info,
  Target,
  AlertTriangle,
  CreditCard,
  Wallet,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Tone = "info" | "success" | "warning" | "primary" | "destructive";
const toneStyles: Record<Tone, { icon: string; gradient: string; ring: string }> = {
  info: {
    icon: "bg-info/10 text-info",
    gradient: "from-info/10 to-transparent",
    ring: "ring-info/20",
  },
  success: {
    icon: "bg-success/10 text-success",
    gradient: "from-success/10 to-transparent",
    ring: "ring-success/20",
  },
  warning: {
    icon: "bg-warning/15 text-[oklch(0.55_0.15_75)]",
    gradient: "from-warning/10 to-transparent",
    ring: "ring-warning/20",
  },
  primary: {
    icon: "bg-primary/10 text-primary",
    gradient: "from-primary/10 to-transparent",
    ring: "ring-primary/20",
  },
  destructive: {
    icon: "bg-destructive/10 text-destructive",
    gradient: "from-destructive/10 to-transparent",
    ring: "ring-destructive/20",
  },
};

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format as formatDate } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Package, User as UserIcon, Coins } from "lucide-react";
import { TodaySalesModal } from "./TodaySalesModal";

export function KpiCard({
  label,
  value: initialValue,
  trend,
  sub,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  trend: string;
  sub: string;
  icon: string;
  tone: string;
  onClick?: () => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [fallbackSales, setFallbackSales] = useState<any[]>([]);
  const [osData, setOsData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const { user } = useAuth();
  const { orgId } = useOrg();

  const IconsMap: Record<string, any> = { ShoppingBag, Wrench, Box, DollarSign, Users, TrendingUp, Activity, Smartphone, CreditCard, Wallet };

  useEffect(() => {
    if (!isModalOpen || !date || !user?.id || !orgId) return;

    const fetchDayData = async () => {
      setIsLoading(true);
      try {
        const l = label.toLowerCase();
        const isMonthly = l.includes("mensal") || l.includes("mês") || l.includes("mes") || l.includes("ticket");
        const start = isMonthly ? startOfMonth(date) : startOfDay(date);
        const end = isMonthly ? endOfMonth(date) : endOfDay(date);

        const filterFor = (q: any) => q.eq("organization_id", orgId);
        if (l.includes("vendas") || l.includes("faturamento") || l.includes("ticket")) {
          const { data } = await filterFor(
            supabase
              .from("sales_orders")
              .select("total_amount, created_at, id, payment_method, channel, status, customers(name), sale_items(product_name, quantity, unit_price, imei, metadata)")
              .not("status", "in", "(canceled,cancelled,refunded,voided)")
              .gte("created_at", start.toISOString())
              .lte("created_at", end.toISOString())
              .order("created_at", { ascending: false }),
          );

          setSalesData(data || []);

          // KPI value uses strict rules (PDV + Import, concluded only)
          const strict = (data || []).filter(
            (s: any) => ["completed", "concluded"].includes(s.status) && ["pdv", "import"].includes(s.channel),
          );
          const total = strict.reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);
          const pdvTotal = strict
            .filter((s: any) => s.channel !== "import")
            .reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);
          const importTotal = strict
            .filter((s: any) => s.channel === "import")
            .reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);

          if (l.includes("ticket")) {
            const avg = strict.length ? total / strict.length : 0;
            setDisplayValue(avg.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
          } else if (l.includes("vendas") && importTotal > 0) {
            setDisplayValue(`${pdvTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (+${importTotal.toLocaleString("pt-BR")})`);
          } else {
            setDisplayValue(total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
          }

          // Fallback: if no sales today, fetch last 7 days so the modal can
          // still show recent product activity instead of an empty state.
          if (!(data || []).length && !isMonthly) {
            const past = new Date(start);
            past.setDate(past.getDate() - 7);
            const { data: prev } = await filterFor(
              supabase
                .from("sales_orders")
                .select("total_amount, created_at, id, payment_method, channel, status, customers(name), sale_items(product_name, quantity, unit_price, imei, metadata)")
                .not("status", "in", "(canceled,cancelled,refunded,voided)")
                .gte("created_at", past.toISOString())
                .lt("created_at", start.toISOString())
                .order("created_at", { ascending: false })
                .limit(50),
            );
            setFallbackSales(prev || []);
          } else {
            setFallbackSales([]);
          }
        } else if (l.includes("leads")) {
          const { data, count } = await filterFor(
            supabase
              .from("leads")
              .select("id, name, phone, email, source, status, created_at", { count: "exact" })
              .gte("created_at", start.toISOString())
              .lte("created_at", end.toISOString())
              .order("created_at", { ascending: false }),
          );
          setLeadsData(data || []);
          setDisplayValue(String(count ?? (data?.length || 0)));
        } else if (l.includes("os") || l.includes("ordens") || l.includes("serviço") || l.includes("servico")) {
          const { data, count } = await filterFor(
            supabase
              .from("service_orders")
              .select("id, customer_name, device, problem, status, total_amount, created_at", { count: "exact" })
              .not("status", "in", "(delivered,canceled,cancelled)")
              .order("created_at", { ascending: false }),
          );
          setOsData(data || []);
          setDisplayValue(String(count ?? (data?.length || 0)));
        } else if (l.includes("estoque")) {
          const { data } = await filterFor(
            supabase
              .from("products")
              .select("id, name, sku, stock_quantity, min_stock, cost_price, sale_price, imei")
              .order("stock_quantity", { ascending: true })
              .limit(200),
          );
          const low = (data || []).filter(
            (p: any) => (Number(p.stock_quantity) || 0) <= (Number(p.min_stock) || 5),
          );
          setStockData(low);
          setDisplayValue(String(low.length));
        }
      } catch (error) {
        console.error("Error fetching day data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDayData();
  }, [date, isModalOpen, user?.id, orgId, label]);

  const Icon = IconsMap[icon] ?? Activity;
  const navigate = useNavigate();
  const styles = toneStyles[tone as Tone] ?? toneStyles.primary;

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    const l = label.toLowerCase();
    if (l.includes("vendas") || l.includes("faturamento") || l.includes("ticket")) {
      navigate({ to: "/vendas/historico" as any });
    } else if (l.includes("os")) {
      navigate({ to: "/servicos/dashboard" as any });
    } else if (l.includes("estoque")) {
      navigate({ to: "/estoque/atual" as any });
    } else if (l.includes("leads")) {
      navigate({ to: "/leads" as any });
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        aria-label={`${label}: ${initialValue}${trend ? `, tendência ${trend}` : ""}. Ver detalhes`}
        className={`relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/50 p-3 sm:p-4 shadow-card hover:shadow-elegant hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 text-left w-full group hover:ring-2 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${styles.ring}`}
      >
        {/* Top highlight line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
        />
        {/* Gradient wash */}
        <div
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} opacity-20 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0`}
        />
        {/* Corner glow on hover */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-tr ${styles.gradient} blur-2xl opacity-0 group-hover:opacity-90 transition-opacity duration-500`}
        />
        {/* Shine sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
        />
        
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <span className="text-[10px] font-bold text-muted-foreground/60">Detalhar</span>
          <div 
            role="button"
            tabIndex={0}
            onClick={handleAction}
            className="p-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>

        <div className="flex items-start gap-3 relative z-10">
          <div
            className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ring-1 ring-inset ring-current/15 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] group-hover:shadow-md ${styles.icon}`}
          >
            <Icon aria-hidden className="h-[20px] w-[20px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] text-muted-foreground font-semibold uppercase tracking-wider group-hover:text-foreground transition-colors pr-8">
              {label}
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-[18px] sm:text-[22px] lg:text-[24px] font-bold tracking-tight font-display truncate max-w-full">
                {initialValue}
              </span>
              {trend && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full whitespace-nowrap ring-1 ring-inset ring-success/20">
                  ↑ {trend.replace("+", "")}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-current opacity-40" />
              {sub}
            </div>
          </div>
        </div>
      </button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={`h-12 w-12 rounded-2xl grid place-items-center ${styles.icon}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{label}</DialogTitle>
                <DialogDescription>{sub}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div
              className={`bg-muted/30 rounded-2xl p-6 border border-border/50 text-center transition-opacity ${isLoading ? "opacity-50" : "opacity-100"}`}
            >
              <span className="text-sm text-muted-foreground block mb-1">Valor Atual</span>
              <span className="text-4xl font-black font-display tracking-tight text-primary">
                {displayValue}
              </span>
              {trend && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-bold">
                  <TrendingUp className="h-3 w-3" />+{trend.replace("+", "")} Crescimento
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <div className="p-4 rounded-xl border border-border bg-card/50 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">
                        Período
                      </span>
                    </div>
                    <p className="text-sm font-semibold truncate">
                      {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Hoje"}
                    </p>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <div className="p-4 rounded-xl border border-border bg-card/50">
                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Meta</span>
                </div>
                <p className="text-sm font-semibold">Em dia</p>
              </div>
            </div>

            {salesData.length > 0 &&
              (label.toLowerCase().includes("vendas") ||
                label.toLowerCase().includes("faturamento") ||
                label.toLowerCase().includes("ticket")) && (
                <div className="space-y-4 mt-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      Vendas do Período
                    </h4>
                    <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                      {salesData.length} {salesData.length === 1 ? "venda" : "vendas"}
                    </Badge>
                  </div>

                  {/* Product Summary - Direct response to "descrição dos produtos vendidos" */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] uppercase font-black text-muted-foreground/60 px-1 tracking-widest">
                      Produtos Vendidos (Resumo)
                    </h5>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {(() => {
                        const aggregated = salesData.reduce((acc: any, sale: any) => {
                          if (Array.isArray(sale.sale_items)) {
                            sale.sale_items.forEach((item: any) => {
                              const key = item.product_name;
                              if (!acc[key]) acc[key] = { name: key, qty: 0, total: 0 };
                              acc[key].qty += Number(item.quantity) || 0;
                              acc[key].total += (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
                            });
                          }
                          return acc;
                        }, {});
                        
                        const items = Object.values(aggregated);
                        
                        if (items.length === 0) {
                          return <div className="text-[10px] text-muted-foreground italic px-1">Nenhum produto identificado</div>;
                        }
                        
                        return items.map((prod: any) => (
                          <div
                            key={prod.name}
                            className="shrink-0 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 flex flex-col min-w-[140px]"
                          >
                            <span className="text-[11px] font-bold truncate max-w-[180px]">{prod.name}</span>
                            <div className="flex items-center justify-between mt-1">
                              <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-primary/10 text-primary border-none">
                                {prod.qty} un
                              </Badge>
                              <span className="text-[10px] font-black opacity-70">
                                {prod.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] uppercase font-black text-muted-foreground/60 px-1 tracking-widest">
                      Formas de Pagamento
                    </h5>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {Object.entries(
                      salesData.reduce((acc: any, curr: any) => {
                        const method = curr.payment_method || "Outros";
                        acc[method] = (acc[method] || 0) + (Number(curr.total_amount) || 0);
                        return acc;
                      }, {}),
                    ).map(([method, total]: [string, any]) => (
                      <div
                        key={method}
                        className="shrink-0 px-3 py-2 rounded-xl border border-border bg-card shadow-sm flex items-center gap-2"
                      >
                        <div className="h-6 w-6 rounded-lg bg-primary/5 grid place-items-center">
                          {method.toLowerCase().includes("pix") ? (
                            <Smartphone className="h-3 w-3 text-primary" />
                          ) : method.toLowerCase().includes("cart") ? (
                            <CreditCard className="h-3 w-3 text-primary" />
                          ) : (
                            <Coins className="h-3 w-3 text-primary" />
                          )}
                        </div>
                        <div className="min-w-[60px]">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none mb-1">
                            {method}
                          </p>
                          <p className="text-[11px] font-black tracking-tight leading-none">
                            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <ScrollArea className="h-[240px] w-full rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="space-y-3">
                      {salesData.map((sale) => (
                        <div
                          key={sale.id}
                          className="p-3 rounded-xl bg-card border border-border/60 shadow-sm space-y-3 group/sale relative overflow-hidden"
                        >
                          <div
                            className="absolute inset-y-0 left-0 w-1 bg-primary/40 opacity-0 group-hover/sale:opacity-100 transition-opacity"
                          />
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                <UserIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-[12px] font-bold leading-none">
                                  {sale.customers?.name || "Consumidor Final"}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDate(new Date(sale.created_at), "HH:mm", { locale: ptBR })}
                                  </span>
                                  <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/80 text-muted-foreground/80 font-medium">
                                      {sale.channel === 'pdv' ? 'PDV' : 'Importado'}
                                    </Badge>
                                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/80 text-muted-foreground/80 font-medium">
                                      {sale.payment_method || "Não inf."}
                                    </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-primary block">
                                {(Number(sale.total_amount) || 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                #{sale.id.slice(0, 8)}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-dashed border-border/80 flex flex-col gap-1.5">
                            {Array.isArray(sale.sale_items) && sale.sale_items.length > 0 ? (
                              sale.sale_items.map((item: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex flex-col gap-1 bg-muted/30 p-2 rounded-lg border border-border/20"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-5 w-5 rounded bg-card border border-border/50 grid place-items-center shrink-0">
                                        <Package className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                      <span className="text-[11px] font-bold truncate">
                                        {item.quantity}x {item.product_name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-black text-foreground/70 shrink-0">
                                      {(Number(item.unit_price || 0) * (Number(item.quantity) || 1)).toLocaleString("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      })}
                                    </span>
                                  </div>
                                  {(item.metadata?.model ||
                                    item.metadata?.capacity ||
                                    item.metadata?.color ||
                                    item.metadata?.battery_health ||
                                    item.imei) && (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {item.metadata?.model && (
                                        <Badge
                                          variant="secondary"
                                          className="h-3.5 text-[8px] px-1 bg-primary/5 text-primary border-primary/10"
                                        >
                                          {item.metadata.model}
                                        </Badge>
                                      )}
                                      {item.metadata?.capacity && (
                                        <Badge
                                          variant="secondary"
                                          className="h-3.5 text-[8px] px-1"
                                        >
                                          {item.metadata.capacity}
                                        </Badge>
                                      )}
                                      {item.imei && (
                                        <Badge
                                          variant="outline"
                                          className="h-3.5 text-[8px] px-1 border-primary/20 text-primary/70"
                                        >
                                          IMEI: {item.imei}
                                        </Badge>
                                      )}
                                      {item.metadata?.battery_health && (
                                        <Badge
                                          variant="secondary"
                                          className="h-3.5 text-[8px] px-1 flex items-center gap-0.5"
                                        >
                                          <Activity className="h-2 w-2" />
                                          {item.metadata.battery_health}%
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">
                                Nenhum detalhe disponível
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

            {osData.length > 0 && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" /> Ordens em andamento
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                    {osData.length} OS
                  </Badge>
                </div>
                <ScrollArea className="h-[240px] w-full rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="space-y-2">
                    {osData.map((o: any) => (
                      <div key={o.id} className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold truncate">{o.customer_name || "Cliente"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {o.device || "—"} · {o.problem || "Sem descrição"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">{o.status || "aberto"}</Badge>
                            <p className="text-[11px] font-black text-primary mt-1">
                              {(Number(o.total_amount) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {stockData.length > 0 && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Itens com estoque baixo
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-bold bg-destructive/10 text-destructive border-none">
                    {stockData.length} itens
                  </Badge>
                </div>
                <ScrollArea className="h-[240px] w-full rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="space-y-2">
                    {stockData.map((p: any) => (
                      <div key={p.id} className="p-3 rounded-xl bg-card border border-border/60 shadow-sm flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            SKU {p.sku || "—"} {p.imei ? `· IMEI ${p.imei}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-destructive/30 text-destructive">
                            {p.stock_quantity ?? 0} un.
                          </Badge>
                          <p className="text-[9px] text-muted-foreground mt-1">mín {p.min_stock ?? 5}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {leadsData.length > 0 && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-info" /> Leads do período
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-bold bg-info/10 text-info border-none">
                    {leadsData.length} leads
                  </Badge>
                </div>
                <ScrollArea className="h-[240px] w-full rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="space-y-2">
                    {leadsData.map((ld: any) => (
                      <div key={ld.id} className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold truncate">{ld.name || "Lead"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {ld.phone || ld.email || "—"} {ld.source ? `· ${ld.source}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                            {ld.status || "novo"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {!salesData.length && !osData.length && !stockData.length && !leadsData.length && (
              <div className="space-y-3 mt-2">
                <div className="p-4 rounded-2xl border border-dashed border-border bg-muted/30 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold">Nenhuma venda registrada nesta data</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Esta loja ainda não tem vendas no período selecionado. Registre uma venda no PDV ou troque a loja ativa para visualizar os produtos vendidos.
                    </p>
                  </div>
                </div>

                {fallbackSales.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h5 className="text-[11px] uppercase font-black text-muted-foreground tracking-widest">
                        Produtos vendidos nos últimos 7 dias
                      </h5>
                      <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                        {fallbackSales.length} {fallbackSales.length === 1 ? "venda" : "vendas"}
                      </Badge>
                    </div>
                    <ScrollArea className="h-[260px] w-full rounded-2xl border border-border bg-muted/20 p-3">
                      <div className="space-y-2">
                        {(() => {
                          const agg = fallbackSales.reduce((acc: any, s: any) => {
                            (s.sale_items || []).forEach((it: any) => {
                              const k = it.product_name || "Item";
                              if (!acc[k]) acc[k] = { name: k, qty: 0, total: 0 };
                              acc[k].qty += Number(it.quantity) || 0;
                              acc[k].total += (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);
                            });
                            return acc;
                          }, {});
                          const items = Object.values(agg).sort((a: any, b: any) => b.total - a.total);
                          if (!items.length) {
                            return <p className="text-xs text-muted-foreground italic px-1">Sem itens detalhados.</p>;
                          }
                          return items.map((p: any) => (
                            <div key={p.name} className="p-3 rounded-xl bg-card border border-border/60 shadow-sm flex justify-between items-center gap-3">
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold truncate">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">{p.qty} un. vendidas</p>
                              </div>
                              <span className="text-[12px] font-black text-primary shrink-0">
                                {p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAction}
              className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              Acessar Relatório Completo
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
