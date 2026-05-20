import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingBag,
  Calendar as CalendarIcon,
  Clock,
  Package,
  User as UserIcon,
  TrendingUp,
  Receipt,
  CreditCard,
  Smartphone,
  Coins,
  ArrowUpRight,
  Loader2,
  Hash,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const brl = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const methodIcon = (m: string) => {
  const k = (m || "").toLowerCase();
  if (k.includes("pix")) return Smartphone;
  if (k.includes("cart") || k.includes("brasilcard") || k.includes("cred")) return CreditCard;
  if (k.includes("aparelho")) return Smartphone;
  return Coins;
};

const methodLabel = (m: string) => {
  const k = (m || "").toLowerCase();
  if (k === "other") return "Aparelho";
  if (!m) return "Não inf.";
  return m.charAt(0).toUpperCase() + m.slice(1);
};

export function TodaySalesModal({ open, onOpenChange }: Props) {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !orgId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const start = startOfDay(date);
      const end = endOfDay(date);
      const { data, error } = await supabase
        .from("sales_orders")
        .select(
          "id, sale_number, total_amount, discount, created_at, payment_method, channel, status, customers(name), sale_items(product_name, quantity, unit_price, unit_cost, imei, metadata)",
        )
        .eq("organization_id", orgId)
        .not("status", "in", "(canceled,cancelled,refunded,voided)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (error) console.error("TodaySalesModal fetch error:", error);
      if (!alive) return;
      const list = data || [];
      // Fetch payments separately to avoid PostgREST relationship issues
      if (list.length) {
        const ids = list.map((s: any) => s.id);
        const { data: pays } = await supabase
          .from("sale_payments")
          .select("sale_id, method, amount")
          .in("sale_id", ids);
        const map = new Map<string, any[]>();
        (pays || []).forEach((p: any) => {
          const arr = map.get(p.sale_id) || [];
          arr.push(p);
          map.set(p.sale_id, arr);
        });
        list.forEach((s: any) => {
          s.sale_payments = map.get(s.id) || [];
        });
      }
      setSales(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, orgId, date]);

  const stats = useMemo(() => {
    const total = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
    const cost = sales.reduce(
      (a, s) =>
        a +
        (Array.isArray(s.sale_items)
          ? s.sale_items.reduce(
              (x: number, i: any) =>
                x + Number(i.unit_cost || 0) * Number(i.quantity || 0),
              0,
            )
          : 0),
      0,
    );
    const units = sales.reduce(
      (a, s) =>
        a +
        (Array.isArray(s.sale_items)
          ? s.sale_items.reduce((x: number, i: any) => x + Number(i.quantity || 0), 0)
          : 0),
      0,
    );
    const ticket = sales.length ? total / sales.length : 0;
    const profit = total - cost;
    return { total, units, ticket, profit, count: sales.length };
  }, [sales]);

  const payments = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      if (Array.isArray(s.sale_payments) && s.sale_payments.length) {
        s.sale_payments.forEach((p: any) => {
          const k = methodLabel(p.method);
          map.set(k, (map.get(k) || 0) + Number(p.amount || 0));
        });
      } else {
        const k = methodLabel(s.payment_method);
        map.set(k, (map.get(k) || 0) + Number(s.total_amount || 0));
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [sales]);

  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-hidden p-0 gap-0">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/60 p-5">
          <DialogHeader className="space-y-0">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary grid place-items-center ring-1 ring-primary/20 shadow-sm">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight">
                  {isToday ? "Vendas de Hoje" : "Vendas do Dia"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Histórico completo · {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </DialogDescription>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs font-bold shrink-0"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(date, "dd/MM", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(92vh-120px)]">
          <div className="p-5 space-y-5">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KPI label="Faturamento" value={brl(stats.total)} tone="primary" icon={Receipt} />
              <KPI label="Vendas" value={String(stats.count)} tone="info" icon={ShoppingBag} />
              <KPI label="Ticket Médio" value={brl(stats.ticket)} tone="success" icon={TrendingUp} />
              <KPI label="Unidades" value={String(stats.units)} tone="warning" icon={Package} />
            </div>

            {/* Payment methods */}
            {payments.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h5 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    Formas de Pagamento
                  </h5>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {payments.length} {payments.length === 1 ? "forma" : "formas"}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {payments.map(([m, v]) => {
                    const Icon = methodIcon(m);
                    return (
                      <div
                        key={m}
                        className="shrink-0 px-3 py-2 rounded-xl bg-card border border-border/60 flex items-center gap-2 min-w-[140px]"
                      >
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none">
                            {m}
                          </p>
                          <p className="text-[12px] font-black tracking-tight mt-0.5">{brl(v)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timeline / History */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-sm font-black flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Histórico de Vendas
                </h4>
                <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                  {sales.length} {sales.length === 1 ? "registro" : "registros"}
                </Badge>
              </div>

              {loading ? (
                <div className="py-12 grid place-items-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-bold">Nenhuma venda neste dia</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione outra data ou registre uma venda no PDV.
                  </p>
                </div>
              ) : (
                <div className="relative pl-5 space-y-2 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/30 before:via-border before:to-transparent">
                  {sales.map((s) => {
                    const isOpen = expanded.has(s.id);
                    const items = Array.isArray(s.sale_items) ? s.sale_items : [];
                    const totalUnits = items.reduce(
                      (a: number, i: any) => a + Number(i.quantity || 0),
                      0,
                    );
                    return (
                      <div key={s.id} className="relative">
                        <span className="absolute -left-[14px] top-4 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <div className="rounded-xl bg-card border border-border/60 shadow-sm overflow-hidden">
                          <button
                            onClick={() => toggle(s.id)}
                            className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center border border-primary/20 shrink-0">
                                <UserIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[13px] font-black truncate">
                                    {s.customers?.name || "Consumidor Final"}
                                  </p>
                                  <Badge variant="outline" className="h-4 text-[9px] px-1.5 font-bold">
                                    {s.channel === "import" ? "Importado" : "PDV"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {format(new Date(s.created_at), "HH:mm")}
                                  </span>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Hash className="h-2.5 w-2.5" />
                                    {s.sale_number ?? s.id.slice(0, 6)}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {totalUnits} {totalUnits === 1 ? "item" : "itens"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black text-primary">
                                  {brl(Number(s.total_amount))}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  {methodLabel(s.payment_method)}
                                </p>
                              </div>
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-dashed border-border/60 bg-muted/20 p-3 space-y-1.5 animate-in slide-in-from-top-1">
                              {items.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic text-center py-2">
                                  Sem itens detalhados
                                </p>
                              ) : (
                                items.map((it: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-start justify-between gap-2 p-2 rounded-lg bg-card border border-border/40"
                                  >
                                    <div className="flex items-start gap-2 min-w-0">
                                      <div className="h-6 w-6 rounded bg-primary/5 grid place-items-center shrink-0">
                                        <Package className="h-3 w-3 text-primary" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-bold truncate">
                                          {it.quantity}x {it.product_name}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {it.metadata?.model && (
                                            <Badge variant="secondary" className="h-3.5 text-[8px] px-1">
                                              {it.metadata.model}
                                            </Badge>
                                          )}
                                          {it.metadata?.capacity && (
                                            <Badge variant="secondary" className="h-3.5 text-[8px] px-1">
                                              {it.metadata.capacity}
                                            </Badge>
                                          )}
                                          {it.imei && (
                                            <Badge variant="outline" className="h-3.5 text-[8px] px-1 border-primary/30 text-primary/80">
                                              IMEI {it.imei}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="text-[11px] font-black shrink-0">
                                      {brl(Number(it.unit_price || 0) * Number(it.quantity || 1))}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/vendas/historico" as any });
              }}
              className="w-full h-11 font-bold gap-2"
            >
              Acessar Histórico Completo
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function KPI({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "primary" | "info" | "success" | "warning";
  icon: any;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary ring-primary/20",
    info: "bg-info/10 text-info ring-info/20",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/15 text-[oklch(0.55_0.15_75)] ring-warning/20",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-7 w-7 rounded-lg grid place-items-center ring-1 ring-inset ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-base font-black tracking-tight truncate">{value}</p>
    </div>
  );
}
