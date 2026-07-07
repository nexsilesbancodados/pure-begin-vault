// Análise de Compatibilidade para Migração — SOMENTE LEITURA.
// Roda dezenas de checagens no banco e produz um score 0-100% por módulo.
// Nenhum dado é alterado.
import { supabase } from "@/integrations/supabase/client";

export type Severity = "baixa" | "media" | "alta";
export type ModuleKey = "produtos" | "clientes" | "fornecedores" | "estoque" | "financeiro" | "integridade";

export interface Check {
  id: string;
  module: ModuleKey;
  label: string;
  severity: Severity;
  count: number;
  sample?: any[];
  error?: string;
}

export interface ModuleScore {
  module: ModuleKey;
  label: string;
  totalRecords: number;
  issuesCount: number;
  score: number; // 0..100
  checks: Check[];
}

export interface CompatibilityReport {
  generatedAt: string;
  organizationId: string | null;
  overallScore: number;
  totalIssues: number;
  modules: ModuleScore[];
  durationMs: number;
}

const MODULE_LABEL: Record<ModuleKey, string> = {
  produtos: "Produtos",
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  estoque: "Estoque",
  financeiro: "Financeiro",
  integridade: "Integridade",
};

// helpers ─────────────────────────────────────────────
async function countWhere(
  table: string,
  orgId: string | null,
  build: (q: any) => any,
): Promise<{ count: number; sample: any[]; error?: string }> {
  try {
    let q: any = (supabase as any).from(table).select("*", { count: "exact" }).limit(3);
    if (orgId) q = q.eq("organization_id", orgId);
    q = build(q);
    const { data, count, error } = await q;
    if (error) return { count: 0, sample: [], error: error.message };
    return { count: count ?? 0, sample: data ?? [] };
  } catch (e: any) {
    return { count: 0, sample: [], error: e?.message ?? String(e) };
  }
}

async function totalCount(table: string, orgId: string | null): Promise<number> {
  try {
    let q: any = (supabase as any).from(table).select("*", { count: "exact", head: true });
    if (orgId) q = q.eq("organization_id", orgId);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// duplicados via fetch limitado e agrupamento em memória (limite 5000 linhas por checagem)
async function findDuplicates(
  table: string,
  orgId: string | null,
  column: string,
): Promise<{ count: number; sample: any[] }> {
  try {
    let q: any = (supabase as any).from(table).select(`id, ${column}`).limit(5000);
    if (orgId) q = q.eq("organization_id", orgId);
    const { data } = await q;
    const rows = (data ?? []) as any[];
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const v = r[column];
      if (v == null || v === "") continue;
      const k = String(v).trim().toLowerCase();
      if (!k) continue;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    const dups = [...map.entries()].filter(([, arr]) => arr.length > 1);
    const totalDupRows = dups.reduce((s, [, a]) => s + a.length, 0);
    const sample = dups.slice(0, 3).map(([v, arr]) => ({ [column]: v, ocorrencias: arr.length }));
    return { count: totalDupRows, sample };
  } catch {
    return { count: 0, sample: [] };
  }
}

function isValidCpf(cpf: string): boolean {
  const s = cpf.replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(s[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(s[10]);
}

function isValidCnpj(cnpj: string): boolean {
  const s = cnpj.replace(/\D/g, "");
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const m = sum % 11;
    return m < 2 ? 0 : 11 - m;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(s.slice(0, 12), w1);
  const d2 = calc(s.slice(0, 12) + d1, w2);
  return d1 === parseInt(s[12]) && d2 === parseInt(s[13]);
}

async function invalidDocs(
  table: string,
  orgId: string | null,
  column: string,
  validator: (v: string) => boolean,
): Promise<{ count: number; sample: any[] }> {
  try {
    let q: any = (supabase as any).from(table).select(`id, ${column}`).not(column, "is", null).limit(5000);
    if (orgId) q = q.eq("organization_id", orgId);
    const { data } = await q;
    const rows = (data ?? []) as any[];
    const bad = rows.filter((r) => r[column] && !validator(String(r[column])));
    return { count: bad.length, sample: bad.slice(0, 3) };
  } catch {
    return { count: 0, sample: [] };
  }
}

async function orphanCount(
  childTable: string,
  fkColumn: string,
  parentTable: string,
  orgId: string | null,
): Promise<{ count: number; sample: any[] }> {
  try {
    let cq: any = (supabase as any).from(childTable).select(`id, ${fkColumn}`).not(fkColumn, "is", null).limit(5000);
    if (orgId) cq = cq.eq("organization_id", orgId);
    const { data: children } = await cq;
    const ids = [...new Set(((children ?? []) as any[]).map((c) => c[fkColumn]).filter(Boolean))];
    if (!ids.length) return { count: 0, sample: [] };
    const { data: parents } = await (supabase as any).from(parentTable).select("id").in("id", ids);
    const present = new Set(((parents ?? []) as any[]).map((p) => p.id));
    const orphans = ((children ?? []) as any[]).filter((c) => !present.has(c[fkColumn]));
    return { count: orphans.length, sample: orphans.slice(0, 3) };
  } catch {
    return { count: 0, sample: [] };
  }
}

// runner ──────────────────────────────────────────────
export async function runCompatibilityAnalysis(orgId: string | null): Promise<CompatibilityReport> {
  const t0 = performance.now();
  const checks: Check[] = [];

  const add = (c: Check) => checks.push(c);
  const mk = (
    id: string,
    module: ModuleKey,
    label: string,
    severity: Severity,
    r: { count: number; sample?: any[]; error?: string },
  ) => add({ id, module, label, severity, count: r.count, sample: r.sample, error: r.error });

  // PRODUTOS ─────────────────────────────────────────
  mk("prod-sem-categoria", "produtos", "Produtos sem categoria", "media",
    await countWhere("products", orgId, (q) => q.is("category", null)));
  mk("prod-sem-marca", "produtos", "Produtos sem marca", "baixa",
    await countWhere("products", orgId, (q) => q.is("brand", null)));
  mk("prod-sem-fornecedor", "produtos", "Produtos sem fornecedor", "media",
    await countWhere("products", orgId, (q) => q.is("supplier_id", null)));
  mk("prod-sem-sku", "produtos", "Produtos sem SKU", "alta",
    await countWhere("products", orgId, (q) => q.is("sku", null)));
  mk("prod-sem-preco-venda", "produtos", "Produtos sem preço de venda", "alta",
    await countWhere("products", orgId, (q) => q.or("price.is.null,price.eq.0")));
  mk("prod-sem-preco-custo", "produtos", "Produtos sem preço de custo", "media",
    await countWhere("products", orgId, (q) => q.or("cost.is.null,cost.eq.0")));
  mk("prod-sem-imagem", "produtos", "Produtos sem imagem", "baixa",
    await countWhere("products", orgId, (q) => q.is("image_url", null)));
  mk("prod-inativos", "produtos", "Produtos inativos", "baixa",
    await countWhere("products", orgId, (q) => q.eq("active", false)));
  mk("prod-duplicados", "produtos", "Produtos duplicados (por SKU)", "alta",
    await findDuplicates("products", orgId, "sku"));
  mk("imei-duplicados", "produtos", "IMEIs duplicados", "alta",
    await findDuplicates("product_imei", orgId, "imei"));
  mk("imei-invalidos", "produtos", "IMEIs inválidos (não 15 dígitos)", "media",
    await (async () => {
      let q: any = (supabase as any).from("product_imei").select("id, imei").not("imei", "is", null).limit(5000);
      if (orgId) q = q.eq("organization_id", orgId);
      const { data } = await q;
      const bad = ((data ?? []) as any[]).filter((r) => !/^\d{15}$/.test(String(r.imei ?? "").replace(/\D/g, "")));
      return { count: bad.length, sample: bad.slice(0, 3) };
    })());

  // CLIENTES ─────────────────────────────────────────
  mk("cli-duplicados-nome", "clientes", "Clientes duplicados (por nome)", "media",
    await findDuplicates("customers", orgId, "name"));
  mk("cli-cpf-duplicado", "clientes", "CPF duplicado", "alta",
    await findDuplicates("customers", orgId, "cpf"));
  mk("cli-cnpj-duplicado", "clientes", "CNPJ duplicado", "alta",
    await findDuplicates("customers", orgId, "cnpj"));
  mk("cli-cpf-invalido", "clientes", "CPF inválido", "alta",
    await invalidDocs("customers", orgId, "cpf", isValidCpf));
  mk("cli-cnpj-invalido", "clientes", "CNPJ inválido", "alta",
    await invalidDocs("customers", orgId, "cnpj", isValidCnpj));
  mk("cli-sem-tel", "clientes", "Clientes sem telefone", "media",
    await countWhere("customers", orgId, (q) => q.is("phone", null)));
  mk("cli-sem-email", "clientes", "Clientes sem e-mail", "baixa",
    await countWhere("customers", orgId, (q) => q.is("email", null)));
  mk("cli-sem-cidade", "clientes", "Clientes sem cidade", "baixa",
    await countWhere("customers", orgId, (q) => q.is("city", null)));
  mk("cli-sem-endereco", "clientes", "Clientes sem endereço", "baixa",
    await countWhere("customers", orgId, (q) => q.is("address", null)));

  // FORNECEDORES ─────────────────────────────────────
  mk("forn-cnpj-invalido", "fornecedores", "CNPJ inválido", "alta",
    await invalidDocs("suppliers", orgId, "cnpj", isValidCnpj));
  mk("forn-cnpj-duplicado", "fornecedores", "CNPJ duplicado", "alta",
    await findDuplicates("suppliers", orgId, "cnpj"));
  mk("forn-sem-contato", "fornecedores", "Fornecedor sem contato (telefone e e-mail)", "media",
    await countWhere("suppliers", orgId, (q) => q.is("phone", null).is("email", null)));
  mk("forn-inativos", "fornecedores", "Fornecedores inativos", "baixa",
    await countWhere("suppliers", orgId, (q) => q.eq("active", false)));

  // ESTOQUE ──────────────────────────────────────────
  mk("est-negativo", "estoque", "Estoque negativo", "alta",
    await countWhere("products", orgId, (q) => q.lt("stock", 0)));
  mk("est-sem-local", "estoque", "Produtos sem localização de estoque", "baixa",
    await countWhere("products", orgId, (q) => q.is("location", null)));
  mk("est-abaixo-min", "estoque", "Produtos abaixo do estoque mínimo", "media",
    await (async () => {
      let q: any = (supabase as any).from("products").select("id, stock, min_stock").not("min_stock", "is", null).limit(5000);
      if (orgId) q = q.eq("organization_id", orgId);
      const { data } = await q;
      const bad = ((data ?? []) as any[]).filter((r) => (r.stock ?? 0) < (r.min_stock ?? 0));
      return { count: bad.length, sample: bad.slice(0, 3) };
    })());
  mk("est-zerado", "estoque", "Produtos zerados", "baixa",
    await countWhere("products", orgId, (q) => q.eq("stock", 0)));
  mk("est-sem-movimento", "estoque", "Sem movimentação há mais de 180 dias", "baixa",
    await (async () => {
      const cutoff = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
      let q: any = (supabase as any).from("products").select("*", { count: "exact", head: true }).lt("updated_at", cutoff);
      if (orgId) q = q.eq("organization_id", orgId);
      const { count } = await q;
      return { count: count ?? 0, sample: [] };
    })());

  // FINANCEIRO ───────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  mk("fin-recebe-vencidas", "financeiro", "Contas a receber vencidas", "media",
    await countWhere("accounts_receivable", orgId, (q) => q.lt("due_date", today).neq("status", "paid")));
  mk("fin-pagar-vencidas", "financeiro", "Contas a pagar vencidas", "media",
    await countWhere("accounts_payable", orgId, (q) => q.lt("due_date", today).neq("status", "paid")));
  mk("fin-sem-categoria", "financeiro", "Transações sem categoria", "media",
    await countWhere("finance_transactions", orgId, (q) => q.is("category_id", null)));
  mk("fin-duplicados", "financeiro", "Lançamentos possivelmente duplicados", "baixa",
    await (async () => {
      let q: any = (supabase as any).from("finance_transactions").select("id, amount, transaction_date, description").limit(5000);
      if (orgId) q = q.eq("organization_id", orgId);
      const { data } = await q;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        const k = `${r.amount}|${r.transaction_date}|${(r.description ?? "").trim().toLowerCase()}`;
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      const dupRows = [...map.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
      return { count: dupRows, sample: [] };
    })());

  // INTEGRIDADE ──────────────────────────────────────
  mk("int-vendas-cli", "integridade", "Vendas apontando para clientes inexistentes", "alta",
    await orphanCount("sales_orders", "customer_id", "customers", orgId));
  mk("int-itens-prod", "integridade", "Itens de venda apontando para produtos inexistentes", "alta",
    await orphanCount("sale_items", "product_id", "products", orgId));
  mk("int-compras-forn", "integridade", "Compras apontando para fornecedores inexistentes", "alta",
    await orphanCount("purchase_notes", "supplier_id", "suppliers", orgId));
  mk("int-pag-orfaos", "integridade", "Pagamentos órfãos (sem venda)", "media",
    await orphanCount("sale_payments", "sale_order_id", "sales_orders", orgId));

  // score por módulo ─────────────────────────────────
  const totalsByModule: Record<ModuleKey, number> = {
    produtos: await totalCount("products", orgId),
    clientes: await totalCount("customers", orgId),
    fornecedores: await totalCount("suppliers", orgId),
    estoque: await totalCount("products", orgId),
    financeiro:
      (await totalCount("finance_transactions", orgId)) +
      (await totalCount("accounts_receivable", orgId)) +
      (await totalCount("accounts_payable", orgId)),
    integridade:
      (await totalCount("sales_orders", orgId)) +
      (await totalCount("sale_items", orgId)) +
      (await totalCount("purchase_notes", orgId)) +
      (await totalCount("sale_payments", orgId)),
  };

  const modules: ModuleScore[] = (Object.keys(MODULE_LABEL) as ModuleKey[]).map((m) => {
    const mChecks = checks.filter((c) => c.module === m);
    const issues = mChecks.reduce((s, c) => s + c.count, 0);
    const total = Math.max(totalsByModule[m], 1);
    // score: 100 - min(100, issues/total * 100 * peso). severidade ajusta o peso.
    const weighted = mChecks.reduce((s, c) => {
      const w = c.severity === "alta" ? 1.5 : c.severity === "media" ? 1 : 0.4;
      return s + c.count * w;
    }, 0);
    const pct = Math.max(0, Math.min(100, 100 - (weighted / total) * 100));
    return {
      module: m,
      label: MODULE_LABEL[m],
      totalRecords: totalsByModule[m],
      issuesCount: issues,
      score: Math.round(pct),
      checks: mChecks,
    };
  });

  const overall = Math.round(modules.reduce((s, m) => s + m.score, 0) / modules.length);
  const totalIssues = checks.reduce((s, c) => s + c.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    organizationId: orgId,
    overallScore: overall,
    totalIssues,
    modules,
    durationMs: Math.round(performance.now() - t0),
  };
}

// PDF ─────────────────────────────────────────────────
export async function exportCompatibilityPdf(report: CompatibilityReport): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 40;

  const line = (text: string, size = 10, bold = false) => {
    if (y > H - 40) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, 40, y);
    y += size + 4;
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Compatibilidade para Migração", 40, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")} · Organização: ${report.organizationId ?? "-"}`,
    40,
    50,
  );
  doc.setTextColor(0, 0, 0);
  y = 100;

  line(`Compatibilidade da base: ${report.overallScore}%`, 16, true);
  line(`Total de inconsistências: ${report.totalIssues.toLocaleString("pt-BR")}`, 11);
  line(`Duração da análise: ${(report.durationMs / 1000).toFixed(1)}s`, 10);
  y += 8;

  for (const m of report.modules) {
    line(`${m.label} — ${m.score}%  (${m.issuesCount.toLocaleString("pt-BR")} inconsistências / ${m.totalRecords.toLocaleString("pt-BR")} registros)`, 13, true);
    for (const c of m.checks) {
      if (c.count === 0 && !c.error) continue;
      const tag = c.error ? "ERRO" : c.severity.toUpperCase();
      line(`  [${tag}] ${c.label}: ${c.count.toLocaleString("pt-BR")}${c.error ? ` — ${c.error}` : ""}`, 10);
    }
    y += 6;
  }

  const filename = `Relatorio-Compatibilidade-${report.generatedAt.slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
