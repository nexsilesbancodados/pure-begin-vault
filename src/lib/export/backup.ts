// Backup Completo — gera um ZIP com todos os datasets da empresa.
// SOMENTE LEITURA: não altera tabela, RLS ou regra de negócio.
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { DATASETS, DatasetDef, ExportGroup } from "./registry";
import { fetchDataset } from "./fetcher";
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

async function fetchOrgInfo(orgId: string | null) {
  if (!orgId) return { organization: null, settings: null };
  const [{ data: organization }, { data: settings }] = await Promise.all([
    (supabase as any).from("organizations").select("*").eq("id", orgId).maybeSingle(),
    (supabase as any).from("organization_settings").select("*").eq("organization_id", orgId).maybeSingle(),
  ]);
  return { organization, settings };
}

export async function generateBackupZip(
  orgId: string | null,
  onProgress?: (p: BackupProgress) => void,
): Promise<BackupResult> {
  const t0 = performance.now();
  const zip = new JSZip();
  const perTable: Record<string, number> = {};
  const warnings: string[] = [];
  let totalRows = 0;

  // 1) empresa.json + configuracoes.json
  const { organization, settings } = await fetchOrgInfo(orgId);
  zip.file("empresa.json", JSON.stringify(organization ?? {}, null, 2));
  zip.file("configuracoes.json", JSON.stringify(settings ?? {}, null, 2));

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
      const res = await fetchDataset(ds, orgId);
      const folder = GROUP_FOLDER[ds.group] ?? ds.group;
      const csv = rowsToCsv(res.rows, res.columns);
      zip.file(`${folder}/${ds.key}.csv`, csv);
      perTable[ds.table] = res.count;
      totalRows += res.count;
      if (res.warnings.length) warnings.push(...res.warnings.map((w) => `${ds.key}: ${w}`));
    } catch (e: any) {
      warnings.push(`${ds.key}: ${e?.message ?? e}`);
      perTable[ds.table] = 0;
    }
  }

  // 3) manifest.json
  const durationMs = Math.round(performance.now() - t0);
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
  const manifest = {
    schema_version: "1.1",
    sistema_origem: "Conecta Sistema",
    versao_sistema: (import.meta as any).env?.VITE_APP_VERSION ?? "conecta-1.0",
    versao_banco: "supabase-postgres-15",
    empresa_nome: organization?.name ?? organization?.nome ?? null,
    empresa_id: orgId,
    exportado_em: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    encoding: "UTF-8 (com BOM nos CSVs)",
    separador_csv: ";",
    modulos_exportados: modulosExportados,
    total_registros: totalRows,
    registros_por_tabela: perTable,
    tempo_total_ms: durationMs,
    avisos: warnings,
    observacoes:
      "Backup somente-leitura gerado pela Central de Exportação. Nenhum dado do sistema foi alterado.",
  };
  // 3b) RELATORIO_COMPATIBILIDADE.md — auditoria da exportação
  const compatMd = [
    "# Relatório de Compatibilidade — Backup Conecta",
    "",
    `- Gerado em: ${manifest.exportado_em}`,
    `- Empresa: ${manifest.empresa_nome ?? "-"} (${orgId ?? "-"})`,
    `- Schema: ${manifest.schema_version} · Sistema: ${manifest.sistema_origem} ${manifest.versao_sistema}`,
    `- Encoding: ${manifest.encoding} · Separador CSV: "${manifest.separador_csv}"`,
    "",
    "## Módulos exportados",
    ...modulosExportados.map((m) => `- **${m.modulo}** (${m.pasta}) — ${m.tabelas.length} tabelas`),
    "",
    "## Registros por tabela",
    ...Object.entries(perTable).map(([t, n]) => `- ${t}: ${n.toLocaleString("pt-BR")}`),
    "",
    "## Limitações conhecidas",
    "- Anexos binários (fotos de OS, PDFs) não são incluídos neste backup.",
    "- Logs de automação e webhooks históricos são omitidos por volume.",
    "",
    "## Recomendações",
    "- Validar `manifest.json` antes da importação em outro ERP.",
    "- Preservar os IDs originais para reconstrução de relacionamentos.",
    warnings.length ? `\n## Avisos\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
  ].join("\n");
  zip.file("RELATORIO_COMPATIBILIDADE.md", compatMd);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
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
    durationMs,
    perTable,
    warnings,
  };
}
