// Exportação Completa de Vendas — SOMENTE LEITURA.
import { supabase } from "@/integrations/supabase/client";
import { rowsToCsv } from "./csv";
import { downloadXlsx } from "./xlsx";
import JSZip from "jszip";

export type SalesExportMode = "padrao" | "expandida" | "premier";

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
export async function validateSales(orgId: string | null): Promise<SalesValidationReport> {
  const [sales, items, payments, customers, products] = await Promise.all([
    fetchAll("sales_orders", orgId),
    fetchAll("sale_items", orgId),
    fetchAll("sale_payments", orgId),
    fetchAll("customers", orgId),
    fetchAll("products", orgId),
  ]);
  return buildSalesValidationReport(sales, items, payments, customers, products);
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

function toPremierSales(
  sales: any[],
  custMap: Map<string, any>,
  sellerMap: Map<string, any>,
  orgMap: Map<string, any>,
) {
  const cols = [
    // legado (mantido para compatibilidade)
    "sale_id", "numero_venda", "data", "hora", "status", "cliente_id", "cliente_nome",
    "cliente_documento", "vendedor_id", "empresa_id", "loja_id", "canal_venda", "origem",
    "subtotal", "desconto", "acrescimo", "frete", "total", "lucro", "margem", "observacoes",
    // novos campos (opcionais / humanizados)
    "status_codigo", "status_nome",
    "vendedor_nome", "empresa_nome", "loja_nome",
    "cliente_telefone", "cliente_email", "cliente_cidade", "cliente_estado", "cliente_cpf_cnpj",
    "forma_pagamento_codigo", "forma_pagamento_nome",
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
      lucro: s.profit ?? "",
      margem: s.margin ?? "",
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
    };
  });
  return { rows, columns: cols };
}

function toPremierItems(items: any[], prodMap: Map<string, any>) {
  const cols = [
    // legado
    "item_id", "sale_id", "produto_id", "produto_nome", "sku", "imei", "categoria",
    "marca", "quantidade", "valor_unitario", "custo_unitario", "desconto", "acrescimo",
    "subtotal", "garantia_meses",
    // novos
    "modelo", "capacidade", "cor", "serial", "garantia",
  ];
  const rows = items.map((it) => {
    const p = it.product_id ? prodMap.get(it.product_id) : null;
    const q = Number(it.quantity ?? 0);
    const u = Number(it.unit_price ?? 0);
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
      custo_unitario: it.unit_cost ?? 0,
      desconto: it.discount ?? 0,
      acrescimo: it.addition ?? 0,
      subtotal: it.total ?? q * u,
      garantia_meses: garantiaMeses,
      // novos
      modelo,
      capacidade: cap,
      cor,
      serial,
      garantia: garantiaMeses ? `${garantiaMeses} meses` : "",
    };
  });
  return { rows, columns: cols };
}

function toPremierPayments(payments: any[]) {
  const cols = [
    // legado
    "pagamento_id", "sale_id", "forma_pagamento", "parcelas", "valor", "taxa",
    "data", "status", "autorizacao", "nsu",
    // novos
    "forma_pagamento_codigo", "forma_pagamento_nome",
    "adquirente", "bandeira",
  ];
  const rows = payments.map((p) => {
    const raw = p.method ?? "";
    return {
      pagamento_id: p.id,
      sale_id: p.sale_id,
      forma_pagamento: raw,
      parcelas: p.installments ?? 1,
      valor: p.amount ?? 0,
      taxa: p.fee_amount ?? 0,
      data: p.paid_at ?? p.created_at ?? "",
      status: p.status ?? (p.paid_at ? "pago" : "pendente"),
      autorizacao: p.authorization ?? "",
      nsu: p.nsu ?? p.reference ?? "",
      // novos
      forma_pagamento_codigo: raw,
      forma_pagamento_nome: humanPayment(raw),
      adquirente: p.acquirer ?? p.provider ?? "",
      bandeira: p.brand ?? p.card_brand ?? "",
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
): Promise<SalesExportResult> {
  const t0 = performance.now();
  const [sales, items, payments, customers, products, sellers, orgs] = await Promise.all([
    fetchAll("sales_orders", orgId),
    fetchAll("sale_items", orgId),
    fetchAll("sale_payments", orgId),
    fetchAll("customers", orgId),
    fetchAll("products", orgId),
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
  const custMap = new Map(customers.map((c: any) => [c.id, c]));
  const prodMap = new Map(products.map((p: any) => [p.id, p]));
  const sellerMap = new Map((sellers as any[]).map((s: any) => [s.id, s]));
  const orgMap = new Map((orgs as any[]).map((o: any) => [o.id, o]));
  const totalVendido = sales.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);

  const empresaAtual = orgId ? (orgMap.get(orgId)?.name ?? orgId) : "todas as lojas";
  const datas = sales.map((s: any) => s.created_at).filter(Boolean).sort();
  const periodo = datas.length
    ? `${new Date(datas[0]).toLocaleDateString("pt-BR")} → ${new Date(datas[datas.length - 1]).toLocaleDateString("pt-BR")}`
    : "todo o histórico";

  let sheets: Array<{ name: string; rows: any[]; columns: string[] }>;
  let suffix = mode;

  if (mode === "premier") {
    sheets = [
      { name: "vendas", ...toPremierSales(sales, custMap, sellerMap, orgMap) },
      { name: "itens", ...toPremierItems(items, prodMap) },
      { name: "pagamentos", ...toPremierPayments(payments) },
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
    versao_schema: "premier-erp/1.1",
    modo: suffix,
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
    for (const sh of sheets) zip.file(`${sh.name}.csv`, rowsToCsv(sh.rows, sh.columns));
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    if (mode === "premier") {
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
