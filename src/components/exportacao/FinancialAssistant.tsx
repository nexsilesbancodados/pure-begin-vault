// Sprint 3.3+ — Assistente de Migração Financeira (UX nível ERP)
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  FINANCIAL_MODULE_LABELS,
  FINANCIAL_TRANSACTIONAL,
  MODULE_TO_TABLES,
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

const SAFE_MODULE_LABELS: Record<FinancialModuleKey, string> = FINANCIAL_MODULE_LABELS ?? {
  accounts_payable: "Contas a pagar",
  accounts_receivable: "Contas a receber",
  finance_transactions: "Movimentações financeiras",
  bank_accounts: "Bancos",
  cash_register: "Caixas",
  financial_categories: "Categorias financeiras",
  chart_of_accounts: "Plano de contas",
  cost_centers: "Centros de custo",
};

const SAFE_TRANSACTIONAL: FinancialModuleKey[] = Array.isArray(FINANCIAL_TRANSACTIONAL)
  ? FINANCIAL_TRANSACTIONAL
  : ["accounts_payable", "accounts_receivable", "finance_transactions"];

const SAFE_MODULE_TO_TABLES: Record<FinancialModuleKey, string[]> = MODULE_TO_TABLES ?? {
  accounts_payable: ["accounts_payable"],
  accounts_receivable: ["accounts_receivable"],
  finance_transactions: ["finance_transactions"],
  bank_accounts: ["bank_accounts"],
  cash_register: ["cash_register_sessions", "cash_register_movements"],
  financial_categories: ["chart_of_accounts"],
  chart_of_accounts: ["chart_of_accounts"],
  cost_centers: ["cost_centers"],
};

const STATUS_LABEL: Record<FinancialStatusFilter, string> = {
  all: "Todas",
  open: "Em aberto",
  paid: "Pagas",
  overdue: "Vencidas",
};

type Preset = "hoje" | "30d" | "90d" | "ano" | "custom";
const PRESET_LABEL: Record<Preset, string> = {
  hoje: "Hoje",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  custom: "Personalizado",
};

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

const money = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return iso; }
};
const fmtDateTime = (iso: string) => {
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
};

// Estimativas simples (heurística: ~450 bytes/registro em CSV, ~1200 em xlsx)
function estimateBytes(count: number, format: "xlsx" | "zip") {
  return count * (format === "xlsx" ? 1200 : 450);
}
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function estimateSeconds(count: number) {
  // ~800 registros/segundo processando + rede
  return Math.max(2, Math.round(count / 800));
}
function fmtSeconds(s: number) {
  if (s < 60) return `~${s} segundos`;
  const m = Math.floor(s / 60), r = s % 60;
  return `~${m}m${r ? ` ${r}s` : ""}`;
}

// Persistência local
const LS_FILTERS = "lvc:fin-assistant:filters:v1";
const LS_HISTORY = "lvc:fin-assistant:history:v1";

type HistoryItem = {
  at: string;
  user: string;
  module: string;
  count: number;
  format: "ZIP" | "Excel" | "CSV";
  filename: string;
};

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch { return []; }
}
function pushHistory(item: HistoryItem) {
  if (typeof window === "undefined") return [];
  try {
    const list = [item, ...loadHistory()].slice(0, 10);
    localStorage.setItem(LS_HISTORY, JSON.stringify(list));
    return list;
  } catch { return loadHistory(); }
}

type PersistedState = {
  selected: FinancialModuleKey[];
  filters: Partial<Record<FinancialModuleKey, ModuleFilter>>;
  presets: Partial<Record<FinancialModuleKey, Preset>>;
};
function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_FILTERS);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.selected)) return null;
    return p;
  } catch { return null; }
}

export function FinancialAssistant({ orgId }: { orgId: string | null }) {
  const persisted = useRef<PersistedState | null>(null);
  if (persisted.current === null) persisted.current = loadPersisted();

  const [selected, setSelected] = useState<Set<FinancialModuleKey>>(
    () => new Set(persisted.current?.selected ?? ["accounts_payable"]),
  );
  const [filters, setFilters] = useState<Partial<Record<FinancialModuleKey, ModuleFilter>>>(
    () => persisted.current?.filters ?? {
      accounts_payable: { status: "open", dateField: "due_date" },
      accounts_receivable: { status: "open", dateField: "due_date" },
      finance_transactions: { dateField: "transaction_date" },
    },
  );
  const [presets, setPresets] = useState<Partial<Record<FinancialModuleKey, Preset>>>(
    () => persisted.current?.presets ?? {},
  );
  const [summaries, setSummaries] = useState<Partial<Record<FinancialModuleKey, { count: number; totalAmount: number; loading?: boolean }>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FinancialAssistantResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [userLabel, setUserLabel] = useState<string>("—");

  // Diagnóstico
  const [report, setReport] = useState<FinancialIntegrityReport | null>(null);
  const [checking, setChecking] = useState(false);

  // Carrega nome do usuário para histórico
  useEffect(() => {
    (async () => {
      try {
        const res = await supabase.auth.getUser();
        const u: any = res?.data?.user;
        setUserLabel(u?.user_metadata?.full_name || u?.email || "usuário");
      } catch { /* ignore */ }
    })();
  }, []);

  // Persiste seleção/filtros
  useEffect(() => {
    try {
      localStorage.setItem(LS_FILTERS, JSON.stringify({
        selected: [...selected],
        filters,
        presets,
      } satisfies PersistedState));
    } catch { /* ignore */ }
  }, [selected, filters, presets]);

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
    if (preset === "custom") return;
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

  useEffect(() => {
    if (!orgId) return;
    for (const key of SAFE_TRANSACTIONAL) {
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
      const totalCount = (result.modules ?? []).reduce((s, m) => s + (m?.count ?? 0), 0);
      const moduleLabel = [...selected].map((k) => SAFE_MODULE_LABELS[k] ?? k).join(", ");
      setHistory(pushHistory({
        at: new Date().toISOString(),
        user: userLabel,
        module: moduleLabel,
        count: totalCount,
        format: format === "zip" ? "ZIP" : "Excel",
        filename: result.filename,
      }));
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
      if (s) { count += s.count ?? 0; total += s.totalAmount ?? 0; }
    }
    return { count, total };
  }, [selected, summaries]);

  const filesInBackup = useMemo(() => {
    const set = new Set<string>();
    for (const k of selected) {
      for (const t of (SAFE_MODULE_TO_TABLES[k] ?? [])) set.add(`${t}.csv`);
    }
    return [...set];
  }, [selected]);

  const zipEstimate = estimateBytes(previewTotals.count, "zip");
  const xlsxEstimate = estimateBytes(previewTotals.count, "xlsx");
  const timeEstimate = estimateSeconds(previewTotals.count);
  const isLarge = previewTotals.count > 5000 || zipEstimate > 10 * 1024 * 1024;

  // Integridade resumida (contagens agregadas simples)
  const integritySummary = useMemo(() => {
    if (!report) return null;
    const issues = report.issues ?? [];
    const ok: string[] = [];
    const warn: Array<{ label: string; count: number; sev: string }> = [];
    for (const i of issues) {
      if ((i.quantidade ?? 0) === 0) ok.push(i.tipo);
      else warn.push({ label: i.tipo, count: i.quantidade, sev: i.severidade });
    }
    return { ok, warn };
  }, [report]);

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
                    {SAFE_MODULE_LABELS[k] ?? k}
                  </div>
                  <div className="text-xl font-black">
                    {s?.loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (s?.count ?? 0).toLocaleString("pt-BR")}
                  </div>
                  {SAFE_TRANSACTIONAL.includes(k) && (
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
                <span className="text-sm font-medium">{SAFE_MODULE_LABELS[k] ?? k}</span>
                {SAFE_TRANSACTIONAL.includes(k) && (
                  <Badge variant="outline" className="ml-auto text-[9px]">filtros</Badge>
                )}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros específicos para módulos transacionais */}
      {SAFE_TRANSACTIONAL.filter((k) => selected.has(k)).map((k) => {
        const f = filters[k] ?? {};
        const s = summaries[k];
        const dateFields = MODULE_DATE_FIELDS[k] ?? [];
        const currentPreset = presets[k] ?? "custom";
        const range = currentPreset !== "custom" ? presetRange(currentPreset) : { start: f.periodStart, end: f.periodEnd };
        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="text-sm">Filtros — {SAFE_MODULE_LABELS[k] ?? k}</CardTitle>
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
                {dateFields.length > 0 && (
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
                )}
                <div>
                  <Label className="text-xs">Período</Label>
                  <Select
                    value={currentPreset}
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
                  <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                    {PRESET_LABEL[currentPreset]} · {fmtDate(range.start)} → {fmtDate(range.end)}
                  </div>
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
                <span><strong>Período:</strong> {fmtDate(f.periodStart)} até {fmtDate(f.periodEnd)}</span>
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
          {/* Resumo do que será exportado */}
          <div className="rounded-md border bg-primary/5 px-3 py-2 text-sm">
            <div className="font-bold">Serão exportados:</div>
            <ul className="text-xs mt-1 space-y-0.5">
              {[...selected].map((k) => {
                const s = summaries[k];
                return (
                  <li key={k}>
                    • {SAFE_MODULE_LABELS[k] ?? k} — {(s?.count ?? 0).toLocaleString("pt-BR")} registros
                    {SAFE_TRANSACTIONAL.includes(k) ? ` · ${money(s?.totalAmount ?? 0)}` : ""}
                  </li>
                );
              })}
              {selected.size === 0 && <li className="text-muted-foreground">Nenhum módulo selecionado.</li>}
            </ul>
            <div className="mt-2 text-xs font-bold">
              Total: {previewTotals.count.toLocaleString("pt-BR")} registros · {money(previewTotals.total)}
            </div>

            {/* Estimativas */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="rounded border bg-background/60 px-2 py-1.5">
                <div className="uppercase font-bold text-[9px] text-muted-foreground">Tamanho estimado (ZIP)</div>
                <div className="font-black">{fmtBytes(zipEstimate)}</div>
              </div>
              <div className="rounded border bg-background/60 px-2 py-1.5">
                <div className="uppercase font-bold text-[9px] text-muted-foreground">Tamanho estimado (Excel)</div>
                <div className="font-black">{fmtBytes(xlsxEstimate)}</div>
              </div>
              <div className="rounded border bg-background/60 px-2 py-1.5 flex flex-col">
                <div className="uppercase font-bold text-[9px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo estimado</div>
                <div className="font-black">{fmtSeconds(timeEstimate)}</div>
              </div>
            </div>

            {/* Aviso de exportação grande */}
            {isLarge && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Esta exportação pode levar alguns minutos para ser gerada. Você pode continuar usando o sistema durante o processo.</span>
              </div>
            )}

            {/* Conteúdo do ZIP */}
            {filesInBackup.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] uppercase font-bold text-muted-foreground mb-1">
                  <FileArchive className="h-3 w-3 inline mr-1" /> Este backup contém:
                </div>
                <ul className="text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {filesInBackup.map((f) => (
                    <li key={f} className="font-mono flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {f}
                    </li>
                  ))}
                  <li className="font-mono flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> manifest.json</li>
                  <li className="font-mono flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> README.md</li>
                  <li className="font-mono flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> checksums.txt</li>
                </ul>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="font-bold">Compatível com:</span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1">
                <ShieldCheck className="h-3 w-3" /> Premier ERP
              </Badge>
            </div>
          </div>

          {/* Integridade resumida (se já rodou o diagnóstico) */}
          {integritySummary && (
            <div className="rounded-md border px-3 py-2 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Integridade dos dados</div>
              {integritySummary.ok.map((label) => (
                <div key={label} className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {label}
                </div>
              ))}
              {integritySummary.warn.map((w) => (
                <div key={w.label} className={`flex items-center gap-1 ${w.sev === "alta" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                  <AlertTriangle className="h-3 w-3" /> {w.count.toLocaleString("pt-BR")} {w.label}
                </div>
              ))}
            </div>
          )}

          {/* Opção principal: ZIP */}
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
              Recomendado para migração completa. Inclui todos os módulos selecionados,
              manifest, README, diagnósticos e estrutura pronta para importação.
            </p>
          </div>

          {/* Opção secundária: Excel */}
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
              Exporta apenas os módulos selecionados em formato Excel para auditoria ou conferência.
            </p>
          </div>

          {lastResult && (
            <div className="rounded-md bg-muted/30 border-dashed border text-xs p-2">
              Exportado: <span className="font-mono">{lastResult.filename}</span> · {(lastResult.bytes / 1024).toFixed(1)} KB · {(lastResult.durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Últimas exportações
          </CardTitle>
          {history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(LS_HISTORY); setHistory([]); }}>
              Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma exportação registrada ainda.</p>
          ) : (
            <ul className="divide-y">
              {history.map((h, idx) => (
                <li key={idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{h.module}</div>
                    <div className="text-muted-foreground truncate">
                      {fmtDateTime(h.at)} · {h.user} · {h.count.toLocaleString("pt-BR")} registros
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">{h.format}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Diagnóstico */}
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
                {(report.issues ?? []).map((issue) => (
                  <div
                    key={issue.tipo}
                    className={`flex items-center justify-between text-xs rounded-md border px-2 py-1.5 ${SEV_COLOR[issue.severidade] ?? ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold">{issue.severidade}</Badge>
                      <span>{issue.tipo}</span>
                    </div>
                    <span className="font-black tabular-nums">{(issue.quantidade ?? 0).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
              {(report.warnings ?? []).length > 0 && (
                <div className="text-[11px] text-muted-foreground">Avisos: {report.warnings.join(" · ")}</div>
              )}
              {(report.amostra ?? []).length > 0 && (
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
