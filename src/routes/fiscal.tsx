import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RequirePermission } from "@/components/layout/RequirePermission";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertCircle, ExternalLink, Receipt, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/fiscal")({
  component: () => (
    <RequirePermission perm="fiscal">
      <FiscalPage />
    </RequirePermission>
  ),
});

type Sale = {
  id: string;
  created_at: string;
  total_amount: number | null;
  status: string | null;
  sale_number: number | null;
  customer_id: string | null;
};

function FiscalPage() {
  const { orgId } = useOrg();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from("sales_orders")
      .select("id, created_at, total_amount, status, sale_number, customer_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setSales((data as Sale[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  // Sem provedor fiscal configurado, todas as vendas ficam "pendentes" de emissão.
  // Quando a integração for ativada, o status fiscal deve ser persistido na metadata
  // do sales_order ou em uma tabela separada `fiscal_documents`.
  const stats = useMemo(() => {
    const pendentes = sales;
    const valorPendente = pendentes.reduce((a, b) => a + Number(b.total_amount ?? 0), 0);
    return {
      emitidas: [] as Sale[],
      pendentes,
      rejeitadas: [] as Sale[],
      valorEmitido: 0,
      valorPendente,
    };
  }, [sales]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Módulo Fiscal" subtitle="NF-e e NFC-e" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-5 bg-warning/5 border-warning/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-black mb-1">Integração com emissor fiscal pendente</p>
                <p className="text-muted-foreground leading-relaxed">
                  A emissão real de NF-e/NFC-e exige integração com um provedor (Focus NFe, eNotas,
                  NFe.io, PlugNotas etc) ou SEFAZ direto. O painel abaixo mostra o status fiscal
                  das vendas registradas. Para emitir, configure as credenciais do provedor e
                  o certificado A1 nas configurações.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="https://focusnfe.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Focus NFe <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://enotas.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    eNotas <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://plugnotas.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    PlugNotas <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={Receipt} label="Emitidas" value={stats.emitidas.length} color="success" />
            <Kpi icon={Calendar} label="Pendentes" value={stats.pendentes.length} color="warning" />
            <Kpi icon={AlertCircle} label="Rejeitadas" value={stats.rejeitadas.length} color="destructive" />
            <Kpi
              icon={DollarSign}
              label="A emitir (R$)"
              value={`R$ ${stats.valorPendente.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              color="primary"
            />
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm uppercase tracking-widest">Últimas vendas</h3>
              <Badge variant="outline">{sales.length} registros</Badge>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : sales.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold">Nenhuma venda registrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Realize vendas no PDV para aparecerem aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Data</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Total</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Status fiscal</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">Número NF</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 50).map((s) => {
                      const dt = new Date(s.created_at).toLocaleDateString("pt-BR");
                      return (
                        <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="py-2 px-2 text-muted-foreground">{dt}</td>
                          <td className="py-2 px-2 font-bold">R$ {Number(s.total_amount ?? 0).toFixed(2)}</td>
                          <td className="py-2 px-2">
                            <Badge className="bg-warning/15 text-warning">Pendente</Badge>
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">
                            {s.sale_number ? `#${s.sale_number}` : "—"}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              title="Configure um provedor fiscal nas Configurações"
                            >
                              Emitir
                            </Button>
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

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "primary" | "success" | "warning" | "destructive";
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
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
