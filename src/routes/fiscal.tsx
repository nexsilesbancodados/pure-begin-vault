import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Receipt, Printer, Search, FileText, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

// Repurposed: agora é "Cupons & Recibos" (sem emissão de NF-e).
// Mantém a URL /fiscal pra não quebrar links no Sidebar/menu.
export const Route = createFileRoute("/fiscal")({
  component: CuponsPage,
});

type Sale = {
  id: string;
  sale_number: number | null;
  created_at: string;
  total_amount: number | null;
  status: string | null;
  channel: string | null;
  payment_method: string | null;
};

function CuponsPage() {
  const { orgId } = useOrg();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("sales_orders")
      .select("id, sale_number, created_at, total_amount, status, channel, payment_method")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setSales((data as Sale[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      [s.sale_number, s.id, s.status, s.channel, s.payment_method]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [sales, search]);

  const stats = useMemo(() => {
    const finalizadas = sales.filter((s) => s.status !== "cancelada" && s.status !== "quote");
    const orcamentos = sales.filter((s) => s.status === "quote" || s.status === "orcamento");
    const total = finalizadas.reduce((a, b) => a + Number(b.total_amount ?? 0), 0);
    return { vendas: finalizadas.length, orcamentos: orcamentos.length, total };
  }, [sales]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Cupons & Recibos" subtitle="Comprovantes não-fiscais e orçamentos" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-4 bg-muted/40">
            <div className="flex items-start gap-3 text-sm">
              <Receipt className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-bold">Sem emissão de NF-e/NFC-e nesta loja</p>
                <p className="text-xs text-muted-foreground">
                  Geramos apenas cupons não-fiscais (recibo interno) e orçamentos para entregar ao cliente.
                  Cada venda tem um cupom imprimível em formato 80mm (papel térmico).
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi icon={Receipt} label="Vendas" value={stats.vendas} />
            <Kpi icon={FileText} label="Orçamentos" value={stats.orcamentos} />
            <Kpi icon={Calendar} label="Faturado" value={`R$ ${stats.total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
          </div>

          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por número, status ou pagamento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3">
              Últimas vendas ({filtered.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma venda registrada ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Data</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Número</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Total</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Status</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map((s) => {
                      const isQuote = s.status === "quote" || s.status === "orcamento";
                      return (
                        <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="py-2 px-2 text-muted-foreground text-xs">
                            {new Date(s.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">
                            {s.sale_number ? `#${s.sale_number}` : s.id.slice(0, 8)}
                          </td>
                          <td className="py-2 px-2 font-bold">
                            R$ {Number(s.total_amount ?? 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2">
                            <Badge className={
                              isQuote
                                ? "bg-warning/15 text-warning"
                                : s.status === "cancelada"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-success/15 text-success"
                            }>
                              {isQuote ? "Orçamento" : s.status === "cancelada" ? "Cancelada" : "Finalizada"}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Link
                              to={isQuote ? "/orcamento/$id" : "/recibo/$id"}
                              params={{ id: s.id }}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                            >
                              <Printer className="h-3 w-3" /> Imprimir
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
          <div className="text-xl font-black truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
