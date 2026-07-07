// Exportação Completa de Vendas — SOMENTE LEITURA.
import { supabase } from "@/integrations/supabase/client";
import { rowsToCsv } from "./csv";
import { downloadXlsx } from "./xlsx";
import JSZip from "jszip";

export type SalesExportMode = "padrao" | "expandida" | "premier";

export interface SalesValidationReport {
  totalVendas: number;
  vendasSemCliente: number;
  vendasSemItens: number;
  vendasCanceladas: number;
  valoresNegativos: number;
  clientesInexistentes: number;
  produtosInexistentes: number;
  imeisDuplicados: number;
  pagamentosOrfaos: number;
  amostra: Array<{ sale_id?: string; problema: string; detalhe?: string }>;
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

// ── Validação ─────────────────────────────────────────
export async function validateSales(orgId: string | null): Promise<SalesValidationReport> {
  const [sales, items, payments, customers, products] = await Promise.all([
    fetchAll("sales_orders", orgId),
    fetchAll("sale_items", orgId),
    fetchAll("sale_payments", orgId),
    fetchAll("customers", orgId),
    fetchAll("products", orgId),
  ]);
  const customerIds = new Set(customers.map((c: any) => c.id));
  const productIds = new Set(products.map((p: any) => p.id));
  const saleIds = new Set(sales.map((s: any) => s.id));

  const rep: SalesValidationReport = {
    totalVendas: sales.length,
    vendasSemCliente: 0,
    vendasSemItens: 0,
    vendasCanceladas: 0,
    valoresNegativos: 0,
    clientesInexistentes: 0,
    produtosInexistentes: 0,
    imeisDuplicados: 0,
    pagamentosOrfaos: 0,
    amostra: [],
  };
  const push = (o: any) => rep.amostra.length < 15 && rep.amostra.push(o);

  const itemsBySale = new Map<string, any[]>();
  for (const it of items) {
    if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
    itemsBySale.get(it.sale_id)!.push(it);
  }

  for (const s of sales) {
    if (!s.customer_id) {
      rep.vendasSemCliente++;
      push({ sale_id: s.id, problema: "sem cliente" });
    } else if (!customerIds.has(s.customer_id)) {
      rep.clientesInexistentes++;
      push({ sale_id: s.id, problema: "cliente inexistente", detalhe: s.customer_id });
    }
    if (!itemsBySale.has(s.id)) {
      rep.vendasSemItens++;
      push({ sale_id: s.id, problema: "sem itens" });
    }
    if (s.status === "cancelled" || s.status === "canceled" || s.status === "cancelada") {
      rep.vendasCanceladas++;
    }
    if (Number(s.total_amount ?? 0) < 0) {
      rep.valoresNegativos++;
      push({ sale_id: s.id, problema: "total negativo", detalhe: String(s.total_amount) });
    }
  }

  for (const it of items) {
    if (it.product_id && !productIds.has(it.product_id)) {
      rep.produtosInexistentes++;
      push({ sale_id: it.sale_id, problema: "produto inexistente", detalhe: it.product_id });
    }
  }
  const imeiMap = new Map<string, number>();
  for (const it of items) {
    if (it.imei) imeiMap.set(String(it.imei), (imeiMap.get(String(it.imei)) ?? 0) + 1);
  }
  rep.imeisDuplicados = [...imeiMap.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);

  for (const p of payments) {
    if (!saleIds.has(p.sale_id)) {
      rep.pagamentosOrfaos++;
      push({ sale_id: p.sale_id, problema: "pagamento órfão", detalhe: p.id });
    }
  }
  return rep;
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
function toPremierSales(sales: any[], custMap: Map<string, any>) {
  const cols = [
    "sale_id", "numero_venda", "data", "hora", "status", "cliente_id", "cliente_nome",
    "cliente_documento", "vendedor_id", "empresa_id", "loja_id", "canal_venda", "origem",
    "subtotal", "desconto", "acrescimo", "frete", "total", "lucro", "margem", "observacoes",
  ];
  const rows = sales.map((s) => {
    const c = s.customer_id ? custMap.get(s.customer_id) : null;
    const dt = s.created_at ? new Date(s.created_at) : null;
    return {
      sale_id: s.id,
      numero_venda: s.sale_number ?? "",
      data: dt ? dt.toISOString().slice(0, 10) : "",
      hora: dt ? dt.toISOString().slice(11, 19) : "",
      status: s.status ?? "",
      cliente_id: s.customer_id ?? "",
      cliente_nome: c?.name ?? "",
      cliente_documento: c?.document ?? "",
      vendedor_id: s.seller_id ?? s.user_id ?? "",
      empresa_id: s.organization_id ?? "",
      loja_id: s.store_id ?? s.organization_id ?? "",
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
    };
  });
  return { rows, columns: cols };
}

function toPremierItems(items: any[], prodMap: Map<string, any>) {
  const cols = [
    "item_id", "sale_id", "produto_id", "produto_nome", "sku", "imei", "categoria",
    "marca", "quantidade", "valor_unitario", "custo_unitario", "desconto", "acrescimo",
    "subtotal", "garantia_meses",
  ];
  const rows = items.map((it) => {
    const p = it.product_id ? prodMap.get(it.product_id) : null;
    const q = Number(it.quantity ?? 0);
    const u = Number(it.unit_price ?? 0);
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
      garantia_meses: it.warranty_months ?? p?.warranty_months ?? "",
    };
  });
  return { rows, columns: cols };
}

function toPremierPayments(payments: any[]) {
  const cols = [
    "pagamento_id", "sale_id", "forma_pagamento", "parcelas", "valor", "taxa",
    "data", "status", "autorizacao", "nsu",
  ];
  const rows = payments.map((p) => ({
    pagamento_id: p.id,
    sale_id: p.sale_id,
    forma_pagamento: p.method ?? "",
    parcelas: p.installments ?? 1,
    valor: p.amount ?? 0,
    taxa: p.fee_amount ?? 0,
    data: p.paid_at ?? p.created_at ?? "",
    status: p.status ?? (p.paid_at ? "pago" : "pendente"),
    autorizacao: p.authorization ?? "",
    nsu: p.nsu ?? p.reference ?? "",
  }));
  return { rows, columns: cols };
}

// ── Export principal ──────────────────────────────────
export async function exportSales(
  orgId: string | null,
  mode: SalesExportMode,
  format: "csv" | "xlsx" | "zip",
): Promise<SalesExportResult> {
  const t0 = performance.now();
  const [sales, items, payments, customers, products] = await Promise.all([
    fetchAll("sales_orders", orgId),
    fetchAll("sale_items", orgId),
    fetchAll("sale_payments", orgId),
    fetchAll("customers", orgId),
    fetchAll("products", orgId),
  ]);
  const custMap = new Map(customers.map((c: any) => [c.id, c]));
  const prodMap = new Map(products.map((p: any) => [p.id, p]));
  const totalVendido = sales.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);

  let sheets: Array<{ name: string; rows: any[]; columns: string[] }>;
  let suffix = mode;

  if (mode === "premier") {
    sheets = [
      { name: "vendas", ...toPremierSales(sales, custMap) },
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

  if (format === "xlsx") {
    // 3 abas em 1 workbook
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const ws = XLSX.utils.json_to_sheet(sh.rows, { header: sh.columns });
      XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    }
    const readmeRows = [
      { campo: "modo", valor: suffix },
      { campo: "gerado_em", valor: new Date().toISOString() },
      { campo: "vendas", valor: sales.length },
      { campo: "itens", valor: items.length },
      { campo: "pagamentos", valor: payments.length },
      { campo: "total_vendido", valor: totalVendido },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readmeRows), "README");
    filename = `vendas-${suffix}-${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    bytes = sales.length * 300;
  } else if (format === "zip") {
    const zip = new JSZip();
    for (const sh of sheets) zip.file(`${sh.name}.csv`, rowsToCsv(sh.rows, sh.columns));
    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          modo: suffix,
          gerado_em: new Date().toISOString(),
          vendas: sales.length,
          itens: items.length,
          pagamentos: payments.length,
          total_vendido: totalVendido,
        },
        null,
        2,
      ),
    );
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
