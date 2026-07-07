// Exportação Completa de Clientes — SOMENTE LEITURA.
// Não altera cadastros, tabelas nem regras.
import { supabase } from "@/integrations/supabase/client";
import { rowsToCsv } from "./csv";
import { downloadXlsx } from "./xlsx";

export type CustomerExportMode = "padrao" | "expandida" | "premier";

export interface CustomerIntegrityReport {
  total: number;
  cpfDuplicado: number;
  cnpjDuplicado: number;
  cpfInvalido: number;
  cnpjInvalido: number;
  semTelefone: number;
  semCidade: number;
  semNome: number;
  amostraProblemas: Array<{ id: string; problema: string; valor?: string }>;
}

// ── Validação ─────────────────────────────────────────
function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function isCpf(doc: string) {
  return onlyDigits(doc).length === 11;
}

function isCnpj(doc: string) {
  return onlyDigits(doc).length === 14;
}

function isValidCpf(v: string): boolean {
  const s = onlyDigits(v);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i);
  let d = (sum * 10) % 11;
  if (d === 10) d = 0;
  if (d !== parseInt(s[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i);
  d = (sum * 10) % 11;
  if (d === 10) d = 0;
  return d === parseInt(s[10]);
}

function isValidCnpj(v: string): boolean {
  const s = onlyDigits(v);
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((a, d, i) => a + parseInt(d) * weights[i], 0);
    const m = sum % 11;
    return m < 2 ? 0 : 11 - m;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(s.slice(0, 12), w1);
  const d2 = calc(s.slice(0, 12) + d1, w2);
  return d1 === parseInt(s[12]) && d2 === parseInt(s[13]);
}

// ── Fetch ─────────────────────────────────────────────
async function fetchAllCustomers(orgId: string | null): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    let q: any = (supabase as any)
      .from("customers")
      .select("*")
      .range(from, from + PAGE - 1);
    if (orgId) q = q.eq("organization_id", orgId);
    const { data, error } = await q;
    if (error) break;
    const batch = (data ?? []) as any[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function fetchSalesAggregate(orgId: string | null): Promise<
  Map<string, { totalCompras: number; ultimaCompra: string | null; qtdVendas: number }>
> {
  const map = new Map<string, { totalCompras: number; ultimaCompra: string | null; qtdVendas: number }>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    let q: any = (supabase as any)
      .from("sales_orders")
      .select("customer_id, total_amount, created_at, status")
      .range(from, from + PAGE - 1);
    if (orgId) q = q.eq("organization_id", orgId);
    const { data, error } = await q;
    if (error) break;
    const batch = (data ?? []) as any[];
    for (const r of batch) {
      if (!r.customer_id) continue;
      if (r.status === "cancelled") continue;
      const cur = map.get(r.customer_id) ?? { totalCompras: 0, ultimaCompra: null, qtdVendas: 0 };
      cur.totalCompras += Number(r.total_amount ?? 0);
      cur.qtdVendas += 1;
      if (!cur.ultimaCompra || (r.created_at && r.created_at > cur.ultimaCompra)) cur.ultimaCompra = r.created_at;
      map.set(r.customer_id, cur);
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

// ── Integridade ───────────────────────────────────────
export async function checkCustomerIntegrity(orgId: string | null): Promise<CustomerIntegrityReport> {
  const rows = await fetchAllCustomers(orgId);
  const report: CustomerIntegrityReport = {
    total: rows.length,
    cpfDuplicado: 0,
    cnpjDuplicado: 0,
    cpfInvalido: 0,
    cnpjInvalido: 0,
    semTelefone: 0,
    semCidade: 0,
    semNome: 0,
    amostraProblemas: [],
  };
  const cpfMap = new Map<string, number>();
  const cnpjMap = new Map<string, number>();
  const push = (id: string, problema: string, valor?: string) => {
    if (report.amostraProblemas.length < 10) report.amostraProblemas.push({ id, problema, valor });
  };
  for (const r of rows) {
    if (!r.name || !String(r.name).trim()) {
      report.semNome++;
      push(r.id, "sem nome");
    }
    if (!r.phone) {
      report.semTelefone++;
    }
    if (!r.city) {
      report.semCidade++;
    }
    const doc = String(r.document ?? "").trim();
    if (doc) {
      if (isCpf(doc)) {
        cpfMap.set(onlyDigits(doc), (cpfMap.get(onlyDigits(doc)) ?? 0) + 1);
        if (!isValidCpf(doc)) {
          report.cpfInvalido++;
          push(r.id, "CPF inválido", doc);
        }
      } else if (isCnpj(doc)) {
        cnpjMap.set(onlyDigits(doc), (cnpjMap.get(onlyDigits(doc)) ?? 0) + 1);
        if (!isValidCnpj(doc)) {
          report.cnpjInvalido++;
          push(r.id, "CNPJ inválido", doc);
        }
      }
    }
  }
  report.cpfDuplicado = [...cpfMap.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
  report.cnpjDuplicado = [...cnpjMap.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
  return report;
}

// ── Transformações ────────────────────────────────────
function classifyType(doc: string): "PF" | "PJ" | "" {
  const d = onlyDigits(doc);
  if (d.length === 11) return "PF";
  if (d.length === 14) return "PJ";
  return "";
}

// Achata objetos JSON em colunas metadata.<chave>
function expandRows(rows: any[]): { rows: any[]; columns: string[] } {
  const allKeys = new Set<string>();
  const flat = rows.map((r) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        for (const [sk, sv] of Object.entries(v as any)) {
          const key = `${k}.${sk}`;
          out[key] = sv;
          allKeys.add(key);
        }
      } else {
        out[k] = v;
        allKeys.add(k);
      }
    }
    return out;
  });
  return { rows: flat, columns: [...allKeys] };
}

// Layout Premier ERP: cabeçalhos em pt-BR e ordem definida
function toPremierLayout(rows: any[], agg: Map<string, any>) {
  const cols = [
    "id",
    "nome",
    "tipo",
    "cpf",
    "cnpj",
    "rg",
    "inscricao_estadual",
    "data_nascimento",
    "sexo",
    "estado_civil",
    "empresa",
    "responsavel",
    "contato",
    "telefone",
    "celular",
    "whatsapp",
    "email",
    "site",
    "endereco",
    "cep",
    "rua",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "pais",
    "comercial",
    "limite_credito",
    "observacoes",
    "status",
    "data_cadastro",
    "ultima_compra",
    "total_compras",
    "ticket_medio",
    "qtd_vendas",
    "vendedor_responsavel",
    "recebe_whatsapp",
    "recebe_sms",
    "recebe_email",
    "programa_fidelidade",
    "organization_id",
    "user_id",
  ];
  const out = rows.map((r) => {
    const doc = String(r.document ?? "");
    const tipo = classifyType(doc);
    const a = agg.get(r.id);
    const total = a?.totalCompras ?? 0;
    const qtd = a?.qtdVendas ?? 0;
    return {
      id: r.id,
      nome: r.name ?? "",
      tipo,
      cpf: tipo === "PF" ? doc : "",
      cnpj: tipo === "PJ" ? doc : "",
      rg: r.rg ?? "",
      inscricao_estadual: r.inscricao_estadual ?? r.ie ?? "",
      data_nascimento: r.birth_date ?? r.data_nascimento ?? "",
      sexo: r.gender ?? r.sexo ?? "",
      estado_civil: r.marital_status ?? "",
      empresa: r.company ?? "",
      responsavel: r.responsible ?? "",
      contato: r.contact_name ?? "",
      telefone: r.phone ?? "",
      celular: r.mobile ?? r.phone ?? "",
      whatsapp: r.whatsapp ?? r.phone ?? "",
      email: r.email ?? "",
      site: r.website ?? "",
      endereco: r.address ?? "",
      cep: r.zip_code ?? r.cep ?? "",
      rua: r.street ?? "",
      numero: r.number ?? "",
      complemento: r.complement ?? "",
      bairro: r.neighborhood ?? "",
      cidade: r.city ?? "",
      estado: r.state ?? "",
      pais: r.country ?? "Brasil",
      comercial: r.commercial ?? "",
      limite_credito: r.credit_limit ?? 0,
      observacoes: r.notes ?? "",
      status: r.status ?? (r.active === false ? "inativo" : "ativo"),
      data_cadastro: r.created_at ?? "",
      ultima_compra: a?.ultimaCompra ?? "",
      total_compras: total,
      ticket_medio: qtd ? total / qtd : 0,
      qtd_vendas: qtd,
      vendedor_responsavel: r.seller_id ?? r.vendedor_id ?? "",
      recebe_whatsapp: r.opt_in_whatsapp ?? "",
      recebe_sms: r.opt_in_sms ?? "",
      recebe_email: r.opt_in_email ?? "",
      programa_fidelidade: r.loyalty ?? "",
      organization_id: r.organization_id ?? "",
      user_id: r.user_id ?? "",
    };
  });
  return { rows: out, columns: cols };
}

export interface CustomerExportResult {
  filename: string;
  count: number;
  columns: number;
  bytes: number;
}

export async function exportCustomers(
  orgId: string | null,
  mode: CustomerExportMode,
  format: "csv" | "xlsx",
): Promise<CustomerExportResult> {
  const raw = await fetchAllCustomers(orgId);
  const agg = await fetchSalesAggregate(orgId);

  // enriquecer todas as linhas com métricas de vendas
  const enriched = raw.map((r) => {
    const a = agg.get(r.id);
    const total = a?.totalCompras ?? 0;
    const qtd = a?.qtdVendas ?? 0;
    return {
      ...r,
      tipo: classifyType(String(r.document ?? "")),
      total_compras: total,
      qtd_vendas: qtd,
      ticket_medio: qtd ? total / qtd : 0,
      ultima_compra: a?.ultimaCompra ?? null,
    };
  });

  let rows: any[] = enriched;
  let columns: string[] = enriched.length ? Object.keys(enriched[0]) : [];
  let suffix = "padrao";

  if (mode === "expandida") {
    const x = expandRows(enriched);
    rows = x.rows;
    columns = x.columns;
    suffix = "expandida";
  } else if (mode === "premier") {
    const p = toPremierLayout(raw, agg);
    rows = p.rows;
    columns = p.columns;
    suffix = "premier-erp";
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clientes-${suffix}-${stamp}.${format}`;
  let bytes = 0;
  if (format === "csv") {
    const csv = rowsToCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    bytes = blob.size;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    downloadXlsx(filename, "Clientes", rows, columns, {
      modo: mode,
      total_registros: rows.length,
      gerado_em: new Date().toISOString(),
      organizacao: orgId,
      observacao: "Exportação somente-leitura. Nenhum dado do sistema foi alterado.",
    });
    bytes = rows.length * 200;
  }

  return { filename, count: rows.length, columns: columns.length, bytes };
}
