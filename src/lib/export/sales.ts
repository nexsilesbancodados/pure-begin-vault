// Exportação Completa de Vendas — SOMENTE LEITURA.
import { supabase } from "@/integrations/supabase/client";
import { rowsToCsv } from "./csv";
import { downloadXlsx } from "./xlsx";
import type { BackupPeriod } from "./backup";
import JSZip from "jszip";

export type SalesExportMode = "padrao" | "expandida" | "premier";

export interface SalesSanitizeFilters {
  onlyValid?: boolean;
  excludeSemItens?: boolean;
  excludeTotalDivergente?: boolean;
  excludeSemCliente?: boolean;
  excludeImeiDuplicado?: boolean;
  excludePagamentoDivergente?: boolean;
  excludeCanceladas?: boolean;
}

export const DEFAULT_SANITIZE: SalesSanitizeFilters = {
  onlyValid: true,
  excludeSemItens: true,
  excludeTotalDivergente: true,
  excludeSemCliente: true,
  excludeImeiDuplicado: true,
  excludePagamentoDivergente: true,
  excludeCanceladas: true,
};

export interface SalesSanitizeCandidates {
  semItens: string[];
  totalDivergente: string[];
  semCliente: string[];
  imeiDuplicado: string[];
  pagamentoDivergente: string[];
  canceladas: string[];
}

export interface SalesValidationReport {
  totalVendas: number;
  vendasSemCliente: number;
  vendasSemVendedor: number;
  vendasSemItens: number;
  vendasCanceladas: number;
  valoresNegativos: number;
  clientesInexistentes: number;
  produtosInexistentes: number;
  imeisDuplicados: number;
  pagamentosOrfaos: number;
  itensSemVenda: number;
  totaisDivergentes: number;
  pagamentosDivergentes: number;
  itensNegativos: number;
  quantidadeIncorreta: number;
  erros: number;
  avisos: number;
  inconsistencias: number;
  registrosAfetados: number;
  percentualIntegridade: number;
  amostra: Array<{ sale_id?: string; problema: string; detalhe?: string }>;
  detalhes?: Array<{ tipo: "erro" | "aviso" | "inconsistencia"; sale_id?: string; registro_id?: string; problema: string; detalhe?: string }>;
  candidates: SalesSanitizeCandidates;
  salesIndex: Array<{ id: string; sale_number?: any; customer_id?: string | null; created_at?: string | null }>;
}

const SANITIZE_LABELS: Record<keyof SalesSanitizeCandidates, string> = {
  semItens: "Venda sem itens",
  totalDivergente: "Total divergente",
  semCliente: "Cliente inexistente / sem cliente",
  imeiDuplicado: "IMEI duplicado",
  pagamentoDivergente: "Pagamento divergente",
  canceladas: "Venda cancelada",
};

export function computeExcludedSales(
  report: Pick<SalesValidationReport, "candidates">,
  filters: SalesSanitizeFilters,
): { excluded: Set<string>; reasonsBySale: Map<string, string[]> } {
  const excluded = new Set<string>();
  const reasonsBySale = new Map<string, string[]>();
  const c = report.candidates;
  const add = (ids: string[], label: string) => {
    for (const id of ids) {
      if (!id) continue;
      excluded.add(id);
      if (!reasonsBySale.has(id)) reasonsBySale.set(id, []);
      const arr = reasonsBySale.get(id)!;
      if (!arr.includes(label)) arr.push(label);
    }
  };
  if (filters.excludeSemItens) add(c.semItens, SANITIZE_LABELS.semItens);
  if (filters.excludeTotalDivergente) add(c.totalDivergente, SANITIZE_LABELS.totalDivergente);
  if (filters.excludeSemCliente) add(c.semCliente, SANITIZE_LABELS.semCliente);
  if (filters.excludeImeiDuplicado) add(c.imeiDuplicado, SANITIZE_LABELS.imeiDuplicado);
  if (filters.excludePagamentoDivergente) add(c.pagamentoDivergente, SANITIZE_LABELS.pagamentoDivergente);
  if (filters.excludeCanceladas) add(c.canceladas, SANITIZE_LABELS.canceladas);
  return { excluded, reasonsBySale };
}

export interface SalesExportResult {
  filename: string;
  vendas: number;
  itens: number;
  pagamentos: number;
  totalVendido: number;
  durationMs: number;
  bytes: number;
}

async function fetchAll(table: string, orgId: string | null, extra?: (q: any) => any) {
  const rows: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    let q: any = (supabase as any).from(table).select("*").range(from, from + PAGE - 1);
    if (orgId) q = q.eq("organization_id", orgId);
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) break;
    const batch = (data ?? []) as any[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

const num = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const closeMoney = (a: number, b: number) => Math.abs(round2(a) - round2(b)) <= 0.05;

function pushIssue(
  rep: SalesValidationReport,
  tipo: "erro" | "aviso" | "inconsistencia",
  issue: { sale_id?: string; registro_id?: string; problema: string; detalhe?: string },
) {
  rep.detalhes ||= [];
  rep.detalhes.push({ tipo, ...issue });
  if (rep.amostra.length < 20) rep.amostra.push({ sale_id: issue.sale_id, problema: issue.problema, detalhe: issue.detalhe });
}

function buildSalesValidationReport(
  sales: any[],
  items: any[],
  payments: any[],
  customers: any[],
  products: any[],
): SalesValidationReport {
  const customerIds = new Set(customers.map((c: any) => c.id));
  const productIds = new Set(products.map((p: any) => p.id));
  const saleIds = new Set(sales.map((s: any) => s.id));

  const rep: SalesValidationReport = {
    totalVendas: sales.length,
    vendasSemCliente: 0,
    vendasSemVendedor: 0,
    vendasSemItens: 0,
    vendasCanceladas: 0,
    valoresNegativos: 0,
    clientesInexistentes: 0,
    produtosInexistentes: 0,
    imeisDuplicados: 0,
    pagamentosOrfaos: 0,
    itensSemVenda: 0,
    totaisDivergentes: 0,
    pagamentosDivergentes: 0,
    itensNegativos: 0,
    quantidadeIncorreta: 0,
    erros: 0,
    avisos: 0,
    inconsistencias: 0,
    registrosAfetados: 0,
    percentualIntegridade: 100,
    amostra: [],
    detalhes: [],
  };

  const itemsBySale = new Map<string, any[]>();
  for (const it of items) {
    if (!saleIds.has(it.sale_id)) {
      rep.itensSemVenda++;
      pushIssue(rep, "erro", { sale_id: it.sale_id, registro_id: it.id, problema: "item sem venda", detalhe: it.product_name });
      continue;
    }
    if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
    itemsBySale.get(it.sale_id)!.push(it);
  }

  const paymentsBySale = new Map<string, any[]>();
  for (const p of payments) {
    if (!saleIds.has(p.sale_id)) {
      rep.pagamentosOrfaos++;
      pushIssue(rep, "erro", { sale_id: p.sale_id, registro_id: p.id, problema: "pagamento sem venda", detalhe: p.method });
      continue;
    }
    if (!paymentsBySale.has(p.sale_id)) paymentsBySale.set(p.sale_id, []);
    paymentsBySale.get(p.sale_id)!.push(p);
  }

  for (const s of sales) {
    const saleItems = itemsBySale.get(s.id) ?? [];
    const salePayments = paymentsBySale.get(s.id) ?? [];
    const saleTotal = num(s.total_amount);
    const itemsTotal = saleItems.reduce((sum, it) => sum + num(it.total || num(it.quantity) * num(it.unit_price)), 0);
    const paymentsTotal = salePayments.reduce((sum, p) => sum + num(p.amount), 0);

    if (!s.customer_id) {
      rep.vendasSemCliente++;
      pushIssue(rep, "aviso", { sale_id: s.id, problema: "venda sem cliente" });
    } else if (!customerIds.has(s.customer_id)) {
      rep.clientesInexistentes++;
      pushIssue(rep, "erro", { sale_id: s.id, problema: "cliente inexistente", detalhe: s.customer_id });
    }
    if (!(s.seller_id || s.user_id)) {
      rep.vendasSemVendedor++;
      pushIssue(rep, "aviso", { sale_id: s.id, problema: "venda sem vendedor" });
    }
    if (saleItems.length === 0) {
      rep.vendasSemItens++;
      pushIssue(rep, "erro", { sale_id: s.id, problema: "venda sem itens" });
    }
    if (s.status === "cancelled" || s.status === "canceled" || s.status === "cancelada") rep.vendasCanceladas++;
    if (saleTotal < 0) {
      rep.valoresNegativos++;
      pushIssue(rep, "erro", { sale_id: s.id, problema: "total negativo", detalhe: String(s.total_amount) });
    }
    for (const it of saleItems) {
      if (it.product_id && !productIds.has(it.product_id)) {
        rep.produtosInexistentes++;
        pushIssue(rep, "aviso", { sale_id: it.sale_id, registro_id: it.id, problema: "produto inexistente", detalhe: it.product_id });
      }
      if (num(it.total) < 0 || num(it.unit_price) < 0 || num(it.unit_cost) < 0) {
        rep.itensNegativos++;
        pushIssue(rep, "erro", { sale_id: it.sale_id, registro_id: it.id, problema: "item com valor negativo", detalhe: it.product_name });
      }
      if (num(it.quantity) <= 0) {
        rep.quantidadeIncorreta++;
        pushIssue(rep, "erro", { sale_id: it.sale_id, registro_id: it.id, problema: "quantidade incorreta", detalhe: String(it.quantity) });
      }
      const expectedItemTotal = num(it.quantity) * num(it.unit_price) - num(it.discount);
      if (it.total != null && !closeMoney(num(it.total), expectedItemTotal)) {
        rep.totaisDivergentes++;
        pushIssue(rep, "inconsistencia", { sale_id: it.sale_id, registro_id: it.id, problema: "total do item divergente", detalhe: `${round2(num(it.total))} ≠ ${round2(expectedItemTotal)}` });
      }
    }
    if (saleItems.length > 0) {
      const expectedSaleTotal = itemsTotal + num(s.addition) - num(s.discount);
      if (!closeMoney(saleTotal, expectedSaleTotal)) {
        rep.totaisDivergentes++;
        pushIssue(rep, "inconsistencia", { sale_id: s.id, problema: "total da venda divergente", detalhe: `${round2(saleTotal)} ≠ ${round2(expectedSaleTotal)}` });
      }
    }
    if (salePayments.length > 0 && !closeMoney(saleTotal, paymentsTotal)) {
      rep.pagamentosDivergentes++;
      pushIssue(rep, "inconsistencia", { sale_id: s.id, problema: "pagamentos diferentes do total da venda", detalhe: `${round2(paymentsTotal)} ≠ ${round2(saleTotal)}` });
    }
  }

  const imeiMap = new Map<string, number>();
  for (const it of items) if (it.imei) imeiMap.set(String(it.imei), (imeiMap.get(String(it.imei)) ?? 0) + 1);
  rep.imeisDuplicados = [...imeiMap.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
  if (rep.imeisDuplicados > 0) {
    pushIssue(rep, "aviso", { problema: "IMEIs duplicados", detalhe: `${rep.imeisDuplicados} ocorrências` });
  }

  rep.erros = (rep.detalhes ?? []).filter((d) => d.tipo === "erro").length;
  rep.avisos = (rep.detalhes ?? []).filter((d) => d.tipo === "aviso").length;
  rep.inconsistencias = (rep.detalhes ?? []).filter((d) => d.tipo === "inconsistencia").length;
  rep.registrosAfetados = new Set((rep.detalhes ?? []).map((d) => d.registro_id || d.sale_id || d.problema)).size;
  const base = Math.max(sales.length + items.length + payments.length, 1);
  rep.percentualIntegridade = Math.max(0, round2(100 - (rep.registrosAfetados / base) * 100));
  return rep;
}

// ── Validação ─────────────────────────────────────────
export async function validateSales(
  orgId: string | null,
  period?: BackupPeriod | null,
): Promise<SalesValidationReport> {
  const salesFilter = (q: any) => {
    if (period?.from) q = q.gte("created_at", period.from);
    if (period?.to) q = q.lte("created_at", period.to);
    return q;
  };
  const [salesAll, customers, products] = await Promise.all([
    fetchAll("sales_orders", orgId, salesFilter),
    fetchAll("customers", orgId),
    fetchAll("products", orgId),
  ]);
  const saleIds = new Set(salesAll.map((s: any) => s.id));
  const [itemsAll, paymentsAll] = await Promise.all([
    fetchAll("sale_items", orgId),
    fetchAll("sale_payments", orgId),
  ]);
  // Se houver filtro, restringe itens/pagamentos ao conjunto de vendas visível
  const items = period?.from || period?.to ? itemsAll.filter((it: any) => saleIds.has(it.sale_id)) : itemsAll;
  const payments = period?.from || period?.to ? paymentsAll.filter((p: any) => saleIds.has(p.sale_id)) : paymentsAll;
  return buildSalesValidationReport(salesAll, items, payments, customers, products);
}

// ── Expansão JSON ─────────────────────────────────────
function expandRows(rows: any[]): { rows: any[]; columns: string[] } {
  const keys = new Set<string>();
  const flat = rows.map((r) => {
    const o: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        for (const [sk, sv] of Object.entries(v as any)) {
          const key = `${k}.${sk}`;
          o[key] = sv;
          keys.add(key);
        }
      } else {
        o[k] = v;
        keys.add(k);
      }
    }
    return o;
  });
  return { rows: flat, columns: [...keys] };
}

// ── Layouts Premier ERP ───────────────────────────────
// Humanização de valores enumerados (padrão de migração ERP → ERP)
const STATUS_MAP: Record<string, string> = {
  completed: "Concluída",
  completa: "Concluída",
  paid: "Paga",
  pending: "Pendente",
  pendente: "Pendente",
  canceled: "Cancelada",
  cancelled: "Cancelada",
  cancelada: "Cancelada",
  refunded: "Estornada",
  draft: "Rascunho",
  open: "Em aberto",
};
const PAYMENT_MAP: Record<string, string> = {
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  pix: "Pix",
  credit_card: "Cartão de Crédito",
  credit: "Cartão de Crédito",
  cartao_credito: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  debit: "Cartão de Débito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  transfer: "Transferência",
  transferencia: "Transferência",
  crediario: "Crediário",
  voucher: "Voucher",
  other: "Outros",
};
const humanStatus = (v: any) => STATUS_MAP[String(v ?? "").toLowerCase()] ?? (v ? String(v) : "");
const humanPayment = (v: any) => PAYMENT_MAP[String(v ?? "").toLowerCase()] ?? (v ? String(v) : "");

// Extrai um campo de metadata JSON (usado para variação: cor, capacidade, etc.)
function meta(obj: any, ...keys: string[]) {
  if (!obj) return "";
  const m = typeof obj === "string" ? safeJson(obj) : obj;
  for (const k of keys) {
    if (m && m[k] != null && m[k] !== "") return String(m[k]);
  }
  return "";
}
function safeJson(s: string) { try { return JSON.parse(s); } catch { return null; } }

function saleUuid(s: any) {
  const stableKey = s.import_id || s.sale_number || s.id;
  return `conecta:${s.organization_id ?? "sem-empresa"}:sale:${stableKey}`;
}
function itemUuid(it: any, s: any) {
  const base = s ? saleUuid(s) : `conecta:${it.organization_id ?? "sem-empresa"}:sale:${it.sale_id}`;
  return `${base}:item:${it.id}`;
}
function paymentUuid(p: any, s: any) {
  const base = s ? saleUuid(s) : `conecta:${p.organization_id ?? "sem-empresa"}:sale:${p.sale_id}`;
  return `${base}:pay:${p.id}`;
}

function yesNo(v: boolean) {
  return v ? "Sim" : "Não";
}

function productKind(product: any, item: any) {
  const text = `${product?.category ?? ""} ${product?.name ?? ""} ${item?.product_name ?? ""}`.toLowerCase();
  if (text.includes("servi") || text.includes("reparo") || text.includes("assistência") || text.includes("mao de obra") || text.includes("mão de obra")) return "servico";
  if (product?.has_imei || item?.imei || text.includes("iphone") || text.includes("samsung") || text.includes("galaxy") || text.includes("smartphone") || text.includes("celular")) return "aparelho";
  return "acessorio";
}

function buildSaleAnalytics(sales: any[], items: any[], payments: any[], prodMap: Map<string, any>) {
  const itemsBySale = new Map<string, any[]>();
  for (const it of items) {
    if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
    itemsBySale.get(it.sale_id)!.push(it);
  }
  const paymentsBySale = new Map<string, any[]>();
  for (const p of payments) {
    if (!paymentsBySale.has(p.sale_id)) paymentsBySale.set(p.sale_id, []);
    paymentsBySale.get(p.sale_id)!.push(p);
  }
  const stats = new Map<string, any>();
  for (const s of sales) {
    const saleItems = itemsBySale.get(s.id) ?? [];
    const salePayments = paymentsBySale.get(s.id) ?? [];
    let quantidadeItens = 0;
    let quantidadeAparelhos = 0;
    let quantidadeAcessorios = 0;
    let totalProdutos = 0;
    let totalServicos = 0;
    let totalDescontosItens = 0;
    let totalCusto = 0;
    for (const it of saleItems) {
      const q = num(it.quantity);
      const total = num(it.total || q * num(it.unit_price));
      const p = it.product_id ? prodMap.get(it.product_id) : null;
      const kind = productKind(p, it);
      quantidadeItens += q;
      if (kind === "aparelho") quantidadeAparelhos += q;
      else if (kind === "servico") totalServicos += total;
      else quantidadeAcessorios += q;
      if (kind !== "servico") totalProdutos += total;
      totalDescontosItens += num(it.discount);
      totalCusto += num(it.unit_cost ?? p?.cost_price) * q;
    }
    const total = num(s.total_amount);
    const totalPagamentos = salePayments.reduce((sum, p) => sum + num(p.amount), 0);
    const paymentTotals = new Map<string, number>();
    for (const p of salePayments) paymentTotals.set(p.method, (paymentTotals.get(p.method) ?? 0) + num(p.amount));
    const principalCode = [...paymentTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? s.payment_method ?? "";
    const formas = new Set(salePayments.map((p) => p.method).filter(Boolean));
    const lucro = s.profit != null ? num(s.profit) : total - totalCusto;
    stats.set(s.id, {
      items: saleItems,
      payments: salePayments,
      quantidadeItens,
      quantidadeAparelhos,
      quantidadeAcessorios,
      totalProdutos,
      totalServicos,
      totalDescontos: num(s.discount) + totalDescontosItens,
      totalPagamentos,
      saldo: total - totalPagamentos,
      lucro,
      margem: total ? (lucro / total) * 100 : 0,
      pagamentoPrincipal: humanPayment(principalCode),
      quantidadeFormasPagamento: formas.size || (s.payment_method ? 1 : 0),
      pagamentoMisto: formas.size > 1,
      vendaParcelada: salePayments.some((p) => num(p.installments) > 1),
    });
  }
  return { stats, itemsBySale, paymentsBySale };
}

function toPremierSales(
  sales: any[],
  custMap: Map<string, any>,
  sellerMap: Map<string, any>,
  orgMap: Map<string, any>,
  analytics: Map<string, any>,
) {
  const cols = [
    // legado (mantido para compatibilidade)
    "sale_id", "numero_venda", "data", "hora", "status", "cliente_id", "cliente_nome",
    "cliente_documento", "vendedor_id", "empresa_id", "loja_id", "canal_venda", "origem",
    "subtotal", "desconto", "acrescimo", "frete", "total", "lucro", "margem", "observacoes",
    // novos campos (opcionais / humanizados)
    "sale_uuid",
    "status_codigo", "status_nome",
    "vendedor_nome", "empresa_nome", "loja_nome",
    "cliente_telefone", "cliente_email", "cliente_cidade", "cliente_estado", "cliente_cpf_cnpj",
    "forma_pagamento_codigo", "forma_pagamento_nome",
    "quantidade_itens", "quantidade_aparelhos", "quantidade_acessorios",
    "total_produtos", "total_servicos", "total_descontos", "total_pagamentos", "saldo",
    "pagamento_principal", "quantidade_formas_pagamento", "pagamento_misto", "venda_parcelada",
  ];
  const rows = sales.map((s) => {
    const c = s.customer_id ? custMap.get(s.customer_id) : null;
    const sellerId = s.seller_id ?? s.user_id ?? "";
    const seller = sellerId ? sellerMap.get(sellerId) : null;
    const org = s.organization_id ? orgMap.get(s.organization_id) : null;
    const storeId = s.store_id ?? s.organization_id ?? "";
    const store = storeId ? orgMap.get(storeId) : null;
    const dt = s.created_at ? new Date(s.created_at) : null;
    const rawStatus = s.status ?? "";
    const rawPay = s.payment_method ?? "";
    const a = analytics.get(s.id) ?? {};
    return {
      sale_id: s.id,
      numero_venda: s.sale_number ?? "",
      data: dt ? dt.toISOString().slice(0, 10) : "",
      hora: dt ? dt.toISOString().slice(11, 19) : "",
      status: rawStatus,
      cliente_id: s.customer_id ?? "",
      cliente_nome: c?.name ?? "",
      cliente_documento: c?.document ?? "",
      vendedor_id: sellerId,
      empresa_id: s.organization_id ?? "",
      loja_id: storeId,
      canal_venda: s.channel ?? "loja",
      origem: s.origin ?? s.source ?? "",
      subtotal: s.subtotal ?? 0,
      desconto: s.discount ?? 0,
      acrescimo: s.addition ?? 0,
      frete: s.shipping ?? 0,
      total: s.total_amount ?? 0,
      lucro: s.profit ?? round2(a.lucro ?? 0),
      margem: s.margin ?? round2(a.margem ?? 0),
      observacoes: s.notes ?? "",
      // novos
      status_codigo: rawStatus,
      status_nome: humanStatus(rawStatus),
      vendedor_nome: seller?.display_name ?? seller?.nome ?? seller?.email ?? "",
      empresa_nome: org?.name ?? "",
      loja_nome: store?.name ?? org?.name ?? "",
      cliente_telefone: c?.phone ?? "",
      cliente_email: c?.email ?? "",
      cliente_cidade: c?.city ?? "",
      cliente_estado: c?.state ?? "",
      cliente_cpf_cnpj: c?.document ?? "",
      forma_pagamento_codigo: rawPay,
      forma_pagamento_nome: humanPayment(rawPay),
      sale_uuid: saleUuid(s),
      quantidade_itens: a.quantidadeItens ?? 0,
      quantidade_aparelhos: a.quantidadeAparelhos ?? 0,
      quantidade_acessorios: a.quantidadeAcessorios ?? 0,
      total_produtos: round2(a.totalProdutos ?? 0),
      total_servicos: round2(a.totalServicos ?? 0),
      total_descontos: round2(a.totalDescontos ?? num(s.discount)),
      total_pagamentos: round2(a.totalPagamentos ?? 0),
      saldo: round2(a.saldo ?? num(s.total_amount)),
      pagamento_principal: a.pagamentoPrincipal ?? humanPayment(rawPay),
      quantidade_formas_pagamento: a.quantidadeFormasPagamento ?? (rawPay ? 1 : 0),
      pagamento_misto: yesNo(!!a.pagamentoMisto),
      venda_parcelada: yesNo(!!a.vendaParcelada),
    };
  });
  return { rows, columns: cols };
}

function toPremierItems(
  items: any[],
  prodMap: Map<string, any>,
  supplierMap: Map<string, any>,
  saleMap: Map<string, any>,
) {
  const cols = [
    // legado
    "item_id", "sale_id", "produto_id", "produto_nome", "sku", "imei", "categoria",
    "marca", "quantidade", "valor_unitario", "custo_unitario", "desconto", "acrescimo",
    "subtotal", "garantia_meses",
    // novos
    "item_uuid", "sale_uuid", "empresa_id", "loja_id", "cliente_id", "vendedor_id",
    "fornecedor_nome", "fornecedor_documento", "categoria_nome",
    "modelo", "capacidade", "cor", "código_barras", "serial", "garantia",
    "custo", "preço_venda", "lucro_item", "margem_item",
  ];
  const rows = items.map((it) => {
    const p = it.product_id ? prodMap.get(it.product_id) : null;
    const s = it.sale_id ? saleMap.get(it.sale_id) : null;
    const supplier = p?.supplier_id ? supplierMap.get(p.supplier_id) : null;
    const q = Number(it.quantity ?? 0);
    const u = Number(it.unit_price ?? 0);
    const cost = num(it.unit_cost ?? p?.cost_price);
    const subtotal = num(it.total ?? q * u);
    const lucroItem = subtotal - cost * q;
    const md = it.metadata ?? {};
    const cor = meta(md, "cor", "color") || (p?.color ?? "");
    const cap = meta(md, "capacidade", "gb", "storage") || (p?.storage ?? p?.capacity ?? "");
    const modelo = meta(md, "modelo", "model") || (p?.model ?? "");
    const serial = meta(md, "serial", "sn") || (it.serial ?? "");
    const garantiaMeses = it.warranty_months ?? p?.warranty_months ?? "";
    return {
      item_id: it.id,
      sale_id: it.sale_id,
      produto_id: it.product_id ?? "",
      produto_nome: it.product_name ?? p?.name ?? "",
      sku: it.sku ?? p?.sku ?? "",
      imei: it.imei ?? "",
      categoria: p?.category ?? "",
      marca: p?.brand ?? "",
      quantidade: q,
      valor_unitario: u,
      custo_unitario: cost,
      desconto: it.discount ?? 0,
      acrescimo: it.addition ?? 0,
      subtotal,
      garantia_meses: garantiaMeses,
      // novos
      item_uuid: itemUuid(it, s),
      sale_uuid: s ? saleUuid(s) : "",
      empresa_id: it.organization_id ?? s?.organization_id ?? "",
      loja_id: s?.store_id ?? s?.organization_id ?? it.organization_id ?? "",
      cliente_id: s?.customer_id ?? "",
      vendedor_id: s?.seller_id ?? s?.user_id ?? "",
      fornecedor_nome: supplier?.name ?? p?.supplier ?? "",
      fornecedor_documento: supplier?.document ?? supplier?.cnpj ?? "",
      categoria_nome: p?.category ?? "",
      modelo,
      capacidade: cap,
      cor,
      "código_barras": p?.ean ?? meta(md, "ean", "barcode", "codigo_barras") ?? "",
      serial,
      garantia: garantiaMeses ? `${garantiaMeses} meses` : "",
      custo: cost,
      preço_venda: u,
      lucro_item: round2(lucroItem),
      margem_item: subtotal ? round2((lucroItem / subtotal) * 100) : 0,
    };
  });
  return { rows, columns: cols };
}

function toPremierPayments(payments: any[], saleMap: Map<string, any>) {
  const cols = [
    // legado
    "pagamento_id", "sale_id", "forma_pagamento", "parcelas", "valor", "taxa",
    "data", "status", "autorizacao", "nsu",
    // novos
    "payment_uuid", "sale_uuid", "empresa_id", "loja_id", "cliente_id", "vendedor_id",
    "sequencia", "forma_pagamento_codigo", "forma_pagamento_nome",
    "adquirente", "bandeira", "tid", "data_pagamento",
  ];
  const seq = new Map<string, number>();
  const rows = payments.map((p) => {
    const raw = p.method ?? "";
    const s = p.sale_id ? saleMap.get(p.sale_id) : null;
    const n = (seq.get(p.sale_id) ?? 0) + 1;
    seq.set(p.sale_id, n);
    const dt = p.paid_at ?? p.created_at ?? "";
    return {
      pagamento_id: p.id,
      sale_id: p.sale_id,
      forma_pagamento: raw,
      parcelas: p.installments ?? 1,
      valor: p.amount ?? 0,
      taxa: p.fee_amount ?? 0,
      data: dt,
      status: p.status ?? (p.paid_at ? "pago" : "pendente"),
      autorizacao: p.authorization ?? "",
      nsu: p.nsu ?? p.reference ?? "",
      // novos
      payment_uuid: paymentUuid(p, s),
      sale_uuid: s ? saleUuid(s) : "",
      empresa_id: p.organization_id ?? s?.organization_id ?? "",
      loja_id: s?.store_id ?? s?.organization_id ?? p.organization_id ?? "",
      cliente_id: s?.customer_id ?? "",
      vendedor_id: s?.seller_id ?? s?.user_id ?? "",
      sequencia: n,
      forma_pagamento_codigo: raw,
      forma_pagamento_nome: humanPayment(raw),
      adquirente: p.acquirer ?? p.provider ?? "",
      bandeira: p.brand ?? p.card_brand ?? "",
      tid: p.tid ?? p.transaction_id ?? "",
      data_pagamento: dt ? String(dt).slice(0, 10) : "",
    };
  });
  return { rows, columns: cols };
}

// README humanizado para o pacote Premier
function buildReadme(meta: {
  suffix: string;
  vendas: number;
  itens: number;
  pagamentos: number;
  totalVendido: number;
  empresa: string;
  usuario: string;
  periodo: string;
}) {
  return `# Exportação ConectaPhone → Premier ERP

**Modo:** ${meta.suffix}
**Gerado em:** ${new Date().toLocaleString("pt-BR")}
**Empresa:** ${meta.empresa}
**Usuário:** ${meta.usuario}
**Período:** ${meta.periodo}

## Arquivos incluídos

| Arquivo          | Descrição                                                       |
|------------------|-----------------------------------------------------------------|
| \`vendas.csv\`     | Cabeçalho das vendas (${meta.vendas} registros).                    |
| \`itens.csv\`      | Itens vendidos, com produto, IMEI, cor, capacidade (${meta.itens}). |
| \`pagamentos.csv\` | Formas de pagamento aplicadas a cada venda (${meta.pagamentos}).    |
| \`manifest.json\`  | Metadados da exportação e totais.                                 |
| \`README.md\`      | Este arquivo.                                                     |

## Relacionamentos

Todos os arquivos são ligados pela coluna **\`sale_id\`** (UUID único da venda).

\`\`\`
vendas.sale_id  ──┬──  itens.sale_id
                  └──  pagamentos.sale_id
\`\`\`

Colunas adicionais para localização cruzada:
- \`cliente_id\` + \`cliente_nome\` + \`cliente_documento\`
- \`vendedor_id\` + \`vendedor_nome\`
- \`empresa_id\` + \`empresa_nome\`
- \`loja_id\` + \`loja_nome\`
- \`produto_id\` + \`produto_nome\` + \`sku\` + \`imei\`

## Humanização de códigos

Valores internos (ex.: \`completed\`, \`pix\`, \`credit_card\`) são exportados
tanto na coluna original quanto em uma coluna \`*_nome\` legível
(\`status_nome\`, \`forma_pagamento_nome\`).

## Compatibilidade

- Todas as colunas antigas foram preservadas.
- Novas colunas são opcionais — imports antigos continuam funcionando.
- Encoding: UTF-8 com BOM. Separador: \`;\`. Excel BR abre direto.

Total geral vendido: **${meta.totalVendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}**
`;
}

function buildPremierImportMap() {
  return {
    versao: "premier-erp/plug-and-play-1.0",
    sistema_origem: "ConectaPhone",
    destino_sugerido: "Premier ERP",
    chave_global: "sale_uuid",
    regra_chave_global: "conecta:{empresa_id}:sale:{numero/import_id/id}",
    arquivos: {
      "vendas.csv": {
        entidade: "vendas",
        chave_primaria: "sale_uuid",
        chaves_alternativas: ["sale_id", "numero_venda"],
        colunas_recomendadas: [
          "sale_uuid", "sale_id", "numero_venda", "data", "hora", "status_codigo", "status_nome",
          "cliente_id", "cliente_nome", "cliente_documento", "vendedor_id", "vendedor_nome",
          "empresa_id", "empresa_nome", "loja_id", "loja_nome", "total", "lucro", "margem",
          "pagamento_misto", "venda_parcelada", "total_pagamentos", "saldo",
        ],
        relacionamentos: {
          clientes: "cliente_id",
          vendedores: "vendedor_id",
          empresas: "empresa_id",
          lojas: "loja_id",
          itens: "sale_uuid",
          pagamentos: "sale_uuid",
        },
      },
      "itens.csv": {
        entidade: "itens_da_venda",
        chave_primaria: "item_id",
        chave_venda: "sale_uuid",
        colunas_recomendadas: [
          "item_id", "sale_uuid", "sale_id", "produto_id", "produto_nome", "sku", "imei", "serial",
          "marca", "modelo", "capacidade", "cor", "código_barras", "fornecedor_nome",
          "fornecedor_documento", "quantidade", "valor_unitario", "custo_unitario", "subtotal", "lucro_item", "margem_item",
        ],
        relacionamentos: {
          vendas: "sale_uuid",
          produtos: "produto_id",
          clientes: "cliente_id",
          fornecedores: "fornecedor_documento",
        },
      },
      "pagamentos.csv": {
        entidade: "pagamentos_da_venda",
        chave_primaria: "pagamento_id",
        chave_venda: "sale_uuid",
        colunas_recomendadas: [
          "pagamento_id", "sale_uuid", "sale_id", "forma_pagamento_codigo", "forma_pagamento_nome",
          "parcelas", "valor", "taxa", "data", "status", "autorizacao", "nsu", "adquirente", "bandeira",
        ],
        relacionamentos: {
          vendas: "sale_uuid",
          clientes: "cliente_id",
          lojas: "loja_id",
        },
      },
    },
    observacoes: [
      "Importe vendas.csv antes de itens.csv e pagamentos.csv.",
      "Use sale_uuid como chave estável para evitar duplicidades em reimportações.",
      "Campos *_codigo preservam o valor original; campos *_nome trazem o texto humanizado.",
      "validation_report.json deve ser conferido antes da importação final.",
    ],
  };
}

// FNV-1a 32-bit → hex de 8 chars. Suficiente como "checksum" leve para o manifest.
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ── Export principal ──────────────────────────────────
export async function exportSales(
  orgId: string | null,
  mode: SalesExportMode,
  format: "csv" | "xlsx" | "zip",
  period?: BackupPeriod | null,
): Promise<SalesExportResult> {
  const t0 = performance.now();
  const salesFilter = (q: any) => {
    if (period?.from) q = q.gte("created_at", period.from);
    if (period?.to) q = q.lte("created_at", period.to);
    return q;
  };
  const [salesAll, itemsAll, paymentsAll, customers, products, suppliers, sellers, orgs] = await Promise.all([
    fetchAll("sales_orders", orgId, salesFilter),
    fetchAll("sale_items", orgId),
    fetchAll("sale_payments", orgId),
    fetchAll("customers", orgId),
    fetchAll("products", orgId),
    fetchAll("suppliers", orgId),
    // vendedores e organizações — não têm organization_id da mesma forma; ignoramos orgId
    (async () => {
      const { data } = await (supabase as any).from("profiles").select("id, nome, display_name, email");
      return data ?? [];
    })(),
    (async () => {
      const { data } = await (supabase as any).from("organizations").select("id, name");
      return data ?? [];
    })(),
  ]);
  const sales = salesAll;
  const saleIds = new Set(sales.map((s: any) => s.id));
  const items = period?.from || period?.to ? itemsAll.filter((it: any) => saleIds.has(it.sale_id)) : itemsAll;
  const payments = period?.from || period?.to ? paymentsAll.filter((p: any) => saleIds.has(p.sale_id)) : paymentsAll;
  const custMap = new Map(customers.map((c: any) => [c.id, c]));
  const prodMap = new Map(products.map((p: any) => [p.id, p]));
  const supplierMap = new Map(suppliers.map((s: any) => [s.id, s]));
  const saleMap = new Map(sales.map((s: any) => [s.id, s]));
  const sellerMap = new Map((sellers as any[]).map((s: any) => [s.id, s]));
  const orgMap = new Map((orgs as any[]).map((o: any) => [o.id, o]));
  const { stats: saleAnalytics } = buildSaleAnalytics(sales, items, payments, prodMap);
  const validationReport = buildSalesValidationReport(sales, items, payments, customers, products);
  const totalVendido = sales.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);

  const empresaAtual = orgId ? (orgMap.get(orgId)?.name ?? orgId) : "todas as lojas";
  const datas = sales.map((s: any) => s.created_at).filter(Boolean).sort();
  const periodo = datas.length
    ? `${new Date(datas[0]).toLocaleDateString("pt-BR")} → ${new Date(datas[datas.length - 1]).toLocaleDateString("pt-BR")}`
    : "todo o histórico";

  let sheets: Array<{ name: string; rows: any[]; columns: string[] }>;
  let suffix = mode;

  if (mode === "premier") {
    // Reduzimos aos IDs efetivamente usados nas vendas para manter o pacote enxuto.
    const usedCustomerIds = new Set(sales.map((s: any) => s.customer_id).filter(Boolean));
    const usedProductIds = new Set(items.map((it: any) => it.product_id).filter(Boolean));
    const usedSellerIds = new Set(sales.map((s: any) => s.seller_id ?? s.user_id).filter(Boolean));
    const usedStoreIds = new Set(sales.map((s: any) => s.store_id ?? s.organization_id).filter(Boolean));

    const customersRows = customers
      .filter((c: any) => usedCustomerIds.has(c.id))
      .map((c: any) => ({
        cliente_id: c.id,
        nome: c.name ?? "",
        documento: c.document ?? "",
        cpf_cnpj: c.document ?? "",
        email: c.email ?? "",
        telefone: c.phone ?? "",
        cidade: c.city ?? "",
        estado: c.state ?? "",
        endereco: c.address ?? "",
        cep: c.zip_code ?? c.cep ?? "",
        empresa_id: c.organization_id ?? "",
      }));

    const productsRows = products
      .filter((p: any) => usedProductIds.has(p.id))
      .map((p: any) => ({
        produto_id: p.id,
        sku: p.sku ?? "",
        codigo_barras: p.ean ?? "",
        nome: p.name ?? "",
        marca: p.brand ?? "",
        modelo: p.model ?? "",
        categoria: p.category ?? "",
        capacidade: p.storage ?? p.capacity ?? "",
        cor: p.color ?? "",
        custo: p.cost_price ?? 0,
        preco_venda: p.sale_price ?? p.price ?? 0,
        estoque: p.stock_quantity ?? 0,
        fornecedor_id: p.supplier_id ?? "",
        empresa_id: p.organization_id ?? "",
      }));

    const sellersRows = (sellers as any[])
      .filter((s: any) => usedSellerIds.has(s.id))
      .map((s: any) => ({
        vendedor_id: s.id,
        nome: s.display_name ?? s.nome ?? s.email ?? "",
        email: s.email ?? "",
      }));

    const storesRows = (orgs as any[])
      .filter((o: any) => usedStoreIds.has(o.id))
      .map((o: any) => ({
        loja_id: o.id,
        nome: o.name ?? "",
      }));

    sheets = [
      { name: "sales", ...toPremierSales(sales, custMap, sellerMap, orgMap, saleAnalytics) },
      { name: "sale_items", ...toPremierItems(items, prodMap, supplierMap, saleMap) },
      { name: "sale_payments", ...toPremierPayments(payments, saleMap) },
      { name: "customers", rows: customersRows, columns: customersRows.length ? Object.keys(customersRows[0]) : ["cliente_id","nome","documento","cpf_cnpj","email","telefone","cidade","estado","endereco","cep","empresa_id"] },
      { name: "products", rows: productsRows, columns: productsRows.length ? Object.keys(productsRows[0]) : ["produto_id","sku","codigo_barras","nome","marca","modelo","categoria","capacidade","cor","custo","preco_venda","estoque","fornecedor_id","empresa_id"] },
      { name: "sellers", rows: sellersRows, columns: sellersRows.length ? Object.keys(sellersRows[0]) : ["vendedor_id","nome","email"] },
      { name: "stores", rows: storesRows, columns: storesRows.length ? Object.keys(storesRows[0]) : ["loja_id","nome"] },
    ];
    suffix = "premier";
  } else if (mode === "expandida") {
    const s = expandRows(sales);
    const i = expandRows(items);
    const p = expandRows(payments);
    sheets = [
      { name: "vendas", rows: s.rows, columns: s.columns },
      { name: "itens", rows: i.rows, columns: i.columns },
      { name: "pagamentos", rows: p.rows, columns: p.columns },
    ];
  } else {
    sheets = [
      { name: "vendas", rows: sales, columns: sales.length ? Object.keys(sales[0]) : [] },
      { name: "itens", rows: items, columns: items.length ? Object.keys(items[0]) : [] },
      { name: "pagamentos", rows: payments, columns: payments.length ? Object.keys(payments[0]) : [] },
    ];
  }

  const stamp = new Date().toISOString().slice(0, 10);
  let filename = "";
  let bytes = 0;

  // Usuário atual (para manifest / README)
  let usuarioLabel = "—";
  try {
    const { data } = await supabase.auth.getUser();
    usuarioLabel = (data?.user as any)?.user_metadata?.full_name || data?.user?.email || "usuário";
  } catch { /* ignore */ }

  // Hash de integridade simples (fnv-1a sobre concatenação de sale_ids)
  const integrityHash = fnv1a(sales.map((s: any) => s.id).join("|"));

  const manifest = {
    versao_exportador: "3.5",
    versao_schema: mode === "premier" ? "premier-erp/plug-and-play-1.0" : "premier-erp/1.1",
    modo: suffix,
    formato: format,
    empresa: empresaAtual,
    empresa_id: orgId ?? null,
    periodo,
    data_exportacao: new Date().toISOString(),
    usuario: usuarioLabel,
    quantidade_vendas: sales.length,
    quantidade_itens: items.length,
    quantidade_pagamentos: payments.length,
    total_vendido: totalVendido,
    hash_integridade: integrityHash,
    validacao: {
      erros: validationReport.erros,
      avisos: validationReport.avisos,
      inconsistencias: validationReport.inconsistencias,
      registros_afetados: validationReport.registrosAfetados,
      percentual_integridade: validationReport.percentualIntegridade,
      vendas_sem_cliente: validationReport.vendasSemCliente,
      vendas_sem_itens: validationReport.vendasSemItens,
      clientes_inexistentes: validationReport.clientesInexistentes,
      produtos_inexistentes: validationReport.produtosInexistentes,
      totais_divergentes: validationReport.totaisDivergentes,
      pagamentos_divergentes: validationReport.pagamentosDivergentes,
    },
    arquivos: sheets.map((sh) => ({
      nome: `${sh.name}.csv`,
      registros: sh.rows.length,
      colunas: sh.columns.length,
      colunas_lista: sh.columns,
    })),
    // Legado
    gerado_em: new Date().toISOString(),
    vendas: sales.length,
    itens: items.length,
    pagamentos: payments.length,
  };

  if (format === "xlsx") {
    // 3 abas em 1 workbook
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const ws = XLSX.utils.json_to_sheet(sh.rows, { header: sh.columns });
      XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    }
    const readmeRows = Object.entries(manifest).map(([campo, valor]) => ({ campo, valor: String(valor) }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readmeRows), "README");
    filename = `vendas-${suffix}-${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    bytes = sales.length * 300;
  } else if (format === "zip") {
    const zip = new JSZip();
    const csvFiles = sheets.map((sh) => ({ ...sh, arquivo: `${sh.name}.csv`, csv: rowsToCsv(sh.rows, sh.columns) }));
    for (const sh of csvFiles) zip.file(sh.arquivo, sh.csv);
    const zipManifest = {
      ...manifest,
      arquivos: csvFiles.map((sh) => ({
        nome: sh.arquivo,
        registros: sh.rows.length,
        colunas: sh.columns.length,
        checksum_fnv1a: fnv1a(sh.csv),
        colunas_lista: sh.columns,
      })),
    };
    zip.file("manifest.json", JSON.stringify(zipManifest, null, 2));
    if (mode === "premier") {
      zip.file("validation_report.json", JSON.stringify(validationReport, null, 2));
      zip.file("import_map.json", JSON.stringify(buildPremierImportMap(), null, 2));
      const customersSheet = csvFiles.find((s) => s.name === "customers");
      const productsSheet = csvFiles.find((s) => s.name === "products");
      const premierReady = {
        versao_layout: "premier-erp/plug-and-play-1.0",
        hash: integrityHash,
        empresa: empresaAtual,
        empresa_id: orgId ?? null,
        periodo,
        quantidade_vendas: sales.length,
        quantidade_itens: items.length,
        quantidade_pagamentos: payments.length,
        quantidade_clientes: customersSheet?.rows.length ?? 0,
        quantidade_produtos: productsSheet?.rows.length ?? 0,
        integridade_percentual: validationReport.percentualIntegridade,
        data_exportacao: new Date().toISOString(),
        arquivos: csvFiles.map((s) => s.arquivo),
      };
      zip.file("premier_ready.json", JSON.stringify(premierReady, null, 2));
      zip.file("README.md", buildReadme({
        suffix,
        vendas: sales.length,
        itens: items.length,
        pagamentos: payments.length,
        totalVendido,
        empresa: empresaAtual,
        usuario: usuarioLabel,
        periodo,
      }));
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    bytes = blob.size;
    filename = `vendas-${suffix}-${stamp}.zip`;
    triggerBlob(filename, blob);
  } else {
    // CSV único = concatena as 3 abas em 1 (não ideal); melhor exportar apenas "vendas"
    const csv = rowsToCsv(sheets[0].rows, sheets[0].columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    bytes = blob.size;
    filename = `vendas-${suffix}-${stamp}.csv`;
    triggerBlob(filename, blob);
  }

  return {
    filename,
    vendas: sales.length,
    itens: items.length,
    pagamentos: payments.length,
    totalVendido,
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
