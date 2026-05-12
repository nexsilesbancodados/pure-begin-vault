import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ArrowUpCircle, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/estoque/compras")({
  component: ComprasPage,
});

type Compra = {
  id: string;
  product?: { name: string };
  quantity: number;
  unit_cost?: number | null;
  reason: string;
  notes?: string | null;
  created_at: string;
};

const BRL = (cents: number) => `R$ ${cents.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function ComprasPage() {
  const { orgId } = useOrg();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("stock_movements")
      .select("id, product:products(name), quantity, unit_cost, reason, notes, created_at")
      .eq("organization_id", orgId)
      .in("movement_type", ["in", "entrada"])
      .order("created_at", { ascending: false })
      .limit(200);
    setCompras((data ?? []) as Compra[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const totals = compras.reduce(
    (acc, c) => {
      acc.qty += c.quantity;
      acc.value += (c.quantity * (c.unit_cost ?? 0));
      return acc;
    },
    { qty: 0, value: 0 }
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Compras / Entradas" subtitle="Histórico de entradas de mercadoria" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 grid place-items-center"><ArrowUpCircle className="h-5 w-5 text-success" /></div>
                <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Itens entrados</p><p className="text-2xl font-black">{totals.qty}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center"><ShoppingCart className="h-5 w-5 text-primary" /></div>
                <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total investido</p><p className="text-2xl font-black">{BRL(totals.value)}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-info/10 grid place-items-center"><Truck className="h-5 w-5 text-info" /></div>
                <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Notas</p><p className="text-2xl font-black">{compras.length}</p></div>
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <ExportMenu
              filename="compras-entradas"
              rows={compras}
              cols={[
                { key: "created_at", label: "Data", format: (v) => new Date(v).toLocaleString("pt-BR") },
                { key: "product", label: "Produto", format: (v: any) => v?.name ?? "—" },
                { key: "quantity", label: "Qtd" },
                { key: "unit_cost", label: "Custo unit." },
                { key: "reason", label: "Motivo" },
              ]}
            />
            <Link to="/estoque/movimentacoes">
              <Button className="gap-2"><ArrowUpCircle className="h-4 w-4" /> Nova entrada</Button>
            </Link>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : compras.length === 0 ? (
            <Card>
              <EmptyState
                icon={ShoppingCart}
                title="Nenhuma compra registrada"
                description="Registre entradas via Movimentações de Estoque. Cada entrada atualiza o saldo do produto automaticamente."
                action={{ label: "Ir para movimentações", onClick: () => (window.location.href = "/estoque/movimentacoes") }}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Data</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Produto</th>
                    <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Qtd</th>
                    <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Custo unit.</th>
                    <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Total</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                      <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3 font-bold">{c.product?.name ?? "—"}</td>
                      <td className="p-3 text-right font-black">{c.quantity}</td>
                      <td className="p-3 text-right">{c.unit_cost ? BRL(c.unit_cost) : "—"}</td>
                      <td className="p-3 text-right font-black">{c.unit_cost ? BRL(c.unit_cost * c.quantity) : "—"}</td>
                      <td className="p-3"><Badge variant="outline" className="capitalize">{c.reason}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
