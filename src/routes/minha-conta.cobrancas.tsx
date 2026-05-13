import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, CreditCard, CheckCircle2, XCircle, Clock, AlertTriangle, Download, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Export } from "@/lib/exportUniversal";

export const Route = createFileRoute("/minha-conta/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças · ConectaCRM" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: CobrancasPage,
});

type Payment = {
  id: string;
  mp_payment_id: string | null;
  provider: string | null;
  status: string;
  status_detail: string | null;
  amount_cents: number;
  currency: string;
  payment_method: string | null;
  created_at: string;
  plan_id: string | null;
};

const BRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: any; label: string }> = {
    approved: { color: "bg-success/10 text-success border-success/30", icon: CheckCircle2, label: "Aprovado" },
    pending: { color: "bg-warning/10 text-warning border-warning/30", icon: Clock, label: "Pendente" },
    in_process: { color: "bg-warning/10 text-warning border-warning/30", icon: Clock, label: "Processando" },
    rejected: { color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle, label: "Recusado" },
    cancelled: { color: "bg-muted text-muted-foreground", icon: XCircle, label: "Cancelado" },
    refunded: { color: "bg-info/10 text-info border-info/30", icon: AlertTriangle, label: "Estornado" },
  };
  const cfg = map[status] ?? { color: "bg-muted", icon: AlertTriangle, label: status };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

function CobrancasPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, failed: 0 });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("payments")
        .select("id, mp_payment_id, provider, status, status_detail, amount_cents, currency, payment_method, created_at, plan_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const list = (data ?? []) as Payment[];
      setPayments(list);

      const total = list.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount_cents, 0);
      setStats({
        total,
        approved: list.filter((p) => p.status === "approved").length,
        pending: list.filter((p) => p.status === "pending" || p.status === "in_process").length,
        failed: list.filter((p) => p.status === "rejected" || p.status === "cancelled").length,
      });
      setLoading(false);
    })();
  }, [user?.id]);

  const exportCsv = () => {
    Export.csv("cobrancas", payments, [
      { key: "created_at", label: "Data", format: (v) => new Date(v).toLocaleString("pt-BR") },
      { key: "mp_payment_id", label: "ID MP" },
      { key: "amount_cents", label: "Valor", format: (v) => BRL(v) },
      { key: "payment_method", label: "Método" },
      { key: "status", label: "Status" },
    ]);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Histórico de Cobranças" subtitle="Todas as transações de assinatura" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-5xl">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/minha-conta">
              <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card variant="gradient" className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center"><CreditCard className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total pago</p>
                  <p className="text-xl font-black">{BRL(stats.total)}</p>
                </div>
              </div>
            </Card>
            <Card variant="gradient" className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 grid place-items-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Aprovados</p>
                  <p className="text-xl font-black">{stats.approved}</p>
                </div>
              </div>
            </Card>
            <Card variant="gradient" className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-warning/10 grid place-items-center"><Clock className="h-5 w-5 text-warning" /></div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pendentes</p>
                  <p className="text-xl font-black">{stats.pending}</p>
                </div>
              </div>
            </Card>
            <Card variant="gradient" className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 grid place-items-center"><XCircle className="h-5 w-5 text-destructive" /></div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Recusados</p>
                  <p className="text-xl font-black">{stats.failed}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cobranças</CardTitle>
              {payments.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : payments.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="Nenhuma cobrança ainda"
                  description="As cobranças aparecerão aqui assim que você assinar um plano ou pagar uma renovação."
                  action={{ label: "Ver planos", onClick: () => (window.location.href = "/assinar") }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="font-mono text-xs">ID MP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="capitalize">{p.payment_method ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="text-right font-bold">{BRL(p.amount_cents)}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{p.mp_payment_id ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
