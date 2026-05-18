import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  ShoppingBag,
  Eye,
  Printer,
  Edit,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  MessageSquare,
  Share2,
  ReceiptText,
  Info,
  Repeat2,
  Folder,
  Truck,
  PenLine,
  Mail,
  CreditCard,
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
  DropdownMenuLabel,
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
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReceiptData = {
  sale: any;
  items: any[];
  payments: any[];
  org_name: string;
  org: { address?: string | null; cnpj?: string | null; phone?: string | null; website?: string | null; logo_url?: string | null };
  seller?: { name?: string | null } | null;
  customer?: any | null;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  money: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
  credit: "Cartão crédito",
  debit: "Cartão débito",
  installment: "Parcelado",
  transfer: "Transferência",
};

const formatCurrency = (value: number) =>
  `R$ ${Number(value || 0)
    .toFixed(2)
    .replace(".", ",")}`;

export function SalesHistory() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptMode, setReceiptMode] = useState<"a4" | "80mm">("a4");

  const fetchSales = useCallback(async () => {
    if (!user?.id || !orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const customerIds = Array.from(
        new Set(rows.map((r: any) => r.customer_id).filter(Boolean)),
      );
      let customersMap: Record<string, { name: string }> = {};
      if (customerIds.length) {
        const { data: cs } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds as string[]);
        customersMap = Object.fromEntries((cs || []).map((c: any) => [c.id, { name: c.name }]));
      }
      setSales(rows.map((r: any) => ({ ...r, customers: customersMap[r.customer_id] || null })));
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      toast.error("Erro ao carregar histórico de vendas.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchSales();

    if (!user?.id) return;

    // Inscrever em mudanças na tabela sales_orders para atualização automática
    const channel = supabase
      .channel("sales-history-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_orders",
          filter: orgId ? `organization_id=eq.${orgId}` : `user_id=eq.${user.id}`,
        },
        () => {
          fetchSales();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSales, user?.id, orgId]);

  const filteredSales = sales.filter((sale) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      sale.id.toLowerCase().includes(s) ||
      sale.customers?.name?.toLowerCase().includes(s) ||
      sale.payment_method?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
    if (statusFilter !== "all" && sale.status !== statusFilter) return false;
    if (periodFilter !== "all") {
      const d = new Date(sale.created_at);
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (periodFilter === "today" && d < today) return false;
      if (periodFilter === "7d" && d < new Date(now.getTime() - 7 * 86400000)) return false;
      if (periodFilter === "30d" && d < new Date(now.getTime() - 30 * 86400000)) return false;
      if (
        periodFilter === "month" &&
        (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())
      )
        return false;
    }
    return true;
  });

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter((s) => new Date(s.created_at).toDateString() === today);
    const totalRevenue = sales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

    return {
      todayTotal: todaySales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
      todayCount: todaySales.length,
      avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
      canceledCount: sales.filter((s) => s.status === "canceled").length,
      totalCount: sales.length,
      totalRevenue,
    };
  }, [sales]);

  const openWarrantyPrint = useCallback((sale: any, type: "seminovo" | "lacrado" | "android") => {
    const titles: Record<string, string> = {
      seminovo: "Termo de Garantia - iPhone Seminovo (7 meses)",
      lacrado: "Termo de Garantia - iPhone Lacrado (1 ano)",
      android: "Termo de Garantia - Aparelho Android (1 ano)",
    };
    const periodDays = type === "seminovo" ? 210 : 365;
    const start = new Date(sale.created_at || Date.now());
    const end = new Date(start.getTime() + periodDays * 86400000);
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
    const cliente = sale.customers?.name || "Consumidor";
    const total = (sale.total_amount || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titles[type]}</title>
<style>
body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:800px;margin:0 auto;}
h1{font-size:20px;text-align:center;margin-bottom:8px;}
h2{font-size:13px;text-align:center;color:#555;margin-top:0;font-weight:normal;}
.box{border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0;}
.row{display:flex;justify-content:space-between;margin:6px 0;font-size:13px;}
.label{color:#666;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px;}
ul{font-size:12px;line-height:1.6;}
.sign{margin-top:60px;display:flex;justify-content:space-between;gap:40px;}
.sign div{flex:1;text-align:center;border-top:1px solid #333;padding-top:6px;font-size:11px;}
@media print{body{padding:20px;}}
</style></head><body>
<h1>${titles[type]}</h1>
<h2>Documento gerado em ${fmt(new Date())}</h2>
<div class="box">
<div class="row"><span class="label">Venda</span><span>#${String(sale.id).slice(0, 8).toUpperCase()}</span></div>
<div class="row"><span class="label">Cliente</span><span>${cliente}</span></div>
<div class="row"><span class="label">Valor</span><span>${total}</span></div>
<div class="row"><span class="label">Início da garantia</span><span>${fmt(start)}</span></div>
<div class="row"><span class="label">Término da garantia</span><span>${fmt(end)}</span></div>
</div>
<div class="box">
<p class="label">Cobertura</p>
<ul>
<li>Defeitos de fabricação em componentes internos.</li>
<li>Funcionamento normal de placa, bateria e tela (conforme tipo).</li>
<li>Atendimento em assistência técnica autorizada.</li>
</ul>
<p class="label">Não cobre</p>
<ul>
<li>Danos por queda, líquidos, oxidação ou uso indevido.</li>
<li>Violação do aparelho por terceiros não autorizados.</li>
<li>Acessórios e desgaste natural de bateria.</li>
</ul>
</div>
<div class="sign"><div>Assinatura do Cliente</div><div>Assinatura da Loja</div></div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up bloqueado pelo navegador.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }, []);

  const openReceiptPopup = useCallback(async (sale: any, mode: "a4" | "80mm" = "a4", autoPrint = false) => {
    setIsDetailsOpen(false);
    setSelectedSale(null);
    setReceiptMode(mode);
    setIsReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptError(null);
    setReceiptData(null);

    try {
      const [saleRes, itemsRes, paymentsRes] = await Promise.all([
        (supabase as any)
          .from("sales_orders")
          .select("*")
          .eq("id", sale.id)
          .maybeSingle(),
        (supabase as any).from("sale_items").select("*").eq("sale_id", sale.id),
        (supabase as any).from("sale_payments").select("*").eq("sale_id", sale.id),
      ]);

      if (saleRes.error) throw saleRes.error;
      const fullSale = saleRes.data || sale;
      if (!fullSale) throw new Error("Venda não encontrada");

      const [{ data: org }, { data: orgSettings }, { data: customer }, { data: seller }] =
        await Promise.all([
          fullSale.organization_id
            ? (supabase as any).from("organizations").select("name").eq("id", fullSale.organization_id).maybeSingle()
            : Promise.resolve({ data: null }),
          fullSale.organization_id
            ? (supabase as any).from("organization_settings").select("*").eq("organization_id", fullSale.organization_id).maybeSingle()
            : Promise.resolve({ data: null }),
          fullSale.customer_id
            ? (supabase as any).from("customers").select("*").eq("id", fullSale.customer_id).maybeSingle()
            : Promise.resolve({ data: sale.customers || null }),
          fullSale.seller_id
            ? (supabase as any).from("profiles").select("full_name, email").eq("id", fullSale.seller_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

      const settings = orgSettings || {};
      setReceiptData({
        sale: fullSale,
        items: itemsRes.data || [],
        payments: paymentsRes.data || [],
        org_name: org?.name || "Loja",
        org: {
          address: settings.address ?? settings.endereco ?? null,
          cnpj: settings.cnpj ?? settings.document ?? null,
          phone: settings.phone ?? settings.telefone ?? null,
          website: settings.website ?? null,
          logo_url: settings.brand_logo_url ?? null,
        },
        seller: seller ? { name: seller.full_name || seller.email } : null,
        customer: customer || sale.customers || null,
      });

      if (autoPrint) setTimeout(() => window.print(), 500);
    } catch (error) {
      console.error("Erro ao carregar recibo:", error);
      setReceiptError("Não foi possível carregar o recibo desta venda.");
    } finally {
      setReceiptLoading(false);
    }
  }, []);

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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Vendas Hoje
                </p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.todayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ticket Médio
                </p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Canceladas
                </p>
                <div className="text-2xl font-bold mt-0.5 text-destructive">
                  {stats.canceledCount}
                </div>
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Acumulado
                </p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.totalRevenue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
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
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-border/60 bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            <option value="all">Todo período</option>
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Este mês</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-border/60 bg-background text-sm font-medium"
          >
            <option value="all">Todos status</option>
            <option value="completed">Concluída</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              import("@/lib/exportCsv").then(({ exportToCsv }) => {
                exportToCsv(
                  "vendas-historico.csv",
                  filteredSales.map((s) => ({
                    data: s.created_at,
                    cliente: s.customer_name ?? s.customer?.name,
                    total: s.total_amount,
                    pagamento: s.payment_method,
                    status: s.status,
                  })),
                );
              });
            }}
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Exportar Relatório
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg tracking-tight">Listagem de Vendas</h2>
            <Badge variant="outline" className="rounded-md bg-background/50">
              {filteredSales.length} registros
            </Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10">
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  ID Venda
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Cliente
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Data & Hora
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Forma Pagto
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Valor Total
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm font-medium text-muted-foreground mt-4">
                      Sincronizando banco de dados...
                    </p>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="bg-muted/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-base font-semibold text-muted-foreground">
                      Nenhuma venda encontrada
                    </p>
                    <p className="text-sm text-muted-foreground/60">
                      Tente ajustar seus termos de busca.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
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
                        <span className="font-mono text-xs font-bold text-primary tracking-tight">
                          #{sale.id.slice(0, 6).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-bold tracking-tight">
                          {sale.customers?.name || "Consumidor Final"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {format(new Date(sale.created_at), "dd 'de' MMM", { locale: ptBR })}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {format(new Date(sale.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge
                        variant="secondary"
                        className="bg-muted/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                      >
                        {sale.payment_method || "N/A"}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-foreground">
                        {(sale.total_amount || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                          sale.status === "concluded"
                            ? "bg-success/5 text-success border-success/20"
                            : sale.status === "pending"
                              ? "bg-warning/5 text-warning border-warning/20"
                              : "bg-destructive/5 text-destructive border-destructive/20"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                            sale.status === "concluded"
                              ? "bg-success"
                              : sale.status === "pending"
                                ? "bg-warning"
                                : "bg-destructive"
                          }`}
                        />
                        {sale.status === "concluded"
                          ? "CONCLUÍDA"
                          : sale.status === "pending"
                            ? "PENDENTE"
                            : "CANCELADA"}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 rounded-xl hover:bg-primary/10 transition-colors border border-border/40 flex items-center gap-2"
                          >
                            <span className="font-bold text-[10px] uppercase tracking-widest text-primary">
                              Ação
                            </span>
                            <MoreHorizontal className="h-4 w-4 text-primary" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 p-1.5 rounded-xl shadow-2xl border-border/40 bg-card/95 backdrop-blur-md"
                        >
                          {[
                            {
                              icon: Edit,
                              label: "Editar",
                              onClick: () => {
                                if (sale.status === "cancelled" || sale.status === "canceled") {
                                  toast.error("Vendas canceladas não podem ser editadas.");
                                  return;
                                }
                                window.open(`/pdv?edit=${sale.id}`, "_blank");
                              },
                            },
                            {
                              icon: Info,
                              label: "Detalhes",
                              onClick: () => {
                                setSelectedSale(sale);
                                setIsDetailsOpen(true);
                              },
                            },
                            {
                              icon: FileText,
                              label: "Recibo",
                              onClick: () => openReceiptPopup(sale),
                            },
                            {
                              icon: Printer,
                              label: "Recibo 80mm",
                              onClick: () => openReceiptPopup(sale, "80mm", true),
                            },
                            {
                              icon: MessageSquare,
                              iconClass: "text-green-600",
                              label: "Whatsapp",
                              onClick: () => {
                                const phone = sale.customers?.phone?.replace(/\D/g, "");
                                if (!phone) return toast.error("Cliente sem telefone.");
                                window.open(
                                  `https://wa.me/55${phone}?text=Olá! Segue o link do seu comprovante: ${window.location.origin}/recibo/${sale.id}`,
                                  "_blank",
                                );
                              },
                            },
                            {
                              icon: Repeat2,
                              label: "Devolução/Troca",
                              onClick: () => toast.info("Abrindo fluxo de devolução/troca..."),
                            },
                            {
                              icon: XCircle,
                              iconClass: "text-destructive",
                              danger: true,
                              label: "Cancelar a venda",
                              onClick: async () => {
                                if (!confirm("Deseja realmente cancelar esta venda?")) return;
                                try {
                                  const { error } = await supabase
                                    .from("sales_orders")
                                    .update({ status: "canceled" })
                                    .eq("id", sale.id);
                                  if (error) throw error;
                                  toast.success("Venda cancelada!");
                                  fetchSales();
                                } catch {
                                  toast.error("Erro ao cancelar venda.");
                                }
                              },
                            },
                            {
                              icon: Folder,
                              label: "Arquivos",
                              onClick: () => toast.info("Abrindo arquivos da venda..."),
                            },
                            {
                              icon: Truck,
                              label: "Imprimir Delivery",
                              onClick: () => openReceiptPopup(sale, "a4", true),
                            },
                            {
                              icon: PenLine,
                              label: "Assinar",
                              onClick: () => toast.info("Captura de assinatura em breve."),
                            },
                            {
                              icon: Mail,
                              label: "Enviar por E-mail",
                              onClick: () => {
                                const email = (sale.customers as any)?.email;
                                if (!email) return toast.error("Cliente sem e-mail cadastrado.");
                                window.location.href = `mailto:${email}?subject=Recibo da venda&body=${encodeURIComponent(
                                  `Segue o link do recibo: ${window.location.origin}/recibo/${sale.id}`,
                                )}`;
                              },
                            },
                            {
                              icon: CreditCard,
                              label: "Pagamento TEF",
                              onClick: () => toast.info("Conectando ao TEF..."),
                            },
                          ].map((opt, i) => {
                            const Icon = opt.icon;
                            return (
                              <DropdownMenuItem
                                key={i}
                                onClick={opt.onClick}
                                className={`gap-3 py-2 px-2.5 rounded-lg cursor-pointer text-[13px] font-medium ${
                                  opt.danger
                                    ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                                    : "focus:bg-primary/10"
                                }`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${opt.iconClass ?? "text-foreground/70"}`}
                                />
                                <span>{opt.label}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Modal de Detalhes da Venda */}
      <Dialog open={isDetailsOpen && !isReceiptOpen && !!selectedSale} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card">
          {selectedSale && (() => {
            const status = selectedSale.status as string;
            const statusMap: Record<string, { label: string; cls: string; dot: string }> = {
              concluded: {
                label: "CONCLUÍDA",
                cls: "bg-success/10 text-success border-success/30",
                dot: "bg-success",
              },
              pending: {
                label: "PENDENTE",
                cls: "bg-warning/10 text-warning border-warning/30",
                dot: "bg-warning",
              },
              cancelled: {
                label: "CANCELADA",
                cls: "bg-destructive/10 text-destructive border-destructive/30",
                dot: "bg-destructive",
              },
            };
            const st = statusMap[status] || statusMap.cancelled;
            const total = Number(selectedSale.total_amount || 0);
            const subtotal = Number(selectedSale.subtotal ?? total);
            const discount = Number(selectedSale.discount || 0);
            const addition = Number(selectedSale.addition || 0);
            const saleCode = selectedSale.sale_number
              ? `#${String(selectedSale.sale_number).padStart(6, "0")}`
              : `#${selectedSale.id.slice(0, 8).toUpperCase()}`;
            const brl = (n: number) =>
              n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const isCancelled = status === "cancelled";

            return (
              <div className="flex flex-col">
                {/* Hero header com gradiente azul */}
                <div className="relative p-6 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden">
                  <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                  <div className="relative flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <Badge className={`${st.cls} backdrop-blur font-black tracking-wider px-3 py-1 rounded-full`}>
                      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot} animate-pulse inline-block`} />
                      {st.label}
                    </Badge>
                  </div>
                  <DialogHeader className="text-left relative">
                    <DialogTitle className="text-2xl font-black tracking-tight">
                      Venda {saleCode}
                    </DialogTitle>
                    <DialogDescription className="text-sm font-medium text-primary-foreground/80 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(selectedSale.created_at), "dd 'de' MMMM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-4">
                  {/* Cliente */}
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-base">
                      {(selectedSale.customers?.name || "C")
                        .split(" ")
                        .map((p: string) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                        Cliente
                      </div>
                      <div className="font-bold text-base truncate">
                        {selectedSale.customers?.name || "Consumidor Final"}
                      </div>
                    </div>
                    {selectedSale.channel && (
                      <Badge variant="outline" className="rounded-full font-bold capitalize">
                        {selectedSale.channel}
                      </Badge>
                    )}
                  </div>

                  {/* Pagamento + Itens */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                        Pagamento
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm capitalize truncate">
                          {selectedSale.payment_method || "Não informado"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                        Identificação
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedSale.id);
                          toast.success("ID copiado!");
                        }}
                        className="flex items-center gap-2 font-mono text-xs font-bold hover:text-primary transition"
                        title="Copiar ID"
                      >
                        <Info className="h-4 w-4 text-primary" />
                        {selectedSale.id.slice(0, 8).toUpperCase()}
                      </button>
                    </div>
                  </div>

                  {/* Resumo financeiro */}
                  <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-bold">{brl(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <ArrowDownRight className="h-3.5 w-3.5 text-success" /> Desconto
                        </span>
                        <span className="font-bold text-success">- {brl(discount)}</span>
                      </div>
                    )}
                    {addition > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <ArrowUpRight className="h-3.5 w-3.5 text-warning" /> Acréscimo
                        </span>
                        <span className="font-bold text-warning">+ {brl(addition)}</span>
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-2 mt-2 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Total da Venda
                      </span>
                      <span className="text-2xl font-black text-primary">{brl(total)}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-[11px] disabled:opacity-50"
                      disabled={isCancelled}
                      onClick={() => {
                        if (isCancelled) {
                          toast.error("Vendas canceladas não podem ser editadas.");
                          return;
                        }
                        window.open(`/pdv?edit=${selectedSale.id}`, "_blank");
                        setIsDetailsOpen(false);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      className="h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-[11px]"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        openReceiptPopup(selectedSale);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Recibo
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-[11px]"
                      onClick={() => {
                        toast.info("Preparando cupom...");
                        openReceiptPopup(selectedSale, "a4", true);
                      }}
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </Button>
                  </div>

                  {/* Compartilhar */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg font-semibold text-xs gap-1.5"
                      onClick={() => {
                        const url = `${window.location.origin}/recibo/${selectedSale.id}`;
                        const msg = `Olá! Segue o recibo da sua compra ${saleCode}: ${url}`;
                        const phone = (selectedSale.customers as any)?.phone?.replace(/\D/g, "") || "";
                        window.open(
                          `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
                          "_blank",
                        );
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg font-semibold text-xs gap-1.5"
                      onClick={() => {
                        const url = `${window.location.origin}/recibo/${selectedSale.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link do recibo copiado!");
                      }}
                    >
                      <Share2 className="h-3.5 w-3.5" /> Copiar link
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal do Recibo */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className={`${receiptMode === "80mm" ? "max-w-[420px]" : "max-w-[940px]"} max-h-[92vh] overflow-hidden p-0 rounded-2xl bg-card border-border/60`}>
          <div className="print:hidden flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60 bg-muted/30">
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                {receiptMode === "80mm" ? "Cupom 80mm" : "Recibo da venda"}
              </DialogTitle>
              <DialogDescription>Confira o recibo antes de imprimir.</DialogDescription>
            </div>
            <Button
              disabled={!receiptData || receiptLoading}
              onClick={async () => {
                const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".receipt-print-area img"));
                await Promise.all(imgs.map((img) => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })));
                window.print();
              }}
              className="rounded-xl font-bold gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
          <div className="max-h-[calc(92vh-73px)] overflow-auto bg-muted/40 p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
            {receiptLoading ? (
              <div className="h-[420px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground">Carregando recibo...</p>
              </div>
            ) : receiptError ? (
              <div className="h-[420px] flex flex-col items-center justify-center gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="font-bold">{receiptError}</p>
                <Button variant="outline" onClick={() => setIsReceiptOpen(false)}>
                  Fechar
                </Button>
              </div>
            ) : receiptData ? (
              receiptMode === "80mm" ? <Receipt80mm data={receiptData} /> : <ReceiptPreview data={receiptData} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptPreview({ data }: { data: ReceiptData }) {
  const sale = data.sale || {};
  const customer = data.customer || {};
  const total = Number(sale.total_amount ?? 0);
  const receiptId = sale.sale_number
    ? `MP${String(sale.sale_number).padStart(10, "0")}`
    : `MP${String(sale.id || "").slice(0, 8).toUpperCase()}`;
  const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleDateString("pt-BR") : "";
  const sellerName = data.seller?.name || "—";
  const customerDocument = customer.document ?? customer.cpf ?? customer.cnpj ?? "";
  const customerAddress = customer.address ?? customer.endereco ?? "";
  const customerZip = customer.zip ?? customer.cep ?? "";
  const customerCity = customer.city ?? customer.cidade ?? "";
  const customerState = customer.state ?? customer.estado ?? customer.uf ?? "";
  const payments = data.payments.length
    ? data.payments
    : [{ method: sale.payment_method || "—", amount: total, installments: 1 }];

  return (
    <div className="receipt-print-area mx-auto w-full max-w-[820px] bg-white text-black border border-black/80 shadow-xl print:shadow-none print:border-black">
      <div className="border-b border-black px-3 py-2">
        <p className="text-[13px] font-bold uppercase">
          RECIBO DE {data.org_name} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NO PEDIDO
        </p>
      </div>

      <table className="w-full border-collapse text-[12px]">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 w-[28%]">Data de recebimento</td>
            <td className="border border-black px-2 py-1">Identificação e assinatura do recebedor</td>
            <td className="border border-black px-2 py-1 w-[28%]">
              Recibo da venda: <span className="font-bold">{receiptId}</span>
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-6"></td>
            <td className="border border-black px-2 py-6"></td>
            <td className="border border-black px-2 py-6"></td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse text-[12px] border-t-0">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-2 text-center align-top w-[60%]">
              {data.org?.logo_url && (
                <img
                  src={data.org.logo_url}
                  alt={data.org_name}
                  className="mx-auto mb-1 max-h-16 object-contain"
                />
              )}
              <p className="font-bold">{data.org_name}</p>
              {data.org?.cnpj && <p>CNPJ: {data.org.cnpj}</p>}
              {data.org?.phone && <p>Telefone: {data.org.phone}</p>}
            </td>
            <td className="border border-black px-3 py-2 align-top">
              <p><span className="font-bold">{saleDate}</span></p>
              <p><span className="font-bold">VENDEDOR:</span> {sellerName}</p>
              <p><span className="font-bold">RECIBO DA VENDA:</span> {receiptId}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-3 pb-1">
        <p className="text-[12px] font-bold">DESTINATÁRIO/REMETENTE</p>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold">Nome/Razão social</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[18%]">Telefone</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[18%]">CPF/CNPJ</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[22%]">E-mail</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1">{customer.name || "—"}</td>
            <td className="border border-black px-2 py-1">{customer.phone || ""}</td>
            <td className="border border-black px-2 py-1">{customerDocument}</td>
            <td className="border border-black px-2 py-1">{customer.email || ""}</td>
          </tr>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold">Endereço</th>
            <th className="border border-black px-2 py-1 text-center font-bold">CEP</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Cidade</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Estado</th>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">{customerAddress}</td>
            <td className="border border-black px-2 py-1">{customerZip}</td>
            <td className="border border-black px-2 py-1">{customerCity}</td>
            <td className="border border-black px-2 py-1">{customerState}</td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-3 pb-1">
        <p className="text-[12px] font-bold">DADOS DO PRODUTO</p>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold w-[10%]">Cód</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Produto</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[6%]">Qtd</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[14%]">Valor Unitário</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[12%]">Desconto</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[14%]">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          {(data.items.length ? data.items : [{ id: "empty", product_name: "Itens da venda", quantity: 1, unit_price: total, total }]).map((item: any) => {
            const description = [item.product_name, item.imei ? `IMEI: ${item.imei}` : null, item.model]
              .filter(Boolean)
              .join(" - ");
            return (
              <tr key={item.id}>
                <td className="border border-black px-2 py-1 align-top">{item.sku || (item.product_id ? item.product_id.slice(0, 7) : "")}</td>
                <td className="border border-black px-2 py-1 align-top">{description}</td>
                <td className="border border-black px-2 py-1 align-top text-center">{item.quantity}</td>
                <td className="border border-black px-2 py-1 align-top text-right">{formatCurrency(Number(item.unit_price))}</td>
                <td className="border border-black px-2 py-1 align-top text-right">{item.discount ? formatCurrency(Number(item.discount)) : "R$"}</td>
                <td className="border border-black px-2 py-1 align-top text-right">{formatCurrency(Number(item.total))}</td>
              </tr>
            );
          })}
          <tr>
            <td className="border border-black px-2 py-1 text-right font-bold" colSpan={3}>Total</td>
            <td className="border border-black px-2 py-1 text-right font-bold">{formatCurrency(Number(sale.subtotal ?? total))}</td>
            <td className="border border-black px-2 py-1 text-right font-bold">{sale.discount ? formatCurrency(Number(sale.discount)) : "R$"}</td>
            <td className="border border-black px-2 py-1 text-right font-bold">{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-3 pb-1"><p className="text-[12px] font-bold">PAGAMENTO</p></div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold w-[25%]">Forma de Pagamento</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Detalhes</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[20%]">Valor Pago</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[12%]">Parcelas</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment: any, index: number) => (
            <tr key={index}>
              <td className="border border-black px-2 py-1">{METHOD_LABEL[payment.method] || payment.method}</td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1 text-right">{formatCurrency(Number(payment.amount))}</td>
              <td className="border border-black px-2 py-1 text-center">{payment.installments ?? 1}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-2 py-1 text-right font-bold" colSpan={2}>Total</td>
            <td className="border border-black px-2 py-1 text-right font-bold">{formatCurrency(total)}</td>
            <td className="border border-black px-2 py-1"></td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-4">
        <p className="text-[12px] font-bold">OBSERVAÇÃO</p>
        <div className="h-6"></div>
        <p className="text-[12px] font-bold">DADOS ADICIONAIS</p>
        <div className="h-10"></div>
      </div>
      <div className="px-6 pb-3 pt-6 grid grid-cols-2 gap-10 text-center text-[12px]">
        <div><div className="border-t border-black pt-1">{customer.name || ""}</div></div>
        <div><div className="border-t border-black pt-1">{data.org_name}</div></div>
      </div>
      <div className="text-center text-[12px] py-3">OBRIGADO PELA PREFERÊNCIA.</div>

      <style>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body * { visibility: hidden !important; }
          .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; border-color: #000 !important; }
        }
      `}</style>
    </div>
  );
}

function Receipt80mm({ data }: { data: ReceiptData }) {
  const sale = data.sale || {};
  const customer = data.customer || {};
  const total = Number(sale.total_amount ?? 0);
  const subtotal = Number(sale.subtotal ?? total);
  const discount = Number(sale.discount ?? 0);
  const receiptNumber = sale.sale_number
    ? String(sale.sale_number).padStart(7, "0")
    : String(sale.id || "").slice(0, 7).toUpperCase();
  const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleDateString("pt-BR") : "";
  const sellerName = data.seller?.name || "—";
  const customerDocument = customer.document ?? customer.cpf ?? customer.cnpj ?? "";
  const customerAddress = [
    customer.address ?? customer.endereco,
    customer.neighborhood ?? customer.bairro,
    customer.city ?? customer.cidade,
    customer.state ?? customer.estado ?? customer.uf,
  ].filter(Boolean).join(", ");
  const payments = data.payments.length
    ? data.payments
    : [{ method: sale.payment_method || "—", amount: total, installments: 1 }];
  const deliveryType = sale.delivery_type || sale.channel || "Retirada";

  return (
    <div className="receipt-print-area mx-auto bg-white text-black shadow-xl print:shadow-none" style={{ width: "80mm", padding: "4mm", fontFamily: "'Courier New', ui-monospace, monospace", fontSize: "11px", lineHeight: 1.35 }}>
      <div className="text-center">
        <div className="font-bold text-[12px]">Nº {receiptNumber}</div>
        {data.org?.logo_url && (
          <img
            src={data.org.logo_url}
            alt={data.org_name}
            crossOrigin="anonymous"
            className="mx-auto my-1 receipt-logo"
            style={{ maxHeight: "55px", objectFit: "contain", display: "block", marginLeft: "auto", marginRight: "auto", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as any}
          />
        )}
        <div className="font-bold text-[13px]">{data.org_name}</div>
      </div>

      <div className="mt-2 space-y-0.5">
        {data.org?.cnpj && <div><span className="font-bold">CNPJ:</span> {data.org.cnpj}</div>}
        {data.org?.address && <div><span className="font-bold">Endereço:</span> {data.org.address}</div>}
        {data.org?.phone && <div><span className="font-bold">Fone:</span> {data.org.phone}</div>}
      </div>

      <div className="mt-2 space-y-0.5">
        <div><span className="font-bold">Vendedor(a):</span> {sellerName}</div>
        <div><span className="font-bold">Data da venda:</span> {saleDate}</div>
        <div><span className="font-bold">Tipo de Entrega:</span> {deliveryType}</div>
      </div>

      <div className="mt-2">
        <div className="font-bold">DADOS DO CLIENTE</div>
        <div><span className="font-bold">Cliente:</span> {customer.name || "—"}</div>
        {customerDocument && <div><span className="font-bold">CNPJ/CPF:</span> {customerDocument}</div>}
        {customerAddress && <div><span className="font-bold">Endereço:</span> {customerAddress}</div>}
        {customer.phone && <div><span className="font-bold">Fone:</span> {customer.phone}</div>}
      </div>

      <div className="mt-2">
        <div className="font-bold">PRODUTOS</div>
        <table className="w-full text-[10.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-left font-bold py-0.5">Produto</th>
              <th className="text-center font-bold w-7">Qtd</th>
              <th className="text-right font-bold w-12">Valor</th>
              <th className="text-right font-bold w-12">Desc</th>
              <th className="text-right font-bold w-14">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data.items.length ? data.items : [{ id: "empty", product_name: "Itens da venda", quantity: 1, unit_price: total, total, discount: 0 }]).map((item: any) => {
              const description = [item.product_name, item.imei ? `IMEI: ${item.imei}` : null, item.sku ? `Id: ${item.sku}` : null]
                .filter(Boolean)
                .join(" - ");
              return (
                <tr key={item.id} className="align-top">
                  <td className="py-0.5 pr-1 break-words">{description}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(Number(item.unit_price))}</td>
                  <td className="text-right">{item.discount ? formatCurrency(Number(item.discount)) : "-"}</td>
                  <td className="text-right">{formatCurrency(Number(item.total))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-black mt-1 pt-1 flex justify-between font-bold">
          <span>Total (R$):</span>
          <span>{formatCurrency(subtotal - discount || total)}</span>
        </div>
      </div>

      <div className="mt-2">
        <div className="font-bold">PAGAMENTO</div>
        <table className="w-full text-[10.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-left font-bold py-0.5">Forma de pagamento</th>
              <th className="text-left font-bold">Detalhes</th>
              <th className="text-right font-bold w-14">Valor (R$)</th>
              <th className="text-center font-bold w-10">Parc.</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment: any, index: number) => (
              <tr key={index} className="align-top">
                <td className="py-0.5 pr-1">{METHOD_LABEL[payment.method] || payment.method}</td>
                <td className="pr-1">{payment.reference || ""}</td>
                <td className="text-right">{formatCurrency(Number(payment.amount))}</td>
                <td className="text-center">{payment.installments ?? 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <div>Obs: {sale.notes || ""}</div>
        <div className="mt-6 border-t border-black pt-1 text-center text-[10px]">Assinatura do cliente</div>
      </div>

      <div className="mt-3 text-center text-[10px] border-t border-dashed border-black pt-2">
        Atenção! Esse documento não possui valor fiscal.
        <br />
        Obrigado!
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area { position: absolute !important; left: 0 !important; top: 0 !important; box-shadow: none !important; width: 80mm !important; }
          .receipt-print-area img { display: block !important; max-width: 100% !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
