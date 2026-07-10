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
  Archive,
  FileDown,
  Users,
  ShoppingCart,
  Banknote,
  CalendarRange,
  Package,
  CreditCard,
  HardDrive,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrg } from "@/lib/useOrg";
import { useDashboardRole } from "@/lib/userRole";
import { DATASETS, GROUP_LABELS, DatasetDef, ExportGroup, isTransactionalDataset } from "@/lib/export/registry";
import { fetchDataset, countDataset, ExportFilters } from "@/lib/export/fetcher";
import { downloadCsv } from "@/lib/export/csv";
import { downloadXlsx } from "@/lib/export/xlsx";
import { collectTableStats, runIntegrityChecks, TableStat, IntegrityIssue } from "@/lib/export/diagnostics";
import { generateBackupZip, BackupProgress, BackupResult, BackupPeriod } from "@/lib/export/backup";
import { runCompatibilityAnalysis, exportCompatibilityPdf, CompatibilityReport, Severity } from "@/lib/export/compatibility";
import {
  checkCustomerIntegrity,
  exportCustomers,
  CustomerIntegrityReport,
  CustomerExportMode,
} from "@/lib/export/customers";
import { validateSales, exportSales, SalesValidationReport, SalesExportMode, SalesExportResult } from "@/lib/export/sales";
import {
  validateFinancialExport,
  exportFinancial,
  FinancialExportMode,
  FinancialExportResult,
  FinancialIntegrityReport,
} from "@/lib/export/financial";
import { FinancialAssistant } from "@/components/exportacao/FinancialAssistant";

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
  const [period, setPeriod] = useState<BackupPeriod>({ from: null, to: null });

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
        <BackupButton orgId={orgId} period={period} />
      </header>

      <PeriodFilterPanel period={period} onChange={setPeriod} orgId={orgId} />

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
          <TabsTrigger value="compat" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Compatibilidade
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <FileText className="h-4 w-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="vendas" className="gap-2">
            <FileText className="h-4 w-4" /> Vendas
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2">
            <Banknote className="h-4 w-4" /> Financeiro
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
        <TabsContent value="compat">
          <CompatibilityTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="clientes">
          <CustomersTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="vendas">
          <SalesTab orgId={orgId} period={period} />
        </TabsContent>
        <TabsContent value="financeiro">
          <FinancialTab orgId={orgId} />
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

// ─────────────────────────────────────────────────────

type PresetKey =
  | "hoje"
  | "ontem"
  | "7d"
  | "30d"
  | "mes"
  | "mes_passado"
  | "ano"
  | "todos"
  | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "ano", label: "Este ano" },
  { key: "todos", label: "Todo o período" },
  { key: "custom", label: "Personalizado" },
];

function computePreset(k: PresetKey): BackupPeriod {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  if (k === "todos" || k === "custom") return { from: null, to: null };
  if (k === "hoje") return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (k === "ontem") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
  }
  if (k === "7d") {
    const s = new Date(now); s.setDate(s.getDate() - 7);
    return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (k === "30d") {
    const s = new Date(now); s.setDate(s.getDate() - 30);
    return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (k === "mes") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: s.toISOString(), to: endOfDay(now).toISOString() };
  }
  if (k === "mes_passado") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { from: s.toISOString(), to: e.toISOString() };
  }
  // ano
  const s = new Date(now.getFullYear(), 0, 1);
  return { from: s.toISOString(), to: endOfDay(now).toISOString() };
}

function periodsEqual(a: BackupPeriod, b: BackupPeriod) {
  return (a.from ?? "") === (b.from ?? "") && (a.to ?? "") === (b.to ?? "");
}

function detectPreset(p: BackupPeriod): PresetKey {
  if (!p.from && !p.to) return "todos";
  for (const opt of PRESETS) {
    if (opt.key === "custom" || opt.key === "todos") continue;
    if (periodsEqual(p, computePreset(opt.key))) return opt.key;
  }
  return "custom";
}

const fmtBr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

function PeriodFilterPanel({
  period,
  onChange,
  orgId,
}: {
  period: BackupPeriod;
  onChange: (p: BackupPeriod) => void;
  orgId: string | null;
}) {
  const currentPreset = detectPreset(period);
  const [preset, setPreset] = useState<PresetKey>(currentPreset);

  useEffect(() => {
    setPreset(detectPreset(period));
  }, [period]);

  const applyPreset = (k: PresetKey) => {
    setPreset(k);
    if (k === "custom") return; // manter datas atuais para edição
    onChange(computePreset(k));
  };

  const active = !!(period.from || period.to);
  const transCount = DATASETS.filter(isTransactionalDataset).length;
  const masterCount = DATASETS.length - transCount;

  // Resumo em tempo real
  const [summary, setSummary] = useState<{
    vendas: number;
    itens: number;
    pagamentos: number;
    totalRows: number;
    loading: boolean;
  }>({ vendas: 0, itens: 0, pagamentos: 0, totalRows: 0, loading: false });

  useEffect(() => {
    let cancelled = false;
    if (!orgId) return;
    (async () => {
      setSummary((s) => ({ ...s, loading: true }));
      const filters: ExportFilters = {};
      if (period.from) filters.periodStart = period.from;
      if (period.to) filters.periodEnd = period.to;
      const vendasDs = DATASETS.find((d) => d.key === "sales_orders")!;
      const itensDs = DATASETS.find((d) => d.key === "sale_items")!;
      const pagDs = DATASETS.find((d) => d.key === "sale_payments")!;
      const [vendas, itens, pagamentos] = await Promise.all([
        countDataset(vendasDs, orgId, filters),
        countDataset(itensDs, orgId, {}),
        countDataset(pagDs, orgId, {}),
      ]);
      if (cancelled) return;
      const totalRows = vendas + itens + pagamentos;
      setSummary({ vendas, itens, pagamentos, totalRows, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, period.from, period.to]);

  const estimatedBytes = summary.totalRows * 320; // ~320 bytes por linha CSV
  const showCustom = preset === "custom";

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            Filtros da exportação
            {active ? (
              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                {fmtBr(period.from)} → {fmtBr(period.to)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Todo o período</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Período</label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as PresetKey)}>
              <SelectTrigger className="h-8 w-[190px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {showCustom && (
          <div className="grid grid-cols-2 sm:max-w-md gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground font-bold">De</label>
              <Input
                type="date"
                className="h-9"
                value={period.from ? period.from.slice(0, 10) : ""}
                onChange={(e) =>
                  onChange({
                    ...period,
                    from: e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : null,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-bold">Até</label>
              <Input
                type="date"
                className="h-9"
                value={period.to ? period.to.slice(0, 10) : ""}
                onChange={(e) =>
                  onChange({
                    ...period,
                    to: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null,
                  })
                }
              />
            </div>
          </div>
        )}

        {/* Resumo em tempo real */}
        <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Resultado da exportação
            </span>
            {summary.loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <SummaryTile icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Vendas" value={summary.vendas.toLocaleString("pt-BR")} />
            <SummaryTile icon={<Package className="h-3.5 w-3.5" />} label="Itens" value={summary.itens.toLocaleString("pt-BR")} />
            <SummaryTile icon={<CreditCard className="h-3.5 w-3.5" />} label="Pagamentos" value={summary.pagamentos.toLocaleString("pt-BR")} />
            <SummaryTile
              icon={<CalendarRange className="h-3.5 w-3.5" />}
              label="Período"
              value={active ? `${fmtBr(period.from)} → ${fmtBr(period.to)}` : "Completo"}
              wide
            />
            <SummaryTile icon={<HardDrive className="h-3.5 w-3.5" />} label="Tamanho est." value={fmtBytes(estimatedBytes)} />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Aplica-se aos <strong>{transCount} módulos transacionais</strong> (vendas, financeiro, estoque, compras, CRM e serviços).
          Os <strong>{masterCount} cadastros mestres</strong> (clientes, produtos, fornecedores) são sempre exportados por
          completo para preservar integridade referencial.
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-md border bg-background/60 px-2.5 py-2 ${wide ? "sm:col-span-1" : ""}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-black tracking-tight mt-0.5 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function BackupButton({ orgId, period }: { orgId: string | null; period?: BackupPeriod }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [result, setResult] = useState<BackupResult | null>(null);

  const run = async () => {
    if (!orgId) {
      toast.error("Nenhuma loja selecionada.");
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress(null);
    try {
      const res = await generateBackupZip(orgId, (p) => setProgress(p), period ?? null);
      setResult(res);
      toast.success(
        `Backup gerado: ${res.totalRows.toLocaleString("pt-BR")} registros (${(res.bytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    } catch (e: any) {
      toast.error(`Falha no backup: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pct = progress
    ? Math.round((progress.currentIndex / progress.totalDatasets) * 100)
    : null;

  return (
    <div className="flex flex-col items-end gap-1 min-w-[260px]">
      <Button onClick={run} disabled={busy} size="lg" className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
        Exportar Backup Completo
      </Button>
      {progress && (
        <div className="w-full space-y-1">
          <Progress value={pct ?? undefined} />
          <div className="text-[10px] text-muted-foreground text-right">
            {progress.currentIndex}/{progress.totalDatasets} · {progress.currentDataset} ·{" "}
            {progress.rowsSoFar.toLocaleString("pt-BR")} registros
          </div>
        </div>
      )}
      {result && !busy && (
        <div className="text-[10px] text-muted-foreground text-right">
          ✓ {result.filename} · {(result.bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
          {result.totalRows.toLocaleString("pt-BR")} registros ·{" "}
          {(result.durationMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}

const SEV_COLOR: Record<Severity, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/40",
  media: "bg-warning/15 text-warning border-warning/40",
  baixa: "bg-muted text-muted-foreground border-border",
};

function CompatibilityTab({ orgId }: { orgId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [exporting, setExporting] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await runCompatibilityAnalysis(orgId);
      setReport(r);
      toast.success(`Análise concluída · ${r.overallScore}% de compatibilidade`);
    } catch (e: any) {
      toast.error(`Falha na análise: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const doPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const name = await exportCompatibilityPdf(report);
      toast.success(`PDF gerado: ${name}`);
    } catch (e: any) {
      toast.error(`Falha ao gerar PDF: ${e?.message ?? e}`);
    } finally {
      setExporting(false);
    }
  };

  const scoreColor = (n: number) =>
    n >= 95 ? "text-success" : n >= 80 ? "text-primary" : n >= 60 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Análise de Compatibilidade para Migração
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={run} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {report ? "Rodar novamente" : "Analisar base"}
            </Button>
            <Button size="sm" variant="secondary" onClick={doPdf} disabled={!report || exporting} className="gap-1.5">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Exportar Relatório (PDF)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!report ? (
            <p className="text-xs text-muted-foreground">
              Executa dezenas de verificações somente-leitura em produtos, clientes, fornecedores, estoque, financeiro e integridade referencial.
              Nenhum dado é alterado.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">Compatibilidade da base</div>
                  <div className={`text-6xl font-black tracking-tight ${scoreColor(report.overallScore)}`}>
                    {report.overallScore}%
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 min-w-[280px]">
                  {report.modules.map((m) => (
                    <div key={m.module} className="rounded-lg border p-2">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{m.label}</div>
                      <div className={`text-xl font-black ${scoreColor(m.score)}`}>{m.score}%</div>
                      <Progress value={m.score} className="mt-1" />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {m.issuesCount.toLocaleString("pt-BR")} inconsistências
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Total: <b>{report.totalIssues.toLocaleString("pt-BR")}</b> inconsistências · Duração:{" "}
                {(report.durationMs / 1000).toFixed(1)}s
              </div>

              {report.modules.map((m) => (
                <div key={m.module}>
                  <h3 className="text-xs uppercase font-black tracking-widest text-muted-foreground mb-2">
                    {m.label} — {m.score}%
                  </h3>
                  <div className="space-y-1">
                    {m.checks.filter((c) => c.count > 0 || c.error).length === 0 ? (
                      <p className="text-[11px] text-success">Nenhuma inconsistência encontrada.</p>
                    ) : (
                      m.checks
                        .filter((c) => c.count > 0 || c.error)
                        .sort((a, b) => b.count - a.count)
                        .map((c) => (
                          <div
                            key={c.id}
                            className={`flex items-center justify-between text-xs rounded-md border px-2 py-1.5 ${SEV_COLOR[c.severity]}`}
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] uppercase font-bold">
                                {c.severity}
                              </Badge>
                              <span>{c.label}</span>
                              {c.error && <span className="text-[10px] opacity-70">({c.error})</span>}
                            </div>
                            <span className="font-black tabular-nums">{c.count.toLocaleString("pt-BR")}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersTab({ orgId }: { orgId: string | null }) {
  const [report, setReport] = useState<CustomerIntegrityReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<CustomerExportMode | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      setReport(await checkCustomerIntegrity(orgId));
    } catch (e: any) {
      toast.error(`Falha na verificação: ${e?.message ?? e}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const doExport = async (mode: CustomerExportMode, format: "csv" | "xlsx") => {
    setBusy(mode);
    try {
      const res = await exportCustomers(orgId, mode, format);
      toast.success(`Exportado: ${res.filename} · ${res.count.toLocaleString("pt-BR")} clientes`);
    } catch (e: any) {
      toast.error(`Falha: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const IntegRow = ({ label, value, danger }: { label: string; value: number; danger?: boolean }) => (
    <div className={`rounded-md border px-3 py-2 ${danger && value > 0 ? "bg-destructive/10 border-destructive/40" : ""}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-black ${danger && value > 0 ? "text-destructive" : ""}`}>
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Integridade do cadastro de clientes
          </CardTitle>
          <Button size="sm" variant="outline" onClick={check} disabled={checking} className="gap-1.5">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reverificar
          </Button>
        </CardHeader>
        <CardContent>
          {!report ? (
            <p className="text-xs text-muted-foreground">Analisando base…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <IntegRow label="Total" value={report.total} />
                <IntegRow label="Sem nome" value={report.semNome} danger />
                <IntegRow label="Sem telefone" value={report.semTelefone} />
                <IntegRow label="Sem cidade" value={report.semCidade} />
                <IntegRow label="CPF inválido" value={report.cpfInvalido} danger />
                <IntegRow label="CNPJ inválido" value={report.cnpjInvalido} danger />
                <IntegRow label="CPF duplicado" value={report.cpfDuplicado} danger />
                <IntegRow label="CNPJ duplicado" value={report.cnpjDuplicado} danger />
              </div>
              {report.amostraProblemas.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Ver amostra ({report.amostraProblemas.length})</summary>
                  <pre className="mt-2 p-2 bg-muted/40 rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(report.amostraProblemas, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExportRow
            title="Exportação Padrão"
            desc="Todas as colunas da tabela + métricas (total_compras, ticket_medio, última compra)."
            mode="padrao"
            busy={busy}
            onExport={doExport}
          />
          <ExportRow
            title="Exportação Expandida"
            desc="Achata campos JSON (metadata.*) em colunas individuais."
            mode="expandida"
            busy={busy}
            onExport={doExport}
          />
          <ExportRow
            title="Exportação compatível com Premier ERP"
            desc="Colunas em pt-BR e ordem esperada pelo importador do Premier ERP."
            mode="premier"
            busy={busy}
            onExport={doExport}
            highlight
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ExportRow({
  title, desc, mode, busy, onExport, highlight,
}: {
  title: string;
  desc: string;
  mode: CustomerExportMode;
  busy: CustomerExportMode | null;
  onExport: (m: CustomerExportMode, f: "csv" | "xlsx") => void;
  highlight?: boolean;
}) {
  const disabled = busy !== null;
  return (
    <div className={`rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap ${highlight ? "border-primary/60 bg-primary/5" : ""}`}>
      <div>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onExport(mode, "csv")} disabled={disabled} className="gap-1.5">
          {busy === mode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          CSV
        </Button>
        <Button size="sm" onClick={() => onExport(mode, "xlsx")} disabled={disabled} className="gap-1.5">
          {busy === mode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          Excel
        </Button>
      </div>
    </div>
  );
}

function SalesTab({ orgId, period }: { orgId: string | null; period: BackupPeriod }) {
  const [report, setReport] = useState<SalesValidationReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SalesExportResult | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      setReport(await validateSales(orgId, period));
    } catch (e: any) {
      toast.error(`Falha: ${e?.message ?? e}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, period.from, period.to]);

  const doExport = async (mode: SalesExportMode, format: "csv" | "xlsx" | "zip") => {
    const key = `${mode}-${format}`;
    setBusy(key);
    try {
      const res = await exportSales(orgId, mode, format, period);
      setLastResult(res);
      toast.success(`Exportado: ${res.filename}`);
    } catch (e: any) {
      toast.error(`Falha: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const Cell = ({ label, value, danger }: { label: string; value: number; danger?: boolean }) => (
    <div className={`rounded-md border px-3 py-2 ${danger && value > 0 ? "bg-destructive/10 border-destructive/40" : ""}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-black ${danger && value > 0 ? "text-destructive" : ""}`}>
        {(value ?? 0).toLocaleString("pt-BR")}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Validação do histórico de vendas
          </CardTitle>
          <Button size="sm" variant="outline" onClick={check} disabled={checking} className="gap-1.5">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reverificar
          </Button>
        </CardHeader>
        <CardContent>
          {!report ? (
            <p className="text-xs text-muted-foreground">Verificando…</p>
          ) : (
            <>
              <div className="rounded-md border bg-muted/30 px-3 py-2 mb-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={(report.erros ?? 0) > 0 ? "destructive" : "outline"}>
                  {(report.erros ?? 0).toLocaleString("pt-BR")} erros
                </Badge>
                <Badge variant="outline">
                  {(report.avisos ?? 0).toLocaleString("pt-BR")} avisos
                </Badge>
                <Badge variant="outline">
                  {(report.inconsistencias ?? 0).toLocaleString("pt-BR")} inconsistências
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> {(report.percentualIntegridade ?? 100).toFixed(1)}% integridade
                </Badge>
                <span className="text-muted-foreground">
                  Pré-validação automática incluída no ZIP Premier como validation_report.json.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <Cell label="Total de vendas" value={report.totalVendas} />
                <Cell label="Canceladas" value={report.vendasCanceladas} />
                <Cell label="Sem cliente" value={report.vendasSemCliente} danger />
                <Cell label="Sem vendedor" value={report.vendasSemVendedor ?? 0} danger />
                <Cell label="Sem itens" value={report.vendasSemItens} danger />
                <Cell label="Clientes inexistentes" value={report.clientesInexistentes} danger />
                <Cell label="Produtos inexistentes" value={report.produtosInexistentes} danger />
                <Cell label="IMEIs duplicados" value={report.imeisDuplicados} danger />
                <Cell label="Pagamentos órfãos" value={report.pagamentosOrfaos} danger />
                <Cell label="Itens órfãos" value={report.itensSemVenda ?? 0} danger />
                <Cell label="Valores negativos" value={report.valoresNegativos} danger />
                <Cell label="Totais divergentes" value={report.totaisDivergentes ?? 0} danger />
                <Cell label="Pagamentos divergentes" value={report.pagamentosDivergentes ?? 0} danger />
                <Cell label="Itens negativos" value={report.itensNegativos ?? 0} danger />
                <Cell label="Qtd. incorreta" value={report.quantidadeIncorreta ?? 0} danger />
              </div>
              {report.amostra.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Ver amostra ({report.amostra.length})
                  </summary>
                  <pre className="mt-2 p-2 bg-muted/40 rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(report.amostra, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SalesRow title="Padrão" desc="Todas as colunas das tabelas sales_orders, sale_items, sale_payments." mode="padrao" busy={busy} onExport={doExport} />
          <SalesRow title="Expandida" desc="Achata campos JSON (metadata.*) em colunas individuais." mode="expandida" busy={busy} onExport={doExport} />
          <SalesRow title="Compatível com Premier ERP" desc="Cabeçalhos pt-BR na estrutura esperada pelo importador do Premier." mode="premier" busy={busy} onExport={doExport} highlight />
        </CardContent>
      </Card>

      {lastResult && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-3 text-xs grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div><div className="text-muted-foreground">Vendas</div><div className="font-black text-lg">{lastResult.vendas.toLocaleString("pt-BR")}</div></div>
            <div><div className="text-muted-foreground">Itens</div><div className="font-black text-lg">{lastResult.itens.toLocaleString("pt-BR")}</div></div>
            <div><div className="text-muted-foreground">Pagamentos</div><div className="font-black text-lg">{lastResult.pagamentos.toLocaleString("pt-BR")}</div></div>
            <div><div className="text-muted-foreground">Total vendido</div><div className="font-black text-lg">R$ {lastResult.totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
            <div><div className="text-muted-foreground">Duração</div><div className="font-black text-lg">{(lastResult.durationMs / 1000).toFixed(1)}s</div></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SalesRow({
  title, desc, mode, busy, onExport, highlight,
}: {
  title: string;
  desc: string;
  mode: SalesExportMode;
  busy: string | null;
  onExport: (m: SalesExportMode, f: "csv" | "xlsx" | "zip") => void;
  highlight?: boolean;
}) {
  const disabled = busy !== null;
  const b = (f: "csv" | "xlsx" | "zip") => busy === `${mode}-${f}`;
  return (
    <div className={`rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap ${highlight ? "border-primary/60 bg-primary/5" : ""}`}>
      <div>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onExport(mode, "zip")} disabled={disabled} className="gap-1.5">
          {b("zip") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          ZIP (3 CSVs)
        </Button>
        <Button size="sm" onClick={() => onExport(mode, "xlsx")} disabled={disabled} className="gap-1.5">
          {b("xlsx") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          Excel (3 abas)
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
function FinancialTab({ orgId }: { orgId: string | null }) {
  return <FinancialAssistant orgId={orgId} />;
}

