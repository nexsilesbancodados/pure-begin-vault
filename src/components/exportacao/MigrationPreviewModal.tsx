// Prévia da migração — mostra exatamente o que será enviado ao Premier ERP.
import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, Loader2, Download } from "lucide-react";
import {
  SalesValidationReport,
  SalesSanitizeFilters,
  computeExcludedSales,
} from "@/lib/export/sales";

const PREMIER_SCHEMA_VERSION = "premier-erp-1.0";

const money = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return String(iso);
  }
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "primary" | "danger" | "muted" }) {
  const cls =
    tone === "primary"
      ? "border-primary/40 bg-primary/5"
      : tone === "danger"
      ? "border-destructive/40 bg-destructive/10"
      : "bg-muted/30";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-black">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
    </div>
  );
}

export function MigrationPreviewModal({
  open,
  onOpenChange,
  report,
  sanitize,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report: SalesValidationReport | null;
  sanitize: SalesSanitizeFilters;
  busy: boolean;
  onConfirm: () => void;
}) {
  const data = useMemo(() => {
    if (!report) return null;
    const { excluded, reasonsBySale } = computeExcludedSales(report, sanitize);
    const totalVendas = report.totalVendas ?? 0;
    const exportadas = Math.max(0, totalVendas - excluded.size);
    const integridade = totalVendas > 0 ? (exportadas / totalVendas) * 100 : 100;

    const excludedList = report.salesIndex
      .filter((s) => excluded.has(s.id))
      .map((s) => ({
        id: s.id,
        sale_number: s.sale_number,
        cliente: s.customer_name || s.customer_id || "—",
        data: s.created_at,
        valor: Number(s.total_amount ?? 0),
        motivo: (reasonsBySale.get(s.id) ?? []).join(" · ") || "—",
      }));

    const resumo = {
      semItens: sanitize.excludeSemItens ? report.candidates.semItens.length : 0,
      totalDivergente: sanitize.excludeTotalDivergente ? report.candidates.totalDivergente.length : 0,
      semCliente: sanitize.excludeSemCliente ? report.candidates.semCliente.length : 0,
      imeiDuplicado: sanitize.excludeImeiDuplicado ? report.candidates.imeiDuplicado.length : 0,
      pagamentoDivergente: sanitize.excludePagamentoDivergente ? report.candidates.pagamentoDivergente.length : 0,
      canceladas: sanitize.excludeCanceladas ? report.candidates.canceladas.length : 0,
    };
    const outros = Math.max(
      0,
      excluded.size -
        (resumo.semItens +
          resumo.totalDivergente +
          resumo.semCliente +
          resumo.imeiDuplicado +
          resumo.pagamentoDivergente +
          resumo.canceladas),
    );

    return { excluded, excludedList, exportadas, integridade, resumo, outros };
  }, [report, sanitize]);

  const clean = (data?.excluded.size ?? 0) === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Prévia da migração — Premier ERP</DialogTitle>
        </DialogHeader>

        {!report || !data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Preparando prévia…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selo */}
            <div
              className={`rounded-lg border p-3 flex items-center gap-3 ${
                clean
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              {clean ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              <div>
                <div className="text-base font-black">
                  {clean ? "🟢 Pacote pronto para importar no Premier" : "🟡 Pacote contém inconsistências"}
                </div>
                <div className="text-xs">
                  Integridade: {data.integridade.toFixed(1)}% · {data.exportadas.toLocaleString("pt-BR")} exportadas ·{" "}
                  {data.excluded.size.toLocaleString("pt-BR")} excluídas · {new Date().toLocaleString("pt-BR")} ·
                  schema {PREMIER_SCHEMA_VERSION}
                </div>
              </div>
            </div>

            {/* Cartões principais */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Kpi label="Vendas exportadas" value={data.exportadas} tone="primary" />
              <Kpi label="Vendas excluídas" value={data.excluded.size} tone={data.excluded.size > 0 ? "danger" : "muted"} />
              <Kpi label="Clientes referenciados" value={report.totals?.clientesReferenciados ?? 0} />
              <Kpi label="Produtos referenciados" value={report.totals?.produtosReferenciados ?? 0} />
              <Kpi label="Itens exportados" value={report.totals?.itens ?? 0} />
              <Kpi label="Pagamentos exportados" value={report.totals?.pagamentos ?? 0} />
            </div>

            {/* Resumo das exclusões */}
            <div className="rounded-md border p-3">
              <div className="text-xs font-bold mb-2">Resumo das exclusões</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <ResumoItem label="Venda sem itens" value={data.resumo.semItens} />
                <ResumoItem label="Total divergente" value={data.resumo.totalDivergente} />
                <ResumoItem label="Cliente inexistente" value={data.resumo.semCliente} />
                <ResumoItem label="IMEI duplicado" value={data.resumo.imeiDuplicado} />
                <ResumoItem label="Pagamento divergente" value={data.resumo.pagamentoDivergente} />
                <ResumoItem label="Canceladas" value={data.resumo.canceladas} />
                <ResumoItem label="Outros" value={data.outros} />
              </div>
            </div>

            {/* Tabela de excluídos (até 20) */}
            {data.excludedList.length > 0 && (
              <div className="rounded-md border">
                <div className="px-3 py-2 border-b text-xs font-bold flex items-center justify-between">
                  <span>Registros excluídos (mostrando {Math.min(20, data.excludedList.length)} de {data.excludedList.length})</span>
                  <Badge variant="outline">excluded_records.csv</Badge>
                </div>
                <ScrollArea className="max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1.5">Sale ID</th>
                        <th className="px-2 py-1.5">Cliente</th>
                        <th className="px-2 py-1.5">Data</th>
                        <th className="px-2 py-1.5 text-right">Valor</th>
                        <th className="px-2 py-1.5">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.excludedList.slice(0, 20).map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-2 py-1 font-mono text-[10px]">{r.sale_number ?? r.id.slice(0, 8)}</td>
                          <td className="px-2 py-1 truncate max-w-[180px]">{r.cliente}</td>
                          <td className="px-2 py-1">{fmtDate(r.data)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{money(r.valor)}</td>
                          <td className="px-2 py-1 text-destructive">{r.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={busy || !report} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar ZIP Premier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumoItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded border px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={value > 0 ? "destructive" : "outline"} className="text-[10px]">
        {value.toLocaleString("pt-BR")}
      </Badge>
    </div>
  );
}
