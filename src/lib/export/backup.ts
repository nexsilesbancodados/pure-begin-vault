// Backup Completo — gera um ZIP com todos os datasets da empresa.
// SOMENTE LEITURA: não altera tabela, RLS ou regra de negócio.
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { DATASETS, DatasetDef, ExportGroup, isTransactionalDataset } from "./registry";
import { fetchDataset, ExportFilters } from "./fetcher";
import { rowsToCsv } from "./csv";

// Mapeia grupos → pastas no ZIP (nomes em pt-BR conforme spec)
const GROUP_FOLDER: Record<ExportGroup, string> = {
  cadastros: "cadastros",
  estoque: "estoque",
  vendas: "vendas",
  compras: "compras",
  financeiro: "financeiro",
  crm: "crm",
  servicos: "servicos",
  sistema: "usuarios",
};

export interface BackupProgress {
  currentDataset: string;
  currentIndex: number;
  totalDatasets: number;
  rowsSoFar: number;
}

export interface BackupResult {
  filename: string;
  bytes: number;
  totalRows: number;
  durationMs: number;
  perTable: Record<string, number>;
  warnings: string[];
}

export interface BackupPeriod {
  from: string | null; // ISO or null
  to: string | null;   // ISO or null
}

interface BackupFile {
  path: string;
  content: string;
}

interface DatasetExportMeta {
  key: string;
  label: string;
  table: string;
  group: ExportGroup;
  folder: string;
  file: string;
  records: number;
  columns: number;
  dateColumn: string | null;
  firstDate: string | null;
  lastDate: string | null;
  warnings: string[];
}

type JsonObject = Record<string, unknown>;

interface SupabaseReadBuilder {
  select: (columns: string) => SupabaseReadBuilder;
  eq: (column: string, value: unknown) => SupabaseReadBuilder;
  maybeSingle: () => Promise<{ data: JsonObject | null }>;
}

interface ModuleExportInfo {
  modulo: ExportGroup;
  pasta: string;
  tabelas: Array<{
    key: string;
    tabela: string;
    arquivo: string;
    registros: number;
  }>;
}

interface CompatibilityManifest {
  exportado_em: string;
  empresa_nome: string | null;
  empresa_id: string | null;
  schema_version: string;
  sistema_origem: string;
  versao_sistema: string;
  encoding: string;
  separador_csv: string;
  duration_ms: number;
  total_files: number;
  total_records: number;
  total_modules: number;
  registros_por_tabela: Record<string, number>;
}

const BACKUP_FORMAT_VERSION = "3.1";
const BACKUP_SCHEMA_VERSION = "1.1";
const COMPATIBILITY = {
  minimum_version: "1.0.0",
  maximum_validated_version: "3.1.0",
  level: "full",
};
const COMPATIBLE_WITH = {
  premier: ">=1.0.0",
  conecta_backup: ">=1.0.0 <=3.1.0",
};

async function fetchOrgInfo(orgId: string | null) {
  if (!orgId) return { organization: null, settings: null };
  const db = supabase as unknown as { from: (table: string) => SupabaseReadBuilder };
  const [{ data: organization }, { data: settings }] = await Promise.all([
    db.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    db.from("organization_settings").select("*").eq("organization_id", orgId).maybeSingle(),
  ]);
  return { organization, settings };
}

function getAppVersion() {
  return import.meta.env.VITE_APP_VERSION ?? "conecta-1.0";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getOrganizationName(organization: JsonObject | null) {
  const name = organization?.name ?? organization?.nome;
  return typeof name === "string" && name.trim() ? name : null;
}

function makeBackupUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `backup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback simples para ambientes sem Web Crypto; mantém integridade básica no dev.
  let hash = 0;
  for (const byte of bytes) hash = (hash * 31 + byte) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

async function checksumMap(files: BackupFile[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    files.map(async (file) => [file.path, await sha256(file.content)] as const),
  );
  return Object.fromEntries(entries);
}

async function checksumGlobal(checksums: Record<string, string>) {
  const canonical = Object.entries(checksums)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, hash]) => `${path}:${hash}`)
    .join("\n");
  return sha256(canonical);
}

function temporalBounds(
  rows: Array<Record<string, unknown>>,
  dateColumn?: string,
): { firstDate: string | null; lastDate: string | null } {
  if (!dateColumn) return { firstDate: null, lastDate: null };
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const raw = row[dateColumn];
    if (!raw) continue;
    const ts = Date.parse(String(raw));
    if (Number.isNaN(ts)) continue;
    first = Math.min(first, ts);
    last = Math.max(last, ts);
  }

  return {
    firstDate: Number.isFinite(first) ? new Date(first).toISOString() : null,
    lastDate: Number.isFinite(last) ? new Date(last).toISOString() : null,
  };
}

function moduleStats(metas: DatasetExportMeta[]) {
  return Array.from(new Set(metas.map((m) => m.group))).map((group) => {
    const datasets = metas.filter((m) => m.group === group);
    const dated = datasets.filter((m) => m.firstDate || m.lastDate);
    const firstDates = dated.map((m) => m.firstDate).filter(Boolean) as string[];
    const lastDates = dated.map((m) => m.lastDate).filter(Boolean) as string[];
    const firstDate = firstDates.length ? firstDates.sort()[0] : null;
    const lastDate = lastDates.length ? (lastDates.sort().at(-1) ?? null) : null;

    return {
      modulo: group,
      pasta: GROUP_FOLDER[group] ?? group,
      quantidade: datasets.reduce((sum, item) => sum + item.records, 0),
      tabelas: datasets.length,
      arquivos: datasets.map((item) => item.file),
      primeira_data: firstDate,
      ultima_data: lastDate,
      periodo_coberto: firstDate || lastDate ? { inicio: firstDate, fim: lastDate } : null,
    };
  });
}

function toJson(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function buildReadme(params: {
  organization: JsonObject | null;
  orgId: string | null;
  exportedAt: string;
  totalRows: number;
  totalModules: number;
  totalFiles: number;
  modulosExportados: ModuleExportInfo[];
  warnings: string[];
  period: BackupPeriod;
  hasPeriod: boolean;
}) {
  const companyName = getOrganizationName(params.organization) ?? "Empresa não identificada";
  return [
    "# Backup Conecta Sistema",
    "",
    "## Identificação",
    `- Empresa: ${companyName}`,
    `- ID da empresa: ${params.orgId ?? "-"}`,
    "- Sistema de origem: Conecta Sistema",
    `- Versão do sistema: ${getAppVersion()}`,
    `- Versão do backup: ${BACKUP_FORMAT_VERSION}`,
    `- Data da exportação: ${new Date(params.exportedAt).toLocaleDateString("pt-BR")}`,
    `- Data/hora: ${params.exportedAt}`,
    `- Total de registros: ${params.totalRows.toLocaleString("pt-BR")}`,
    `- Total de módulos exportados: ${params.totalModules}`,
    `- Total de arquivos: ${params.totalFiles}`,
    "",
    "## Período Exportado",
    "- Cadastros: Completo",
    params.hasPeriod
      ? `- Transações: ${(params.period.from ?? "início").slice(0, 10)} até ${(params.period.to ?? "hoje").slice(0, 10)}`
      : "- Transações: Todo o período (sem filtro aplicado)",
    "",
    "## Estrutura do ZIP",
    "- empresa.json — dados cadastrais da empresa.",
    "- configuracoes.json — configurações da empresa.",
    "- manifest.json — metadados técnicos, checksums e estatísticas do backup.",
    "- README.md — este guia de leitura do backup.",
    "- RELATORIO_COMPATIBILIDADE.md — relatório resumido para auditoria e migração.",
    "- diagnostico/ — arquivos informativos de saúde, tabelas vazias, avisos e resumo.",
    ...params.modulosExportados.map(
      (m) => `- ${m.pasta}/ — ${m.tabelas.length} arquivo(s) CSV do módulo ${m.modulo}.`,
    ),
    "",
    "## Como restaurar/importar",
    "1. Leia o manifest.json para identificar módulos, tabelas, registros e checksums.",
    "2. Valide a integridade comparando os hashes SHA-256 listados em checksums.",
    "3. Importe primeiro cadastros e usuários, depois estoque, vendas, compras, financeiro, CRM e serviços.",
    "4. Preserve os IDs originais sempre que o sistema de destino permitir, pois eles reconectam históricos e relacionamentos.",
    "5. Use os arquivos em diagnostico/ para revisar avisos e tabelas sem registros antes da migração.",
    "",
    "## Compatibilidade",
    `- Premier ERP: ${COMPATIBLE_WITH.premier}`,
    `- Nível de compatibilidade: ${COMPATIBILITY.level}`,
    `- Versão mínima compatível: ${COMPATIBILITY.minimum_version}`,
    `- Versão máxima validada: ${COMPATIBILITY.maximum_validated_version}`,
    "",
    "## Observações",
    "- Backup gerado em modo somente leitura; nenhum dado do sistema foi alterado.",
    "- CSVs permanecem em UTF-8 com BOM e separador ponto e vírgula (;).",
    "- Campos e estrutura existentes foram preservados para manter compatibilidade com versões anteriores.",
    params.warnings.length
      ? `- Avisos encontrados: ${params.warnings.length}. Consulte diagnostico/warnings.json.`
      : "- Nenhum aviso encontrado durante a exportação.",
    "",
  ].join("\n");
}

function buildCompatibilityReport(params: {
  manifest: CompatibilityManifest;
  moduleStatistics: ReturnType<typeof moduleStats>;
  warnings: string[];
  zipBytes: number | null;
}) {
  const zipSize =
    params.zipBytes == null ? "calculando" : `${(params.zipBytes / 1024 / 1024).toFixed(2)} MB`;
  return [
    "# Relatório de Compatibilidade — Backup Conecta",
    "",
    `- Gerado em: ${params.manifest.exportado_em}`,
    `- Empresa: ${params.manifest.empresa_nome ?? "-"} (${params.manifest.empresa_id ?? "-"})`,
    `- Schema: ${params.manifest.schema_version} · Sistema: ${params.manifest.sistema_origem} ${params.manifest.versao_sistema}`,
    `- Encoding: ${params.manifest.encoding} · Separador CSV: "${params.manifest.separador_csv}"`,
    `- Tempo total: ${(params.manifest.duration_ms / 1000).toFixed(1)}s`,
    `- Tamanho final do ZIP: ${zipSize}`,
    `- Quantidade de arquivos: ${params.manifest.total_files}`,
    `- Quantidade de registros: ${params.manifest.total_records.toLocaleString("pt-BR")}`,
    `- Módulos exportados: ${params.manifest.total_modules}`,
    `- Avisos encontrados: ${params.warnings.length}`,
    "",
    "## Módulos exportados",
    ...params.moduleStatistics.map(
      (m) =>
        `- **${m.modulo}** (${m.pasta}) — ${m.tabelas} tabela(s), ${m.quantidade.toLocaleString("pt-BR")} registro(s)${m.periodo_coberto ? `, período ${m.periodo_coberto.inicio ?? "-"} a ${m.periodo_coberto.fim ?? "-"}` : ""}`,
    ),
    "",
    "## Registros por tabela",
    ...Object.entries(params.manifest.registros_por_tabela).map(
      ([t, n]) => `- ${t}: ${Number(n).toLocaleString("pt-BR")}`,
    ),
    "",
    "## Limitações conhecidas",
    "- Anexos binários (fotos de OS, PDFs) não são incluídos neste backup.",
    "- Logs de automação e webhooks históricos são omitidos por volume.",
    "",
    "## Recomendações",
    "- Validar `manifest.json` antes da importação em outro ERP.",
    "- Conferir `checksum_global` e os hashes individuais antes de iniciar migração.",
    "- Preservar os IDs originais para reconstrução de relacionamentos.",
    params.warnings.length ? `\n## Avisos\n${params.warnings.map((w) => `- ${w}`).join("\n")}` : "",
  ].join("\n");
}

export async function generateBackupZip(
  orgId: string | null,
  onProgress?: (p: BackupProgress) => void,
  period?: BackupPeriod | null,
): Promise<BackupResult> {
  const t0 = performance.now();
  const backupUuid = makeBackupUuid();
  const exportedAt = new Date().toISOString();
  const files: BackupFile[] = [];
  const perTable: Record<string, number> = {};
  const warnings: string[] = [];
  const metas: DatasetExportMeta[] = [];
  let totalRows = 0;

  const normalizedPeriod: BackupPeriod = {
    from: period?.from || null,
    to: period?.to || null,
  };
  const hasPeriod = !!(normalizedPeriod.from || normalizedPeriod.to);

  const addFile = (path: string, content: string) => {
    files.push({ path, content });
  };

  // 1) empresa.json + configuracoes.json
  const { organization, settings } = await fetchOrgInfo(orgId);
  addFile("empresa.json", toJson(organization ?? {}));
  addFile("configuracoes.json", toJson(settings ?? {}));

  // 2) Datasets → CSV por grupo/pasta
  for (let i = 0; i < DATASETS.length; i++) {
    const ds: DatasetDef = DATASETS[i];
    onProgress?.({
      currentDataset: ds.label,
      currentIndex: i + 1,
      totalDatasets: DATASETS.length,
      rowsSoFar: totalRows,
    });
    try {
      // Cadastros/sistema sempre completos. Transacionais respeitam o período.
      const filters: ExportFilters = {};
      if (hasPeriod && isTransactionalDataset(ds)) {
        if (normalizedPeriod.from) filters.periodStart = normalizedPeriod.from;
        if (normalizedPeriod.to) filters.periodEnd = normalizedPeriod.to;
      }
      const res = await fetchDataset(ds, orgId, filters);
      const folder = GROUP_FOLDER[ds.group] ?? ds.group;
      const csv = rowsToCsv(res.rows, res.columns);
      const file = `${folder}/${ds.key}.csv`;
      const bounds = temporalBounds(res.rows, ds.dateColumn);
      addFile(file, csv);
      perTable[ds.table] = res.count;
      totalRows += res.count;
      if (res.warnings.length) {
        warnings.push(...res.warnings.map((w) => `${ds.key}: ${w}`));
      }
      metas.push({
        key: ds.key,
        label: ds.label,
        table: ds.table,
        group: ds.group,
        folder,
        file,
        records: res.count,
        columns: res.columns.length,
        dateColumn: ds.dateColumn ?? null,
        firstDate: bounds.firstDate,
        lastDate: bounds.lastDate,
        warnings: res.warnings,
      });
    } catch (e: unknown) {
      const message = `${ds.key}: ${getErrorMessage(e)}`;
      warnings.push(message);
      perTable[ds.table] = 0;
      metas.push({
        key: ds.key,
        label: ds.label,
        table: ds.table,
        group: ds.group,
        folder: GROUP_FOLDER[ds.group] ?? ds.group,
        file: `${GROUP_FOLDER[ds.group] ?? ds.group}/${ds.key}.csv`,
        records: 0,
        columns: 0,
        dateColumn: ds.dateColumn ?? null,
        firstDate: null,
        lastDate: null,
        warnings: [message],
      });
    }
  }

  // 3) Metadados, README e diagnóstico — aproveitam apenas dados já carregados.
  const modulosExportados = Array.from(new Set(DATASETS.map((d) => d.group))).map((g) => ({
    modulo: g,
    pasta: GROUP_FOLDER[g] ?? g,
    tabelas: DATASETS.filter((d) => d.group === g).map((d) => ({
      key: d.key,
      tabela: d.table,
      arquivo: `${GROUP_FOLDER[d.group] ?? d.group}/${d.key}.csv`,
      registros: perTable[d.table] ?? 0,
    })),
  }));
  const moduleStatistics = moduleStats(metas);
  const totalModules = modulosExportados.length;

  addFile(
    "diagnostico/database-health.json",
    toJson({
      generated_at: exportedAt,
      status: warnings.length ? "warning" : "ok",
      total_tables: metas.length,
      total_records: totalRows,
      tables: metas.map((m) => ({
        key: m.key,
        label: m.label,
        table: m.table,
        file: m.file,
        records: m.records,
        columns: m.columns,
        first_date: m.firstDate,
        last_date: m.lastDate,
        status: m.warnings.length ? "warning" : "ok",
      })),
    }),
  );
  addFile(
    "diagnostico/empty-tables.json",
    toJson({
      generated_at: exportedAt,
      total_empty_tables: metas.filter((m) => m.records === 0).length,
      tables: metas
        .filter((m) => m.records === 0)
        .map((m) => ({ key: m.key, label: m.label, table: m.table, file: m.file })),
    }),
  );
  addFile(
    "diagnostico/warnings.json",
    toJson({
      generated_at: exportedAt,
      total_warnings: warnings.length,
      warnings,
      by_dataset: metas
        .filter((m) => m.warnings.length > 0)
        .map((m) => ({ key: m.key, table: m.table, warnings: m.warnings })),
    }),
  );
  addFile(
    "diagnostico/export-summary.json",
    toJson({
      backup_uuid: backupUuid,
      generated_at: exportedAt,
      system_origin: "Conecta Sistema",
      total_records: totalRows,
      total_modules: totalModules,
      total_tables: metas.length,
      modules: moduleStatistics,
      records_by_table: perTable,
      compatibility: COMPATIBILITY,
      compatible_with: COMPATIBLE_WITH,
    }),
  );

  // README entra antes do manifest para também participar dos checksums.
  addFile(
    "README.md",
    buildReadme({
      organization,
      orgId,
      exportedAt,
      totalRows,
      totalModules,
      totalFiles: files.length + 3, // + README já em criação, manifest e relatório.
      modulosExportados,
      warnings,
      period: normalizedPeriod,
      hasPeriod,
    }),
  );

  const checksums = await checksumMap(files);
  const checksum_global = await checksumGlobal(checksums);

  const buildManifest = (durationMs: number) => ({
    backup_uuid: backupUuid,
    checksum_global,
    generated_by: "Central de Exportação de Dados",
    generated_at: exportedAt,
    duration_ms: durationMs,
    version: BACKUP_FORMAT_VERSION,
    schema_version: BACKUP_SCHEMA_VERSION,
    sistema_origem: "Conecta Sistema",
    versao_sistema: getAppVersion(),
    versao_banco: "supabase-postgres-15",
    empresa_nome: getOrganizationName(organization),
    empresa_id: orgId,
    exportado_em: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    encoding: "UTF-8 (com BOM nos CSVs)",
    separador_csv: ";",
    compatible_with: COMPATIBLE_WITH,
    compatibilidade: COMPATIBILITY,
    modulos_exportados: modulosExportados,
    total_registros: totalRows,
    total_records: totalRows,
    total_files: files.length + 2, // arquivos base + manifest + relatório.
    total_modules: totalModules,
    registros_por_tabela: perTable,
    estatisticas_por_modulo: moduleStatistics,
    checksums,
    tempo_total_ms: durationMs,
    avisos: warnings,
    observacoes:
      "Backup somente-leitura gerado pela Central de Exportação. Nenhum dado do sistema foi alterado.",
  });

  const buildZip = (zipBytes: number | null) => {
    const durationMs = Math.round(performance.now() - t0);
    const manifest = buildManifest(durationMs);
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.content);
    zip.file(
      "RELATORIO_COMPATIBILIDADE.md",
      buildCompatibilityReport({ manifest, moduleStatistics, warnings, zipBytes }),
    );
    zip.file("manifest.json", toJson(manifest));
    return zip;
  };

  let zipBytes: number | null = null;
  let blob: Blob | null = null;
  for (let pass = 0; pass < 3; pass++) {
    blob = await buildZip(zipBytes).generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    if (blob.size === zipBytes) break;
    zipBytes = blob.size;
  }

  if (!blob) throw new Error("Falha ao gerar o arquivo ZIP.");
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `Premier-Backup-${stamp}.zip`;

  // download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    filename,
    bytes: blob.size,
    totalRows,
    durationMs: Math.round(performance.now() - t0),
    perTable,
    warnings,
  };
}
