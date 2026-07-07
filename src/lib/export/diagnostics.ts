// Diagnóstico read-only: contagens, órfãos, duplicados, docs inválidos.
// NUNCA altera dados.
import { supabase } from "@/integrations/supabase/client";
import { DATASETS, DatasetDef } from "./registry";

export interface TableStat {
  key: string;
  label: string;
  table: string;
  count: number;
  columns: number;
  lastUpdated: string | null;
  error?: string;
}

export async function collectTableStats(orgId: string | null): Promise<TableStat[]> {
  const out: TableStat[] = [];
  for (const ds of DATASETS) {
    try {
      let q: any = (supabase as any).from(ds.table).select("*", { count: "exact", head: true });
      if (ds.orgColumn && orgId) q = q.eq(ds.orgColumn, orgId);
      const { count } = await q;

      // amostra 1 linha para inferir colunas + updated_at
      let sampleQ: any = (supabase as any).from(ds.table).select("*").limit(1);
      if (ds.orgColumn && orgId) sampleQ = sampleQ.eq(ds.orgColumn, orgId);
      const { data: sample } = await sampleQ;
      const cols = sample && sample[0] ? Object.keys(sample[0]).length : 0;

      let last: string | null = null;
      if (sample && sample[0] && "updated_at" in sample[0]) {
        let lastQ: any = (supabase as any)
          .from(ds.table)
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (ds.orgColumn && orgId) lastQ = lastQ.eq(ds.orgColumn, orgId);
        const { data: lastRow } = await lastQ;
        last = lastRow?.[0]?.updated_at ?? null;
      }

      out.push({
        key: ds.key,
        label: ds.label,
        table: ds.table,
        count: count ?? 0,
        columns: cols,
        lastUpdated: last,
      });
    } catch (e: any) {
      out.push({
        key: ds.key,
        label: ds.label,
        table: ds.table,
        count: 0,
        columns: 0,
        lastUpdated: null,
        error: e?.message ?? "erro",
      });
    }
  }
  return out;
}

export interface IntegrityIssue {
  category: string;
  table: string;
  count: number;
  sample?: any[];
}

const CPF_RE = /^\d{11}$/;
const CNPJ_RE = /^\d{14}$/;

function isValidCpf(v: string): boolean {
  const s = (v || "").replace(/\D/g, "");
  if (!CPF_RE.test(s)) return false;
  if (/^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(s[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(s[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(s[10]);
}

function isValidCnpj(v: string): boolean {
  const s = (v || "").replace(/\D/g, "");
  if (!CNPJ_RE.test(s)) return false;
  if (/^(\d)\1+$/.test(s)) return false;
  const calc = (base: string) => {
    const weights = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(s.slice(0, 12));
  const d2 = calc(s.slice(0, 12) + String(d1));
  return d1 === Number(s[12]) && d2 === Number(s[13]);
}

export async function runIntegrityChecks(orgId: string | null): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  // Clientes: CPF/CNPJ inválidos
  try {
    const { data } = await (supabase as any)
      .from("customers")
      .select("id, name, document, cpf, cnpj")
      .eq("organization_id", orgId)
      .limit(5000);
    const invalidDocs: any[] = [];
    for (const c of data ?? []) {
      const doc = String(c.document || c.cpf || c.cnpj || "").replace(/\D/g, "");
      if (!doc) continue;
      if (doc.length === 11 && !isValidCpf(doc)) invalidDocs.push({ id: c.id, name: c.name, doc });
      if (doc.length === 14 && !isValidCnpj(doc)) invalidDocs.push({ id: c.id, name: c.name, doc });
    }
    if (invalidDocs.length)
      issues.push({ category: "CPF/CNPJ inválido", table: "customers", count: invalidDocs.length, sample: invalidDocs.slice(0, 10) });
  } catch {}

  // IMEI duplicado
  try {
    const { data } = await (supabase as any)
      .from("product_imei")
      .select("imei, product_id")
      .eq("organization_id", orgId)
      .limit(20000);
    const seen = new Map<string, number>();
    for (const r of data ?? []) {
      if (!r.imei) continue;
      seen.set(r.imei, (seen.get(r.imei) ?? 0) + 1);
    }
    const dups = Array.from(seen.entries()).filter(([, n]) => n > 1);
    if (dups.length)
      issues.push({
        category: "IMEI duplicado",
        table: "product_imei",
        count: dups.length,
        sample: dups.slice(0, 10).map(([imei, count]) => ({ imei, count })),
      });
  } catch {}

  // Vendas órfãs: sale_items com sale_id que não existe
  try {
    const { data: items } = await (supabase as any)
      .from("sale_items")
      .select("id, sale_id")
      .eq("organization_id", orgId)
      .limit(20000);
    const saleIds = Array.from(new Set((items ?? []).map((i: any) => i.sale_id).filter(Boolean)));
    if (saleIds.length) {
      const { data: sales } = await (supabase as any)
        .from("sales_orders")
        .select("id")
        .in("id", saleIds);
      const existing = new Set((sales ?? []).map((s: any) => s.id));
      const orphans = (items ?? []).filter((i: any) => !existing.has(i.sale_id));
      if (orphans.length)
        issues.push({
          category: "sale_items órfãos (sale_id inexistente)",
          table: "sale_items",
          count: orphans.length,
          sample: orphans.slice(0, 10),
        });
    }
  } catch {}

  // Produtos com nome vazio
  try {
    const { data, count } = await (supabase as any)
      .from("products")
      .select("id, name", { count: "exact" })
      .eq("organization_id", orgId)
      .or("name.is.null,name.eq.")
      .limit(10);
    if ((count ?? 0) > 0)
      issues.push({ category: "Produto sem nome", table: "products", count: count ?? 0, sample: data ?? [] });
  } catch {}

  return issues;
}

export function findDataset(key: string): DatasetDef | undefined {
  return DATASETS.find((d) => d.key === key);
}
