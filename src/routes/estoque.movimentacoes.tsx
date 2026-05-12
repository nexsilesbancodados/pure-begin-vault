import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowUpCircle, ArrowDownCircle, Search } from "lucide-react";
import { StockMovementForm } from "@/components/estoque/StockMovementForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/estoque/movimentacoes")({
  component: MovimentacoesPage,
});

type Mov = {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost?: number | null;
  reason: string;
  notes?: string | null;
  created_at: string;
  product?: { name: string };
};

function MovimentacoesPage() {
  const { orgId } = useOrg();
  const [movs, setMovs] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("stock_movements")
      .select("*, product:products(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);
    setMovs((data ?? []) as Mov[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const filtered = movs.filter((m) =>
    !q ? true : ((m.product?.name ?? "") + m.reason + (m.notes ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  const totals = movs.reduce(
    (acc, m) => {
      const isIn = m.movement_type === "in" || m.movement_type === "entrada";
      if (isIn) acc.in += m.quantity;
      else acc.out += m.quantity;
      return acc;
    },
    { in: 0, out: 0 }
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Movimentações de Estoque" subtitle="Log auditável de todas as alterações" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 grid place-items-center"><ArrowUpCircle className="h-5 w-5 text-success" /></div>
                <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Entradas</p><p className="text-2xl font-black">{totals.in}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 grid place-items-center"><ArrowDownCircle className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Saídas</p><p className="text-2xl font-black">{totals.out}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-info/10 grid place-items-center"><Search className="h-5 w-5 text-info" /></div>
                <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total mov.</p><p className="text-2xl font-black">{movs.length}</p></div>
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto/motivo..." className="pl-10 h-10" />
            </div>
            <ExportMenu
              filename="movimentacoes-estoque"
              rows={filtered}
              cols={[
                { key: "created_at", label: "Data", format: (v) => new Date(v).toLocaleString("pt-BR") },
                { key: "movement_type", label: "Tipo" },
                { key: "product", label: "Produto", format: (v: any) => v?.name ?? "—" },
                { key: "quantity", label: "Qtd" },
                { key: "unit_cost", label: "Custo unit." },
                { key: "reason", label: "Motivo" },
                { key: "notes", label: "Obs" },
              ]}
            />
            <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nova movimentação</Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={ArrowUpCircle}
                title={q ? "Sem resultados" : "Nenhuma movimentação ainda"}
                description={q ? "Tente outra busca" : "Registre entradas/saídas pra ter histórico auditável de cada produto."}
                action={!q ? { label: "Registrar movimentação", onClick: () => setOpen(true) } : undefined}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Data</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Tipo</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Produto</th>
                    <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Qtd</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Motivo</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const isIn = m.movement_type === "in" || m.movement_type === "entrada";
                    return (
                      <tr key={m.id} className="border-b border-border hover:bg-muted/20">
                        <td className="p-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                        <td className="p-3">
                          {isIn ? (
                            <Badge className="bg-success/10 text-success border-success/20 gap-1"><ArrowUpCircle className="h-3 w-3" /> Entrada</Badge>
                          ) : (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><ArrowDownCircle className="h-3 w-3" /> Saída</Badge>
                          )}
                        </td>
                        <td className="p-3 font-bold">{m.product?.name ?? "—"}</td>
                        <td className={`p-3 text-right font-black ${isIn ? "text-success" : "text-destructive"}`}>{isIn ? "+" : "-"}{m.quantity}</td>
                        <td className="p-3 text-xs capitalize">{m.reason}</td>
                        <td className="p-3 text-xs text-muted-foreground">{m.notes ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </div>

      <StockMovementForm open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}
