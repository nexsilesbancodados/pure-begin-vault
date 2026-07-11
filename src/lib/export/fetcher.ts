// Paginated dataset fetcher — sempre escopado por organization_id.
// Fase 1: leitura direta com supabase-js (RLS ainda protege), batches de 1000.
import { supabase } from "@/integrations/supabase/client";
import { DatasetDef } from "./registry";

export interface ExportFilters {
  periodStart?: string; // ISO
  periodEnd?: string;   // ISO
  status?: string;      // filtro em statusColumn
  extra?: Record<string, string | number | null>;
}

export interface FetchResult {
  rows: any[];
  columns: string[];
  count: number;
  durationMs: number;
  warnings: string[];
}

const PAGE = 1000;

export async function countDataset(
  ds: DatasetDef,
  orgId: string | null,
  filters: ExportFilters = {},
): Promise<number> {
  let q: any = (supabase as any).from(ds.table).select("*", { count: "exact", head: true });
  if (ds.orgColumn && orgId) q = q.eq(ds.orgColumn, orgId);
  if (filters.periodStart && ds.dateColumn) q = q.gte(ds.dateColumn, filters.periodStart);
  if (filters.periodEnd && ds.dateColumn) q = q.lte(ds.dateColumn, filters.periodEnd);
  if (filters.status && ds.statusColumn) q = q.eq(ds.statusColumn, filters.status);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

export async function fetchDataset(
  ds: DatasetDef,
  orgId: string | null,
  filters: ExportFilters = {},
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<FetchResult> {
  const t0 = performance.now();
  const warnings: string[] = [];

  const buildQuery = (rangeStart: number, rangeEnd: number) => {
    let q: any = (supabase as any).from(ds.table).select("*", { count: "exact" });
    if (ds.orgColumn && orgId) q = q.eq(ds.orgColumn, orgId);
    if (filters.periodStart && ds.dateColumn) q = q.gte(ds.dateColumn, filters.periodStart);
    if (filters.periodEnd && ds.dateColumn) q = q.lte(ds.dateColumn, filters.periodEnd);
    if (filters.status && ds.statusColumn) q = q.eq(ds.statusColumn, filters.status);
    if (filters.extra) {
      for (const [k, v] of Object.entries(filters.extra)) {
        if (v == null || v === "") continue;
        q = q.eq(k, v);
      }
    }
    return q.range(rangeStart, rangeEnd);
  };

  const rows: any[] = [];
  let from = 0;
  let total: number | null = null;
  let safety = 0;
  while (safety++ < 5000) {
    const to = from + PAGE - 1;
    const { data, error, count } = await buildQuery(from, to);
    if (error) {
      warnings.push(`Erro ao buscar página ${from}: ${error.message}`);
      break;
    }
    if (total === null && typeof count === "number") total = count;
    const batch = (data ?? []) as any[];
    rows.push(...batch);
    onProgress?.(rows.length, total);
    if (batch.length < PAGE) break;
    from += PAGE;
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];
  return {
    rows,
    columns,
    count: rows.length,
    durationMs: Math.round(performance.now() - t0),
    warnings,
  };
}

// Busca linhas cujo `column` está em `ids`, com chunking para não estourar
// o limite de URL do PostgREST. Usado no export parent-driven.
export async function fetchDatasetIn(
  ds: DatasetDef,
  orgId: string | null,
  column: string,
  ids: string[],
  filters: ExportFilters = {},
  chunkSize = 400,
): Promise<FetchResult> {
  const t0 = performance.now();
  const warnings: string[] = [];
  const rows: any[] = [];

  if (!ids.length) {
    return { rows, columns: [], count: 0, durationMs: 0, warnings };
  }

  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const slice = uniq.slice(i, i + chunkSize);
    let q: any = (supabase as any).from(ds.table).select("*");
    if (ds.orgColumn && orgId) q = q.eq(ds.orgColumn, orgId);
    if (filters.periodStart && ds.dateColumn) q = q.gte(ds.dateColumn, filters.periodStart);
    if (filters.periodEnd && ds.dateColumn) q = q.lte(ds.dateColumn, filters.periodEnd);
    if (filters.status && ds.statusColumn) q = q.eq(ds.statusColumn, filters.status);
    q = q.in(column, slice);
    // paginação interna por chunk (raramente >1000 linhas por 400 ids, mas seguro)
    let from = 0;
    while (from < 100000) {
      const to = from + PAGE - 1;
      const { data, error } = await q.range(from, to);
      if (error) {
        warnings.push(`Erro IN ${ds.table}[${column}] chunk ${i}: ${error.message}`);
        break;
      }
      const batch = (data ?? []) as any[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];
  return {
    rows,
    columns,
    count: rows.length,
    durationMs: Math.round(performance.now() - t0),
    warnings,
  };
}
