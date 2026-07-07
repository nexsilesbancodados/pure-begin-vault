import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Activity,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useOrg } from "@/lib/useOrg";
import { useDashboardRole } from "@/lib/userRole";
import { DATASETS, GROUP_LABELS, DatasetDef, ExportGroup } from "@/lib/export/registry";
import { fetchDataset, countDataset, ExportFilters } from "@/lib/export/fetcher";
import { downloadCsv } from "@/lib/export/csv";
import { downloadXlsx } from "@/lib/export/xlsx";
import { collectTableStats, runIntegrityChecks, TableStat, IntegrityIssue } from "@/lib/export/diagnostics";
import { generateBackupZip, BackupProgress, BackupResult } from "@/lib/export/backup";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/sistema/exportacao")({
  head: () => ({
    meta: [
      { title: "Central de Exportação de Dados · Conecta" },
      { name: "description", content: "Exportação e diagnóstico de dados do Conecta Sistema (somente leitura)." },
    ],
  }),
  component: ExportacaoPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error?.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Página não encontrada.</div>,
});

function ExportacaoPage() {
  const { orgId } = useOrg();
  const role = useDashboardRole();
  const isAdmin = role === "admin";

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta área é restrita a administradores da loja.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            Central de Exportação de Dados
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Módulo somente leitura. Nenhum dado do sistema será alterado.
          </p>
        </div>
        <BackupButton orgId={orgId} />
      </header>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Diagnóstico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="export">
          <ExportTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="diagnostics">
          <DiagnosticsTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────
function DashboardTab({ orgId }: { orgId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const out: Record<string, number> = {};
    await Promise.all(
      DATASETS.map(async (ds) => {
        out[ds.key] = await countDataset(ds, orgId);
      }),
    );
    setCounts(out);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const grouped = useMemo(() => {
    const g: Record<string, DatasetDef[]> = {};
    for (const d of DATASETS) (g[d.group] ||= []).push(d);
    return g;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {(Object.keys(grouped) as ExportGroup[]).map((gk) => (
        <section key={gk}>
          <h3 className="text-xs uppercase font-black tracking-widest text-muted-foreground mb-2">
            {GROUP_LABELS[gk]}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {grouped[gk].map((ds) => (
              <Card key={ds.key} className="p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
                  {ds.label}
                </div>
                <div className="text-2xl font-black tracking-tight mt-1">
                  {loading && counts[ds.key] === undefined ? (
                    <span className="text-muted-foreground/50">…</span>
                  ) : (
                    (counts[ds.key] ?? 0).toLocaleString("pt-BR")
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{ds.table}</div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
function ExportTab({ orgId }: { orgId: string | null }) {
  const [selected, setSelected] = useState<string>(DATASETS[0]?.key ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(null);
  const [lastReport, setLastReport] = useState<any | null>(null);

  const ds = DATASETS.find((d) => d.key === selected)!;

  const grouped = useMemo(() => {
    const g: Record<string, DatasetDef[]> = {};
    for (const d of DATASETS) (g[d.group] ||= []).push(d);
    return g;
  }, []);

  const doExport = async (format: "csv" | "xlsx") => {
    if (!ds) return;
    setBusy(true);
    setProgress({ loaded: 0, total: null });
    const filters: ExportFilters = {};
    if (periodStart) filters.periodStart = new Date(periodStart).toISOString();
    if (periodEnd) filters.periodEnd = new Date(periodEnd + "T23:59:59").toISOString();
    if (status) filters.status = status;

    try {
      const res = await fetchDataset(ds, orgId, filters, (loaded, total) =>
        setProgress({ loaded, total }),
      );
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const base = `${ds.key}_${stamp}`;
      let bytes = 0;
      if (format === "csv") {
        bytes = downloadCsv(`${base}.csv`, res.rows, res.columns);
      } else {
        downloadXlsx(`${base}.xlsx`, ds.label, res.rows, res.columns, {
          dataset: ds.key,
          tabela: ds.table,
          organizacao: orgId,
          gerado_em: new Date().toISOString(),
          filtros: filters,
          total_registros: res.count,
        });
        bytes = res.count * 100; // estimativa
      }
      setLastReport({
        dataset: ds.key,
        label: ds.label,
        format,
        rows: res.count,
        columns: res.columns.length,
        durationMs: res.durationMs,
        bytes,
        warnings: res.warnings,
        filters,
        generatedAt: new Date().toISOString(),
      });
      toast.success(`Exportação concluída: ${res.count.toLocaleString("pt-BR")} registros`);
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadReport = () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${lastReport.dataset}_${lastReport.generatedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid md:grid-cols-[280px,1fr] gap-4">
      <Card className="p-2">
        <ScrollArea className="h-[560px]">
          <div className="space-y-3 p-1">
            {(Object.keys(grouped) as ExportGroup[]).map((gk) => (
              <div key={gk}>
                <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-2 mb-1">
                  {GROUP_LABELS[gk]}
                </div>
                <div className="space-y-0.5">
                  {grouped[gk].map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setSelected(d.key)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted transition-colors ${
                        selected === d.key ? "bg-primary/10 text-primary font-bold" : ""
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> {ds?.label}
            <Badge variant="outline" className="font-mono text-[10px]">{ds?.table}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ds?.description && <p className="text-xs text-muted-foreground">{ds.description}</p>}

          <div className="grid sm:grid-cols-3 gap-3">
            {ds?.dateColumn && (
              <>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Início ({ds.dateColumn})</label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Fim</label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </>
            )}
            {ds?.statusColumn && (
              <div>
                <label className="text-[11px] font-bold text-muted-foreground">{ds.statusColumn}</label>
                <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="ex: completed" />
              </div>
            )}
          </div>

          {progress && (
            <div className="space-y-1">
              <Progress value={progress.total ? (progress.loaded / progress.total) * 100 : undefined} />
              <div className="text-[10px] text-muted-foreground">
                {progress.loaded.toLocaleString("pt-BR")} {progress.total ? `/ ${progress.total.toLocaleString("pt-BR")}` : ""} registros
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => doExport("csv")} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Exportar CSV
            </Button>
            <Button onClick={() => doExport("xlsx")} disabled={busy} variant="secondary" className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Exportar Excel
            </Button>
          </div>

          {lastReport && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-bold">Último relatório</div>
                  <Button size="sm" variant="ghost" onClick={downloadReport} className="h-7 text-[10px]">
                    Baixar .json
                  </Button>
                </div>
                <div>Dataset: <b>{lastReport.label}</b></div>
                <div>Formato: {lastReport.format.toUpperCase()}</div>
                <div>Registros: {lastReport.rows.toLocaleString("pt-BR")}</div>
                <div>Colunas: {lastReport.columns}</div>
                <div>Tempo: {lastReport.durationMs} ms</div>
                {lastReport.warnings?.length > 0 && (
                  <div className="text-warning">Avisos: {lastReport.warnings.join("; ")}</div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────
function DiagnosticsTab({ orgId }: { orgId: string | null }) {
  const [stats, setStats] = useState<TableStat[]>([]);
  const [issues, setIssues] = useState<IntegrityIssue[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);

  const loadStats = async () => {
    if (!orgId) return;
    setLoadingStats(true);
    setStats(await collectTableStats(orgId));
    setLoadingStats(false);
  };

  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const runIntegrity = async () => {
    setLoadingIssues(true);
    setIssues(await runIntegrityChecks(orgId));
    setLoadingIssues(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Estatísticas por tabela
          </CardTitle>
          <Button size="sm" variant="outline" onClick={loadStats} disabled={loadingStats} className="gap-1.5">
            {loadingStats ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Recarregar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Dataset</th>
                  <th className="py-2 pr-3 font-mono">Tabela</th>
                  <th className="py-2 pr-3 text-right">Registros</th>
                  <th className="py-2 pr-3 text-right">Colunas</th>
                  <th className="py-2 pr-3">Última atualização</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.key} className="border-b border-border/50">
                    <td className="py-1.5 pr-3">{s.label}</td>
                    <td className="py-1.5 pr-3 font-mono text-muted-foreground">{s.table}</td>
                    <td className="py-1.5 pr-3 text-right font-bold">{s.count.toLocaleString("pt-BR")}</td>
                    <td className="py-1.5 pr-3 text-right">{s.columns}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Integridade (somente relatório)
          </CardTitle>
          <Button size="sm" onClick={runIntegrity} disabled={loadingIssues} className="gap-1.5">
            {loadingIssues ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Rodar checagem
          </Button>
        </CardHeader>
        <CardContent>
          {issues === null ? (
            <p className="text-xs text-muted-foreground">Clique em "Rodar checagem" para verificar CPFs/CNPJs inválidos, IMEIs duplicados e órfãos.</p>
          ) : issues.length === 0 ? (
            <p className="text-xs text-success">Nenhuma inconsistência encontrada nas verificações executadas.</p>
          ) : (
            <div className="space-y-3">
              {issues.map((i, idx) => (
                <div key={idx} className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">{i.category}</div>
                    <Badge variant="destructive">{i.count}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{i.table}</div>
                  {i.sample && i.sample.length > 0 && (
                    <pre className="text-[10px] mt-2 p-2 bg-background/60 rounded overflow-x-auto">
                      {JSON.stringify(i.sample, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
