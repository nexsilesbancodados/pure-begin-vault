import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, TrendingDown, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios/churn")({
  component: ChurnPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Sale = {
  id: string;
  customer_id: string | null;
  total_amount: number | null;
  created_at: string;
  status: string | null;
};

type AtRisk = {
  customer: Customer;
  lastPurchase: string;
  totalSpent: number;
  purchasesCount: number;
  daysSinceLast: number;
};

function ChurnPage() {
  const { orgId } = useOrg();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdDays, setThresholdDays] = useState(90);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("customers" as any)
        .select("id, name, phone, email")
        .eq("organization_id", orgId)
        .limit(2000),
      supabase
        .from("sales_orders")
        .select("id, customer_id, total_amount, created_at, status")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]).then(([c, s]) => {
      setCustomers((c.data as Customer[]) ?? []);
      setSales((s.data as Sale[]) ?? []);
      setLoading(false);
    });
  }, [orgId]);

  const atRisk: AtRisk[] = useMemo(() => {
    const now = Date.now();
    const byCustomer = new Map<string, Sale[]>();
    for (const s of sales) {
      if (!s.customer_id || s.status === "cancelada") continue;
      const arr = byCustomer.get(s.customer_id) ?? [];
      arr.push(s);
      byCustomer.set(s.customer_id, arr);
    }
    const out: AtRisk[] = [];
    for (const c of customers) {
      const cs = byCustomer.get(c.id);
      if (!cs || cs.length === 0) continue;
      const last = cs.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      );
      const days = Math.floor(
        (now - new Date(last.created_at).getTime()) / 86400000
      );
      if (days < thresholdDays) continue;
      out.push({
        customer: c,
        lastPurchase: last.created_at,
        totalSpent: cs.reduce((a, b) => a + Number(b.total_amount ?? 0), 0),
        purchasesCount: cs.length,
        daysSinceLast: days,
      });
    }
    return out.sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers, sales, thresholdDays]);

  const totals = useMemo(
    () => ({
      count: atRisk.length,
      revenue: atRisk.reduce((a, b) => a + b.totalSpent, 0),
      avgDays:
        atRisk.length === 0
          ? 0
          : Math.round(
              atRisk.reduce((a, b) => a + b.daysSinceLast, 0) / atRisk.length
            ),
    }),
    [atRisk]
  );

  const sendReactivation = async (r: AtRisk) => {
    if (!r.customer.phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    setSending(r.customer.id);
    try {
      const firstName = r.customer.name.split(" ")[0];
      const text = `Oi ${firstName}! Faz tempo que não te vemos por aqui ❤️\n\nTemos novidades especiais pra clientes como você. Que tal dar uma passada na loja?`;
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { to: r.customer.phone, text },
      });
      if (error) throw error;
      toast.success("Mensagem enviada");
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message ?? "erro"));
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Análise de Churn" subtitle="Clientes em risco de não voltar" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="threshold">Dias sem comprar (limite)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={7}
                  max={365}
                  value={thresholdDays}
                  onChange={(e) => setThresholdDays(parseInt(e.target.value) || 90)}
                />
              </div>
              <div className="md:col-span-2 text-xs text-muted-foreground">
                Clientes que compraram pelo menos 1 vez e não voltam há {thresholdDays}+ dias.
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi
              icon={Users}
              label="Em risco"
              value={totals.count}
              color="warning"
            />
            <Kpi
              icon={TrendingDown}
              label="Receita histórica"
              value={`R$ ${totals.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              color="destructive"
            />
            <Kpi
              icon={AlertTriangle}
              label="Média dias inativos"
              value={totals.avgDays}
              color="warning"
            />
          </div>

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3">
              Top clientes em risco
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum cliente em risco com o critério atual.
              </p>
            ) : (
              <div className="space-y-2">
                {atRisk.slice(0, 30).map((r) => (
                  <div
                    key={r.customer.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">{r.customer.name}</p>
                        {r.purchasesCount > 1 && (
                          <Badge variant="outline" className="text-[9px]">
                            {r.purchasesCount}x cliente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Última: {new Date(r.lastPurchase).toLocaleDateString("pt-BR")} ·{" "}
                        {r.daysSinceLast} dias atrás · R$ {r.totalSpent.toFixed(0)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!r.customer.phone || sending === r.customer.id}
                      onClick={() => sendReactivation(r)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {sending === r.customer.id ? "Enviando..." : "Reativar"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "warning" | "destructive";
}) {
  const colors = {
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="text-xl font-black truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
