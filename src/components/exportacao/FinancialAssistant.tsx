// Sprint 3.3 — Assistente de Migração Financeira
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Banknote,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  FINANCIAL_MODULE_LABELS,
  FINANCIAL_TRANSACTIONAL,
  FinancialAssistantResult,
  FinancialDateField,
  FinancialModuleKey,
  FinancialStatusFilter,
  ModuleFilter,
  exportFinancialAssistant,
  summarizeFinancialModule,
  validateFinancialExport,
  FinancialIntegrityReport,
} from "@/lib/export/financial";

const SEV_COLOR: Record<string, string> = {
  alta: "border-destructive/60 bg-destructive/10 text-destructive",
  media: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  baixa: "border-muted-foreground/30 bg-muted/40",
};

const ALL_MODULES: FinancialModuleKey[] = [
  "accounts_payable",
  "accounts_receivable",
  "finance_transactions",
  "bank_accounts",
  "cash_register",
  "financial_categories",
  "chart_of_accounts",
  "cost_centers",
];

const DATE_FIELD_LABEL: Record<FinancialDateField, string> = {
  due_date: "Vencimento",
  issued_at: "Emissão",
  paid_at: "Pagamento",
  transaction_date: "Data da movimentação",
  created_at: "Criação",
};

const MODULE_DATE_FIELDS: Record<FinancialModuleKey, FinancialDateField[]> = {
  accounts_payable: ["due_date", "issued_at", "paid_at"],
  accounts_receivable: ["due_date", "issued_at", "paid_at"],
  finance_transactions: ["transaction_date", "created_at"],
  bank_accounts: [],
  cash_register: [],
  financial_categories: [],
  chart_of_accounts: [],
  cost_centers: [],
};

const STATUS_LABEL: Record<FinancialStatusFilter, string> = {
  all: "Todas",
  open: "Em aberto",
  paid: "Pagas",
  overdue: "Vencidas",
};

type Preset = "hoje" | "30d" | "90d" | "ano" | "custom";

function presetRange(preset: Preset): { start?: string; end?: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const end = iso(today);
  if (preset === "hoje") return { start: end, end };
  if (preset === "30d") { const d = new Date(today); d.setDate(d.getDate() - 30); return { start: iso(d), end }; }
  if (preset === "90d") { const d = new Date(today); d.setDate(d.getDate() - 90); return { start: iso(d), end }; }
  if (preset === "ano") { const d = new Date(today.getFullYear(), 0, 1); return { start: iso(d), end }; }
  return {};
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinancialAssistant({ orgId }: { orgId: string | null }) {
  const [selected, setSelected] = useState<Set<FinancialModuleKey>>(new Set(["accounts_payable"]));
  const [filters, setFilters] = useState<Partial<Record<FinancialModuleKey, ModuleFilter>>>({
    accounts_payable: { status: "open", dateField: "due_date" },
    accounts_receivable: { status: "open", dateField: "due_date" },
    finance_transactions: { dateField: "transaction_date" },
  });
  const [presets, setPresets] = useState<Partial<Record<FinancialModuleKey, Preset>>>({});
  const [summaries, setSummaries] = useState<Partial<Record<FinancialModuleKey, { count: number; totalAmount: number; loading?: boolean }>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FinancialAssistantResult | null>(null);

  // Diagnóstico
  const [report, setReport] = useState<FinancialIntegrityReport | null>(null);
  const [checking, setChecking] = useState(false);

  const toggleModule = (key: FinancialModuleKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const setFilter = (key: FinancialModuleKey, patch: Partial<ModuleFilter>) => {
    setFilters((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), ...patch } }));
  };

  const applyPreset = (key: FinancialModuleKey, preset: Preset) => {
    setPresets((p) => ({ ...p, [key]: preset }));
    const { start, end } = presetRange(preset);
    setFilter(key, { periodStart: start, periodEnd: end });
  };

  const refreshSummary = async (key: FinancialModuleKey) => {
    setSummaries((s) => ({ ...s, [key]: { ...(s[key] ?? { count: 0, totalAmount: 0 }), loading: true } }));
    const res = await summarizeFinancialModule(orgId, key, filters[key]).catch(() => ({ count: 0, totalAmount: 0 }));
    setSummaries((s) => ({ ...s, [key]: { ...res, loading: false } }));
  };

  const refreshAll = async () => {
    for (const key of ALL_MODULES) {
      await refreshSummary(key);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Re-summariza módulos com filtro sempre que filtro muda
  useEffect(() => {
    if (!orgId) return;
    for (const key of FINANCIAL_TRANSACTIONAL) {
      void refreshSummary(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orgId,
    filters.accounts_payable?.status, filters.accounts_payable?.dateField, filters.accounts_payable?.periodStart, filters.accounts_payable?.periodEnd,
    filters.accounts_receivable?.status, filters.accounts_receivable?.dateField, filters.accounts_receivable?.periodStart, filters.accounts_receivable?.periodEnd,
    filters.finance_transactions?.status, filters.finance_transactions?.dateField, filters.finance_transactions?.periodStart, filters.finance_transactions?.periodEnd,
  ]);

  const runDiagnostic = async () => {
    setChecking(true);
    try {
      const r = await validateFinancialExport(orgId);
      setReport(r);
    } catch (e: any) {
      toast.error(`Falha no diagnóstico: ${e?.message ?? e}`);
    } finally {
      setChecking(false);
    }
  };

  const doExport = async (format: "xlsx" | "zip") => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um módulo para exportar.");
      return;
    }
    setBusy(format);
    try {
      const filtersFiltered: Partial<Record<FinancialModuleKey, ModuleFilter>> = {};
      for (const k of selected) if (filters[k]) filtersFiltered[k] = filters[k];
      const result = await exportFinancialAssistant(
        orgId,
        { modules: [...selected], filters: filtersFiltered },
        format,
      );
      setLastResult(result);
      toast.success(`Exportado: ${result.filename}`);
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const previewTotals = useMemo(() => {
    let count = 0, total = 0;
    for (const k of selected) {
      const s = summaries[k];
      if (s) { count += s.count; total += s.totalAmount; }
    }
    return { count, total };
  }, [selected, summaries]);

  return (
    <div className="space-y-4">
      {/* Dashboard dinâmico */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Dashboard financeiro
            <span className="text-[10px] font-medium text-muted-foreground">(reflete os filtros aplicados)</span>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={refreshAll} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_MODULES.map((k) => {
              const s = summaries[k];
              return (
                <div key={k} className="rounded-md border px-3 py-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {FINANCIAL_MODULE_LABELS[k]}
                  </div>
                  <div className="text-xl font-black">
                    {s?.loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (s?.count ?? 0).toLocaleString("pt-BR")}
                  </div>
                  {FINANCIAL_TRANSACTIONAL.includes(k) && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {money(s?.totalAmount ?? 0)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Seleção de módulos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que deseja exportar?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_MODULES.map((k) => (
              <label key={k} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={selected.has(k)}
                  onChange={() => toggleModule(k)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">{FINANCIAL_MODULE_LABELS[k]}</span>
                {FINANCIAL_TRANSACTIONAL.includes(k) && (
                  <Badge variant="outline" className="ml-auto text-[9px]">filtros</Badge>
                )}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros específicos para módulos transacionais */}
      {FINANCIAL_TRANSACTIONAL.filter((k) => selected.has(k)).map((k) => {
        const f = filters[k] ?? {};
        const s = summaries[k];
        const dateFields = MODULE_DATE_FIELDS[k];
        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="text-sm">Filtros — {FINANCIAL_MODULE_LABELS[k]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {k !== "finance_transactions" && (
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={f.status ?? "all"}
                      onValueChange={(v) => setFilter(k, { status: v as FinancialStatusFilter })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as FinancialStatusFilter[]).map((sv) => (
                          <SelectItem key={sv} value={sv}>{STATUS_LABEL[sv]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Data de referência</Label>
                  <Select
                    value={f.dateField ?? dateFields[0]}
                    onValueChange={(v) => setFilter(k, { dateField: v as FinancialDateField })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {dateFields.map((df) => (
                        <SelectItem key={df} value={df}>{DATE_FIELD_LABEL[df]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Período</Label>
                  <Select
                    value={presets[k] ?? "custom"}
                    onValueChange={(v) => applyPreset(k, v as Preset)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="90d">Últimos 90 dias</SelectItem>
                      <SelectItem value="ano">Este ano</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={f.periodStart ?? ""} onChange={(e) => { setPresets((p) => ({ ...p, [k]: "custom" })); setFilter(k, { periodStart: e.target.value || undefined }); }} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={f.periodEnd ?? ""} onChange={(e) => { setPresets((p) => ({ ...p, [k]: "custom" })); setFilter(k, { periodEnd: e.target.value || undefined }); }} />
                </div>
              </div>
              <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs flex flex-wrap gap-4">
                <span><strong>Registros:</strong> {s?.loading ? "…" : (s?.count ?? 0).toLocaleString("pt-BR")}</span>
                <span><strong>Valor total:</strong> {money(s?.totalAmount ?? 0)}</span>
                <span><strong>Período:</strong> {f.periodStart ?? "—"} até {f.periodEnd ?? "hoje"}</span>
                {k !== "finance_transactions" && <span><strong>Status:</strong> {STATUS_LABEL[f.status ?? "all"]}</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Preview + Exportação */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Preview e exportação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-primary/5 px-3 py-2 text-sm">
            <div className="font-bold">Será gerado:</div>
            <ul className="text-xs mt-1 space-y-0.5">
              <li>• Backup ZIP</li>
              <li>• Manifest</li>
              <li>• README</li>
              <li>• Diagnóstico</li>
              <li>• Checksums</li>
              <li>• Arquivos dos módulos selecionados</li>
            </ul>
            <div className="mt-3 font-bold">Serão exportados:</div>
            <ul className="text-xs mt-1 space-y-0.5">
              {[...selected].map((k) => {
                const s = summaries[k];
                return (
                  <li key={k}>
                    • {FINANCIAL_MODULE_LABELS[k]} — {(s?.count ?? 0).toLocaleString("pt-BR")} registros
                    {FINANCIAL_TRANSACTIONAL.includes(k) ? ` · ${money(s?.totalAmount ?? 0)}` : ""}
                  </li>
                );
              })}
              {selected.size === 0 && <li className="text-muted-foreground">Nenhum módulo selecionado.</li>}
            </ul>
            <div className="mt-2 text-xs font-bold">
              Total: {previewTotals.count.toLocaleString("pt-BR")} registros · {money(previewTotals.total)}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="font-bold">Compatível com:</span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1">
                <ShieldCheck className="h-3 w-3" /> Premier ERP
              </Badge>
            </div>
          </div>

          {/* 🥇 Opção principal: ZIP para Premier ERP */}
          <div className="rounded-lg border-2 border-primary/60 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 gap-1 text-[10px] font-black uppercase">
                ⭐ Recomendado
              </Badge>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Migração completa
              </span>
            </div>
            <Button
              size="lg"
              disabled={busy !== null || selected.size === 0}
              onClick={() => doExport("zip")}
              title="Este é o formato recomendado para migrar dados para o Premier ERP."
              className="w-full gap-2 font-bold"
            >
              {busy === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Exportar para Premier ERP (.zip)
            </Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Recomendado para migração completa para o Premier ERP. Inclui todos os módulos selecionados,
              manifest, README, diagnósticos e estrutura pronta para importação.
            </p>
          </div>

          {/* 🥈 Opção secundária: Excel individual */}
          <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Exportação individual
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || selected.size === 0}
              onClick={() => doExport("xlsx")}
              className="gap-1.5"
            >
              {busy === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              Baixar Excel
            </Button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Exporta apenas estes módulos em formato Excel para auditoria, conferência ou integração manual.
              Não é o formato recomendado para migração ao Premier ERP.
            </p>
          </div>

          {lastResult && (
            <div className="rounded-md bg-muted/30 border-dashed border text-xs p-2">
              Exportado: <span className="font-mono">{lastResult.filename}</span> · {(lastResult.bytes / 1024).toFixed(1)} KB · {(lastResult.durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </CardContent>
      </Card>


      {/* Diagnóstico (reorganizado, colapsado) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Diagnóstico da base financeira
          </CardTitle>
          <Button size="sm" variant="outline" onClick={runDiagnostic} disabled={checking} className="gap-1.5">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {report ? "Reverificar" : "Executar diagnóstico"}
          </Button>
        </CardHeader>
        <CardContent>
          {!report ? (
            <p className="text-xs text-muted-foreground">
              Detecta contas órfãs, pagamentos órfãos, duplicidades, valores negativos e inconsistências.
              Não é necessário para exportar — use para conferir a saúde da base antes da migração.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                {report.issues.map((issue) => (
                  <div
                    key={issue.tipo}
                    className={`flex items-center justify-between text-xs rounded-md border px-2 py-1.5 ${SEV_COLOR[issue.severidade]}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold">{issue.severidade}</Badge>
                      <span>{issue.tipo}</span>
                    </div>
                    <span className="font-black tabular-nums">{issue.quantidade.toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
              {report.warnings.length > 0 && (
                <div className="text-[11px] text-muted-foreground">Avisos: {report.warnings.join(" · ")}</div>
              )}
              {report.amostra.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Ver amostra de inconsistências ({report.amostra.length})
                  </summary>
                  <pre className="mt-2 p-2 bg-muted/40 rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(report.amostra, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
