import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreditCard, CalendarDays, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — ConectaCRM" },
      { name: "description", content: "Veja sua assinatura, pagamentos e gerencie seu plano." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: MinhaContaPage,
});

type Sub = {
  id: string;
  status: string;
  plan_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  plans?: { name: string; price_cents: number; slug: string } | null;
};

type Pay = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  payment_method: string | null;
  created_at: string;
};

const fmtMoney = (cents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format((cents || 0) / 100);

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativa", cls: "bg-green-500/15 text-green-600" },
    pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-600" },
    canceled: { label: "Cancelada", cls: "bg-zinc-500/15 text-zinc-600" },
    past_due: { label: "Em atraso", cls: "bg-red-500/15 text-red-600" },
  };
  const v = map[s] || { label: s, cls: "bg-muted text-foreground" };
  return <Badge className={v.cls + " border-0"}>{v.label}</Badge>;
}

function MinhaContaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Sub | null>(null);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [canceling, setCanceling] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: subs }, { data: pays }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id,status,plan_id,current_period_start,current_period_end,canceled_at,plans(name,price_cents,slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("payments")
        .select("id,status,amount_cents,currency,payment_method,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setSub((subs?.[0] as any) ?? null);
    setPayments((pays as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCancel = async () => {
    if (!sub) return;
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) return;
    setCanceling(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`https://htsjkvczxlrsfapkbidq.supabase.co/functions/v1/cancel-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ subscription_id: sub.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erro ao cancelar");
      toast.success("Assinatura cancelada.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar assinatura");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Minha conta</h1>
            <p className="text-sm text-muted-foreground">Gerencie seu plano e veja seu histórico de pagamentos.</p>
          </header>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Plano atual
                      </CardTitle>
                      <CardDescription>Detalhes da sua assinatura</CardDescription>
                    </div>
                    {sub ? statusBadge(sub.status) : <Badge variant="secondary">Sem assinatura</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sub ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Plano</div>
                          <div className="font-medium">{sub.plans?.name ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Valor</div>
                          <div className="font-medium">
                            {sub.plans ? `${fmtMoney(sub.plans.price_cents)} / mês` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" /> Próximo vencimento
                          </div>
                          <div className="font-medium">{fmtDate(sub.current_period_end)}</div>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                          <Link to="/assinar">Trocar de plano</Link>
                        </Button>
                        {sub.status === "active" || sub.status === "pending" ? (
                          <Button variant="destructive" onClick={handleCancel} disabled={canceling}>
                            {canceling ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Cancelar assinatura
                          </Button>
                        ) : null}
                      </div>
                      {sub.canceled_at && (
                        <p className="text-xs text-muted-foreground">
                          Cancelada em {fmtDate(sub.canceled_at)}.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-sm">
                      Você ainda não tem uma assinatura.{" "}
                      <Link to="/assinar" className="text-primary underline">
                        Ver planos
                      </Link>
                      .
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de pagamentos</CardTitle>
                  <CardDescription>Últimos 20 pagamentos</CardDescription>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum pagamento registrado.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{fmtDate(p.created_at)}</TableCell>
                            <TableCell className="capitalize">{p.payment_method ?? "—"}</TableCell>
                            <TableCell>{statusBadge(p.status)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {fmtMoney(p.amount_cents, p.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
