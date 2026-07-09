// Exportação Financeira Completa — SOMENTE LEITURA.
// Não altera banco, cadastros, histórico nem regras de negócio.
import { supabase } from "@/integrations/supabase/client";
import { rowsToCsv } from "./csv";
import JSZip from "jszip";

export type FinancialExportMode = "padrao" | "expandida" | "premier";

export interface FinancialIssue {
  tipo: string;
  quantidade: number;
  severidade: "alta" | "media" | "baixa";
}

export interface FinancialIntegrityReport {
  totalReceber: number;
  totalPagar: number;
  totalFinanceiro: number;
  movimentacoes: number;
  issues: FinancialIssue[];
  amostra: Array<{ tabela: string; id?: string; problema: string; detalhe?: string }>;
  warnings: string[];
  generatedAt: string;
}

export interface FinancialExportResult {
  filename: string;
  contasReceber: number;
  contasPagar: number;
  totalFinanceiro: number;
  movimentacoes: number;
  durationMs: number;
  bytes: number;
}

type Sheet = { name: string; rows: any[]; columns: string[] };

const PAGE = 1000;

async function fetchAll(table: string, orgId: string | null, optional = false): Promise<{ rows: any[]; warning?: string }> {
  if (!orgId) return { rows: [], warning: "Organização não selecionada." };

  const rows: any[] = [];
  let from = 0;

  while (true) {
    let query: any = (supabase as any).from(table).select("*").range(from, from + PAGE - 1);
    query = query.eq("organization_id", orgId);
    const { data, error } = await query;

    if (error) {
      if (optional) return { rows, warning: `${table}: ${error.message}` };
      return { rows, warning: `${table}: ${error.message}` };
    }

    const batch = (data ?? []) as any[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }

  return { rows };
}

function num(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(v: any): string {
  return v === null || v === undefined ? "" : String(v);
}

function get(row: any, names: string[], fallback: any = "") {
  for (const name of names) {
    if (row && row[name] !== undefined && row[name] !== null) return row[name];
  }
  return fallback;
}

function columnsOf(rows: any[]) {
  const keys = new Set<string>();
  for (const row of rows) Object.keys(row ?? {}).forEach((key) => keys.add(key));
  return [...keys];
}

function expandRows(rows: any[]): { rows: any[]; columns: string[] } {
  const keys = new Set<string>();
  const flat = rows.map((row) => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row ?? {})) {
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        for (const [childKey, childValue] of Object.entries(value as Record<string, any>)) {
          const flatKey = `${key}.${childKey}`;
          out[flatKey] = childValue;
          keys.add(flatKey);
        }
      } else {
        out[key] = value;
        keys.add(key);
      }
    }
    return out;
  });
  return { rows: flat, columns: [...keys] };
}

function noteField(notes: string | null | undefined, label: string) {
  const line = str(notes)
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : "";
}

function byId(rows: any[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function duplicateCount(rows: any[], makeKey: (row: any) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = makeKey(row);
    if (!key.trim()) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
}

function balance(row: any) {
  return num(row.amount) - num(row.paid_amount);
}

function isPaid(row: any) {
  return ["paid", "pago", "liquidado", "quitado", "completed"].includes(str(row.status).toLowerCase());
}

async function loadFinancialBase(orgId: string | null) {
  const [receber, pagar, movimentos, caixa, caixaMovs, bancos, clientes, fornecedores, vendas, compras, contas, centros] =
    await Promise.all([
      fetchAll("accounts_receivable", orgId),
      fetchAll("accounts_payable", orgId),
      fetchAll("finance_transactions", orgId),
      fetchAll("cash_register_sessions", orgId, true),
      fetchAll("cash_register_movements", orgId, true),
      fetchAll("bank_accounts", orgId, true),
      fetchAll("customers", orgId),
      fetchAll("suppliers", orgId),
      fetchAll("sales_orders", orgId),
      fetchAll("purchase_notes", orgId, true),
      fetchAll("chart_of_accounts", orgId, true),
      fetchAll("cost_centers", orgId, true),
    ]);

  return {
    receivables: receber.rows,
    payables: pagar.rows,
    movements: movimentos.rows,
    cashSessions: caixa.rows,
    cashMovements: caixaMovs.rows,
    bankAccounts: bancos.rows,
    customers: clientes.rows,
    suppliers: fornecedores.rows,
    sales: vendas.rows,
    purchases: compras.rows,
    accounts: contas.rows,
    costCenters: centros.rows,
    warnings: [
      receber.warning,
      pagar.warning,
      movimentos.warning,
      caixa.warning,
      caixaMovs.warning,
      bancos.warning,
      clientes.warning,
      fornecedores.warning,
      vendas.warning,
      compras.warning,
      contas.warning,
      centros.warning,
    ].filter(Boolean) as string[],
  };
}

export async function validateFinancialExport(orgId: string | null): Promise<FinancialIntegrityReport> {
  const base = await loadFinancialBase(orgId);
  const today = new Date().toISOString().slice(0, 10);
  const samples: FinancialIntegrityReport["amostra"] = [];
  const push = (item: FinancialIntegrityReport["amostra"][number]) => {
    if (samples.length < 20) samples.push(item);
  };

  const customerIds = new Set(base.customers.map((row) => row.id));
  const supplierIds = new Set(base.suppliers.map((row) => row.id));
  const saleIds = new Set(base.sales.map((row) => row.id));
  const purchaseIds = new Set(base.purchases.map((row) => row.id));
  const receivableIds = new Set(base.receivables.map((row) => row.id));
  const payableIds = new Set(base.payables.map((row) => row.id));
  const accountKeys = new Set(
    base.accounts.flatMap((row) => [row.id, row.name, row.code].filter(Boolean).map((item) => str(item).toLowerCase())),
  );
  const costCenterIds = new Set(base.costCenters.map((row) => row.id));

  let orphanAccounts = 0;
  let orphanPayments = 0;
  let negativeValues = 0;
  let overdue = 0;
  let missingCategories = 0;
  let missingCostCenters = 0;

  for (const row of base.receivables) {
    if (row.customer_id && !customerIds.has(row.customer_id)) {
      orphanAccounts++;
      push({ tabela: "accounts_receivable", id: row.id, problema: "Cliente inexistente", detalhe: row.customer_id });
    }
    if (row.sale_id && !saleIds.has(row.sale_id)) {
      orphanAccounts++;
      push({ tabela: "accounts_receivable", id: row.id, problema: "Venda relacionada inexistente", detalhe: row.sale_id });
    }
    if (num(row.amount) < 0 || num(row.paid_amount) < 0) negativeValues++;
    if (!isPaid(row) && row.due_date && str(row.due_date).slice(0, 10) < today) overdue++;
  }

  for (const row of base.payables) {
    if (row.supplier_id && !supplierIds.has(row.supplier_id)) {
      orphanAccounts++;
      push({ tabela: "accounts_payable", id: row.id, problema: "Fornecedor inexistente", detalhe: row.supplier_id });
    }
    const purchaseId = get(row, ["purchase_id", "purchase_note_id"]);
    if (purchaseId && !purchaseIds.has(purchaseId)) {
      orphanAccounts++;
      push({ tabela: "accounts_payable", id: row.id, problema: "Compra relacionada inexistente", detalhe: purchaseId });
    }
    if (num(row.amount) < 0 || num(row.paid_amount) < 0) negativeValues++;
    if (!isPaid(row) && row.due_date && str(row.due_date).slice(0, 10) < today) overdue++;
    const category = str(row.category).toLowerCase();
    if (category && accountKeys.size && !accountKeys.has(category)) missingCategories++;
    const costCenterId = get(row, ["cost_center_id", "cost_center"]);
    if (costCenterId && costCenterIds.size && !costCenterIds.has(costCenterId)) missingCostCenters++;
  }

  for (const row of base.movements) {
    const refType = str(row.reference_type).toLowerCase();
    const refId = row.reference_id;
    if (refId && /receivable|contas?_?receber/.test(refType) && !receivableIds.has(refId)) orphanPayments++;
    if (refId && /payable|contas?_?pagar/.test(refType) && !payableIds.has(refId)) orphanPayments++;
    if (refId && /sale|venda/.test(refType) && !saleIds.has(refId)) orphanPayments++;
    if (num(row.amount) < 0) negativeValues++;
    const category = str(row.category).toLowerCase();
    if (category && accountKeys.size && !accountKeys.has(category)) missingCategories++;
    const costCenterId = get(row, ["cost_center_id", "cost_center"]);
    if (costCenterId && costCenterIds.size && !costCenterIds.has(costCenterId)) missingCostCenters++;
  }

  for (const row of base.cashMovements) {
    if (num(row.amount) < 0) negativeValues++;
  }

  const duplicates =
    duplicateCount(base.receivables, (row) => `${row.customer_id}|${row.description}|${row.due_date}|${row.amount}`) +
    duplicateCount(base.payables, (row) => `${row.supplier_id}|${row.description}|${row.due_date}|${row.amount}`) +
    duplicateCount(base.movements, (row) => `${row.type}|${row.description}|${row.transaction_date}|${row.amount}`);

  const issues: FinancialIssue[] = [
    { tipo: "Contas órfãs", quantidade: orphanAccounts, severidade: "alta" },
    { tipo: "Pagamentos órfãos", quantidade: orphanPayments, severidade: "alta" },
    { tipo: "Valores negativos", quantidade: negativeValues, severidade: "media" },
    { tipo: "Contas vencidas", quantidade: overdue, severidade: "media" },
    { tipo: "Duplicidades", quantidade: duplicates, severidade: "media" },
    { tipo: "Categorias inexistentes", quantidade: missingCategories, severidade: "baixa" },
    { tipo: "Centros de custo inexistentes", quantidade: missingCostCenters, severidade: "baixa" },
  ];

  return {
    totalReceber: base.receivables.length,
    totalPagar: base.payables.length,
    totalFinanceiro:
      base.receivables.reduce((sum, row) => sum + num(row.amount), 0) -
      base.payables.reduce((sum, row) => sum + num(row.amount), 0) +
      base.movements.reduce((sum, row) => sum + (str(row.type).toLowerCase() === "expense" ? -num(row.amount) : num(row.amount)), 0),
    movimentacoes: base.movements.length + base.cashMovements.length,
    issues,
    amostra: samples,
    warnings: base.warnings,
    generatedAt: new Date().toISOString(),
  };
}

function toPremierReceivables(rows: any[], customers: Map<string, any>) {
  const columns = [
    "id",
    "customer_id",
    "cliente",
    "numero",
    "emissao",
    "vencimento",
    "pagamento",
    "valor",
    "desconto",
    "juros",
    "multa",
    "saldo",
    "status",
    "forma_pagamento",
    "vendedor",
    "sale_id",
    "payment_id",
    "bank_account_id",
    "observacoes",
  ];
  return {
    columns,
    rows: rows.map((row) => {
      const customer = row.customer_id ? customers.get(row.customer_id) : null;
      return {
        id: row.id,
        customer_id: row.customer_id ?? "",
        cliente: customer?.name ?? noteField(row.notes, "Cliente") ?? "",
        numero: get(row, ["number", "numero", "document_number"], row.sale_id || row.id),
        emissao: get(row, ["issued_at", "emission_date", "created_at"]),
        vencimento: row.due_date ?? "",
        pagamento: row.paid_at ?? "",
        valor: num(row.amount),
        desconto: get(row, ["discount", "discount_amount"], noteField(row.notes, "Desconto")),
        juros: get(row, ["interest", "interest_amount"], noteField(row.notes, "Juros")),
        multa: get(row, ["fine", "fine_amount", "fees"], noteField(row.notes, "Multa")),
        saldo: balance(row),
        status: row.status ?? "",
        forma_pagamento: get(row, ["payment_method", "method"], noteField(row.notes, "Pagamento")),
        vendedor: get(row, ["seller_id", "seller", "user_id"]),
        sale_id: row.sale_id ?? "",
        payment_id: get(row, ["payment_id"]),
        bank_account_id: get(row, ["bank_account_id", "account_id"]),
        observacoes: row.notes ?? "",
      };
    }),
  };
}

function toPremierPayables(rows: any[], suppliers: Map<string, any>) {
  const columns = [
    "id",
    "supplier_id",
    "fornecedor",
    "numero",
    "competencia",
    "emissao",
    "vencimento",
    "pagamento",
    "valor",
    "desconto",
    "juros",
    "multa",
    "saldo",
    "categoria",
    "centro_custo",
    "status",
    "purchase_id",
    "payment_id",
    "bank_account_id",
    "observacoes",
  ];
  return {
    columns,
    rows: rows.map((row) => {
      const supplier = row.supplier_id ? suppliers.get(row.supplier_id) : null;
      return {
        id: row.id,
        supplier_id: row.supplier_id ?? "",
        fornecedor: supplier?.name ?? noteField(row.notes, "Fornecedor") ?? "",
        numero: get(row, ["number", "numero", "document_number"], row.id),
        competencia: get(row, ["competence_date", "competencia"], noteField(row.notes, "Competência") || row.due_date),
        emissao: get(row, ["issued_at", "emission_date", "created_at"]),
        vencimento: row.due_date ?? "",
        pagamento: row.paid_at ?? "",
        valor: num(row.amount),
        desconto: get(row, ["discount", "discount_amount"], noteField(row.notes, "Desconto")),
        juros: get(row, ["interest", "interest_amount"], noteField(row.notes, "Juros")),
        multa: get(row, ["fine", "fine_amount", "fees"], noteField(row.notes, "Multa/Juros")),
        saldo: balance(row),
        categoria: row.category ?? "",
        centro_custo: get(row, ["cost_center", "cost_center_id"]),
        status: row.status ?? "",
        purchase_id: get(row, ["purchase_id", "purchase_note_id"]),
        payment_id: get(row, ["payment_id"]),
        bank_account_id: get(row, ["bank_account_id", "account_id"]),
        observacoes: row.notes ?? "",
      };
    }),
  };
}

function movementKind(row: any) {
  const type = str(row.type).toLowerCase();
  const blob = `${type} ${row.reference_type ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (/transfer|transfer[êe]ncia|ted|doc/.test(blob)) return "transferencia";
  if (/estorno|refund|chargeback/.test(blob)) return "estorno";
  if (/ajuste|adjust/.test(blob)) return "ajuste";
  if (/expense|sa[ií]da|saida|withdraw|sangria/.test(blob)) return "saida";
  return "entrada";
}

function toPremierMovements(rows: any[]) {
  const columns = [
    "id",
    "tipo",
    "data",
    "descricao",
    "valor",
    "categoria",
    "forma_pagamento",
    "customer_id",
    "supplier_id",
    "sale_id",
    "purchase_id",
    "payment_id",
    "bank_account_id",
    "reference_type",
    "reference_id",
    "usuario",
  ];
  return {
    columns,
    rows: rows.map((row) => ({
      id: row.id,
      tipo: movementKind(row),
      data: get(row, ["transaction_date", "payment_date", "created_at"]),
      descricao: row.description ?? "",
      valor: num(row.amount),
      categoria: row.category ?? "",
      forma_pagamento: row.payment_method ?? "",
      customer_id: get(row, ["customer_id"]),
      supplier_id: get(row, ["supplier_id"]),
      sale_id: /sale|venda/.test(str(row.reference_type).toLowerCase()) ? row.reference_id : get(row, ["sale_id"]),
      purchase_id: /purchase|compra/.test(str(row.reference_type).toLowerCase()) ? row.reference_id : get(row, ["purchase_id"]),
      payment_id: /payment|pagamento/.test(str(row.reference_type).toLowerCase()) ? row.reference_id : get(row, ["payment_id"]),
      bank_account_id: get(row, ["bank_account_id", "account_id"]),
      reference_type: row.reference_type ?? "",
      reference_id: row.reference_id ?? "",
      usuario: row.user_id ?? "",
    })),
  };
}

function toPremierCashSessions(rows: any[]) {
  const columns = ["id", "abertura", "fechamento", "valor_abertura", "valor_fechamento", "valor_esperado", "diferencas", "responsavel", "status", "observacoes"];
  return {
    columns,
    rows: rows.map((row) => ({
      id: row.id,
      abertura: row.opened_at ?? "",
      fechamento: row.closed_at ?? "",
      valor_abertura: num(row.opening_amount),
      valor_fechamento: num(row.closing_amount),
      valor_esperado: num(row.expected_amount),
      diferencas: num(row.difference),
      responsavel: row.user_id ?? "",
      status: row.status ?? "",
      observacoes: row.notes ?? "",
    })),
  };
}

function toPremierCashMovements(rows: any[]) {
  const columns = ["id", "session_id", "tipo", "data", "valor", "descricao", "responsavel", "reference_type", "reference_id"];
  return {
    columns,
    rows: rows.map((row) => ({
      id: row.id,
      session_id: row.session_id ?? "",
      tipo: row.type ?? "",
      data: row.created_at ?? "",
      valor: num(row.amount),
      descricao: row.description ?? "",
      responsavel: row.user_id ?? "",
      reference_type: row.reference_type ?? "",
      reference_id: row.reference_id ?? "",
    })),
  };
}

function toPremierBanks(bankAccounts: any[], movements: any[]) {
  const movementCount = new Map<string, number>();
  const balanceMap = new Map<string, number>();
  for (const movement of movements) {
    const accountId = get(movement, ["bank_account_id", "account_id"]);
    if (!accountId) continue;
    movementCount.set(accountId, (movementCount.get(accountId) ?? 0) + 1);
    balanceMap.set(accountId, (balanceMap.get(accountId) ?? 0) + (movementKind(movement) === "saida" ? -num(movement.amount) : num(movement.amount)));
  }

  const synthetic = bankAccounts.length
    ? bankAccounts
    : [...movementCount.keys()].map((id) => ({ id, name: "Conta financeira", balance: balanceMap.get(id) ?? 0 }));

  const columns = ["bank_account_id", "banco", "agencia", "conta", "pix", "saldo", "movimentacoes"];
  return {
    columns,
    rows: synthetic.map((row) => ({
      bank_account_id: row.id,
      banco: get(row, ["bank", "bank_name", "name"]),
      agencia: get(row, ["agency", "agencia"]),
      conta: get(row, ["account", "account_number", "conta"]),
      pix: get(row, ["pix", "pix_key", "chave_pix"]),
      saldo: get(row, ["balance", "saldo"], balanceMap.get(row.id) ?? 0),
      movimentacoes: movementCount.get(row.id) ?? 0,
    })),
  };
}

function buildSheets(mode: FinancialExportMode, base: Awaited<ReturnType<typeof loadFinancialBase>>): Sheet[] {
  if (mode === "premier") {
    const customers = byId(base.customers);
    const suppliers = byId(base.suppliers);
    return [
      { name: "contas_receber", ...toPremierReceivables(base.receivables, customers) },
      { name: "contas_pagar", ...toPremierPayables(base.payables, suppliers) },
      { name: "movimentacoes", ...toPremierMovements(base.movements) },
      { name: "caixa_aberturas", ...toPremierCashSessions(base.cashSessions) },
      { name: "caixa_movimentos", ...toPremierCashMovements(base.cashMovements) },
      { name: "bancos", ...toPremierBanks(base.bankAccounts, base.movements) },
    ];
  }

  const rawSheets: Sheet[] = [
    { name: "accounts_receivable", rows: base.receivables, columns: columnsOf(base.receivables) },
    { name: "accounts_payable", rows: base.payables, columns: columnsOf(base.payables) },
    { name: "finance_transactions", rows: base.movements, columns: columnsOf(base.movements) },
    { name: "cash_register_sessions", rows: base.cashSessions, columns: columnsOf(base.cashSessions) },
    { name: "cash_register_movements", rows: base.cashMovements, columns: columnsOf(base.cashMovements) },
    { name: "bank_accounts", rows: base.bankAccounts, columns: columnsOf(base.bankAccounts) },
  ];

  if (mode === "expandida") {
    return rawSheets.map((sheet) => {
      const expanded = expandRows(sheet.rows);
      return { name: sheet.name, rows: expanded.rows, columns: expanded.columns };
    });
  }

  return rawSheets;
}

export async function exportFinancial(
  orgId: string | null,
  mode: FinancialExportMode,
  format: "xlsx" | "zip",
): Promise<FinancialExportResult> {
  const t0 = performance.now();
  const base = await loadFinancialBase(orgId);
  const sheets = buildSheets(mode, base);
  const totalFinanceiro =
    base.receivables.reduce((sum, row) => sum + num(row.amount), 0) -
    base.payables.reduce((sum, row) => sum + num(row.amount), 0) +
    base.movements.reduce((sum, row) => sum + (movementKind(row) === "saida" ? -num(row.amount) : num(row.amount)), 0);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `financeiro-${mode}-${stamp}.${format === "xlsx" ? "xlsx" : "zip"}`;
  let bytes = 0;

  const manifest = {
    modo: mode,
    gerado_em: new Date().toISOString(),
    somente_leitura: true,
    contas_receber: base.receivables.length,
    contas_pagar: base.payables.length,
    movimentacoes: base.movements.length + base.cashMovements.length,
    total_financeiro: totalFinanceiro,
    relacionamentos_preservados: ["customer_id", "supplier_id", "sale_id", "purchase_id", "payment_id", "bank_account_id"],
    avisos: base.warnings,
  };

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const normalized = sheet.rows.map((row) => {
        const out: Record<string, any> = {};
        for (const column of sheet.columns) {
          const value = row[column];
          out[column] = value && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value;
        }
        return out;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(normalized, { header: sheet.columns }), sheet.name.slice(0, 31));
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(Object.entries(manifest).map(([campo, valor]) => ({ campo, valor: typeof valor === "object" ? JSON.stringify(valor) : valor }))),
      "README",
    );
    XLSX.writeFile(wb, filename);
    bytes = sheets.reduce((sum, sheet) => sum + sheet.rows.length * Math.max(sheet.columns.length, 1) * 20, 0);
  } else {
    const zip = new JSZip();
    for (const sheet of sheets) zip.file(`${sheet.name}.csv`, rowsToCsv(sheet.rows, sheet.columns));
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    bytes = blob.size;
    triggerBlob(filename, blob);
  }

  return {
    filename,
    contasReceber: base.receivables.length,
    contasPagar: base.payables.length,
    totalFinanceiro,
    movimentacoes: base.movements.length + base.cashMovements.length,
    durationMs: Math.round(performance.now() - t0),
    bytes,
  };
}

function triggerBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════
// Sprint 3.3 — Assistente de Migração Financeira
// ═══════════════════════════════════════════════════════════════════════

export type FinancialModuleKey =
  | "accounts_payable"
  | "accounts_receivable"
  | "finance_transactions"
  | "bank_accounts"
  | "cash_register"
  | "financial_categories"
  | "chart_of_accounts"
  | "cost_centers";

export type FinancialStatusFilter = "all" | "open" | "paid" | "overdue";
export type FinancialDateField = "due_date" | "issued_at" | "paid_at" | "transaction_date" | "created_at";

export interface ModuleFilter {
  status?: FinancialStatusFilter;
  dateField?: FinancialDateField;
  periodStart?: string;
  periodEnd?: string;
}

export interface FinancialAssistantSelection {
  modules: FinancialModuleKey[];
  filters: Partial<Record<FinancialModuleKey, ModuleFilter>>;
}

export interface ModuleSummary { count: number; totalAmount: number; }

export interface FinancialAssistantResult {
  filename: string;
  durationMs: number;
  bytes: number;
  modules: Array<{ key: FinancialModuleKey; count: number; totalAmount: number }>;
}

const MODULE_TO_TABLES: Record<FinancialModuleKey, string[]> = {
  accounts_payable: ["accounts_payable"],
  accounts_receivable: ["accounts_receivable"],
  finance_transactions: ["finance_transactions"],
  bank_accounts: ["bank_accounts"],
  cash_register: ["cash_register_sessions", "cash_register_movements"],
  financial_categories: ["chart_of_accounts"],
  chart_of_accounts: ["chart_of_accounts"],
  cost_centers: ["cost_centers"],
};

export const FINANCIAL_MODULE_LABELS: Record<FinancialModuleKey, string> = {
  accounts_payable: "Contas a pagar",
  accounts_receivable: "Contas a receber",
  finance_transactions: "Movimentações financeiras",
  bank_accounts: "Bancos",
  cash_register: "Caixas",
  financial_categories: "Categorias financeiras",
  chart_of_accounts: "Plano de contas",
  cost_centers: "Centros de custo",
};

export const FINANCIAL_TRANSACTIONAL: FinancialModuleKey[] = [
  "accounts_payable",
  "accounts_receivable",
  "finance_transactions",
];

const STATUS_OPEN = ["open", "pending", "em_aberto", "a_pagar", "a_receber", "aberto"];
const STATUS_PAID = ["paid", "pago", "liquidado", "quitado", "completed"];

function applyModuleFilter(query: any, table: string, filter?: ModuleFilter) {
  if (!filter) return query;
  const dateCol = filter.dateField ?? (table === "finance_transactions" ? "transaction_date" : table === "cash_register_movements" ? "created_at" : "due_date");
  if (filter.periodStart) query = query.gte(dateCol, filter.periodStart);
  if (filter.periodEnd) query = query.lte(dateCol, filter.periodEnd + "T23:59:59");
  if (filter.status === "open") query = query.in("status", STATUS_OPEN);
  else if (filter.status === "paid") query = query.in("status", STATUS_PAID);
  else if (filter.status === "overdue") {
    const today = new Date().toISOString().slice(0, 10);
    query = query.in("status", STATUS_OPEN).lt("due_date", today);
  }
  return query;
}

async function fetchFilteredRows(table: string, orgId: string | null, filter?: ModuleFilter): Promise<any[]> {
  if (!orgId) return [];
  const rows: any[] = [];
  let from = 0;
  while (true) {
    let q: any = (supabase as any).from(table).select("*").eq("organization_id", orgId).range(from, from + PAGE - 1);
    q = applyModuleFilter(q, table, filter);
    const { data, error } = await q;
    if (error) return rows;
    const batch = (data ?? []) as any[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

export async function summarizeFinancialModule(
  orgId: string | null,
  moduleKey: FinancialModuleKey,
  filter?: ModuleFilter,
): Promise<ModuleSummary> {
  if (!orgId) return { count: 0, totalAmount: 0 };
  const tables = MODULE_TO_TABLES[moduleKey];
  let count = 0;
  let totalAmount = 0;
  for (const table of tables) {
    try {
      let qc: any = (supabase as any).from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
      qc = applyModuleFilter(qc, table, filter);
      const { count: c, error } = await qc;
      if (error) continue;
      count += c ?? 0;

      if (["accounts_payable", "accounts_receivable", "finance_transactions", "cash_register_movements"].includes(table)) {
        let from = 0;
        while (true) {
          let qs: any = (supabase as any).from(table).select("amount").eq("organization_id", orgId).range(from, from + PAGE - 1);
          qs = applyModuleFilter(qs, table, filter);
          const { data, error: e2 } = await qs;
          if (e2) break;
          const batch = (data ?? []) as any[];
          totalAmount += batch.reduce((s, r) => s + num((r as any).amount), 0);
          if (batch.length < PAGE) break;
          from += PAGE;
        }
      }
    } catch {
      // tabelas opcionais (bank_accounts, cost_centers) podem não existir
    }
  }
  return { count, totalAmount };
}

export async function exportFinancialAssistant(
  orgId: string | null,
  selection: FinancialAssistantSelection,
  format: "xlsx" | "zip",
): Promise<FinancialAssistantResult> {
  const t0 = performance.now();
  const sheets: Sheet[] = [];
  const summary: FinancialAssistantResult["modules"] = [];
  const emitted = new Set<string>();

  for (const moduleKey of selection.modules) {
    const filter = selection.filters[moduleKey];
    const tables = MODULE_TO_TABLES[moduleKey];
    let modCount = 0;
    let modTotal = 0;
    for (const table of tables) {
      if (emitted.has(table)) continue;
      emitted.add(table);
      const rows = await fetchFilteredRows(table, orgId, filter).catch(() => [] as any[]);
      modCount += rows.length;
      modTotal += rows.reduce((s, r) => s + num((r as any).amount), 0);
      sheets.push({ name: table, rows, columns: columnsOf(rows) });
    }
    summary.push({ key: moduleKey, count: modCount, totalAmount: modTotal });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `financeiro-assistente-${stamp}.${format === "xlsx" ? "xlsx" : "zip"}`;
  let bytes = 0;

  const manifest = {
    tipo: "assistente_financeiro",
    gerado_em: new Date().toISOString(),
    somente_leitura: true,
    modulos_exportados: selection.modules.map((key) => ({
      modulo: key,
      label: FINANCIAL_MODULE_LABELS[key],
      filtros: selection.filters[key] ?? null,
      registros: summary.find((s) => s.key === key)?.count ?? 0,
      valor_total: summary.find((s) => s.key === key)?.totalAmount ?? 0,
    })),
    tabelas: [...emitted],
    total_registros: summary.reduce((s, m) => s + m.count, 0),
    total_valor: summary.reduce((s, m) => s + m.totalAmount, 0),
  };

  const readme = [
    "# Exportação Financeira — Assistente de Migração",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "## Módulos exportados",
    ...selection.modules.map((k) => {
      const m = summary.find((x) => x.key === k)!;
      const f = selection.filters[k];
      const parts = f
        ? [
            f.status && f.status !== "all" ? `status=${f.status}` : "",
            f.dateField ? `data=${f.dateField}` : "",
            f.periodStart ? `de ${f.periodStart}` : "",
            f.periodEnd ? `até ${f.periodEnd}` : "",
          ].filter(Boolean).join(", ")
        : "";
      return `- ${FINANCIAL_MODULE_LABELS[k]}: ${m.count} registros · ${m.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${parts ? ` · ${parts}` : ""}`;
    }),
    "",
    "## Compatibilidade",
    "- Formato dos CSVs preservado (colunas idênticas ao banco).",
    "- Estrutura do ZIP inalterada.",
    "- Compatível com o pipeline do Premier ERP.",
  ].join("\n");

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const normalized = sheet.rows.map((row) => {
        const out: Record<string, any> = {};
        for (const column of sheet.columns) {
          const value = row[column];
          out[column] = value && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value;
        }
        return out;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(normalized, { header: sheet.columns }), sheet.name.slice(0, 31));
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(Object.entries(manifest).map(([campo, valor]) => ({ campo, valor: typeof valor === "object" ? JSON.stringify(valor) : valor }))),
      "manifest",
    );
    XLSX.writeFile(wb, filename);
    bytes = sheets.reduce((sum, sheet) => sum + sheet.rows.length * Math.max(sheet.columns.length, 1) * 20, 0);
  } else {
    const zip = new JSZip();
    for (const sheet of sheets) zip.file(`${sheet.name}.csv`, rowsToCsv(sheet.rows, sheet.columns));
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("README.md", readme);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    bytes = blob.size;
    triggerBlob(filename, blob);
  }

  return { filename, durationMs: Math.round(performance.now() - t0), bytes, modules: summary };
}
