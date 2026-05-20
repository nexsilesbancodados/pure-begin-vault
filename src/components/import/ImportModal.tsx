import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  X,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  Eye,
  ArrowRight,
  ArrowLeft,
  Trash2,
  ShoppingCart,
  Package,
  DollarSign,
  Maximize2,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  Users,
  Zap,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useImport } from "@/contexts/ImportContext";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  initialKind?: ImportKind;
}

type Step = "upload" | "preview" | "done";
type ImportKind = "vendas" | "estoque" | "financeiro";

const KIND_META: Record<ImportKind, { label: string; desc: string; icon: typeof ShoppingCart; tone: string }> = {
  vendas: { label: "Vendas", desc: "Histórico de pedidos e tickets", icon: ShoppingCart, tone: "from-info/15 to-primary/10 border-info/30 text-info" },
  estoque: { label: "Estoque", desc: "Produtos, SKUs e quantidades", icon: Package, tone: "from-emerald-500/15 to-teal-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" },
  financeiro: { label: "Financeiro", desc: "Contas, despesas e receitas", icon: DollarSign, tone: "from-amber-500/15 to-orange-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" },
};

type ParsedRow = {
  total_amount: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  customer_birthdate?: string;
  customer_address?: string;
  customer_neighborhood?: string;
  customer_city?: string;
  product_name?: string;
  product_quantity?: number;
  product_price?: number;
  product_sku?: string;
  cost_price?: number;
  discount?: number;
  brand?: string;
  model?: string;
  ean?: string;
  imei?: string;
  // Financeiro
  description?: string;
  fin_type?: "income" | "expense";
  category?: string;
  due_date?: string;        // vencimento (ISO)
  payment_date?: string;    // data de pagamento/baixa (ISO)
  paid_amount?: number;     // valor efetivamente pago
  document_number?: string; // NF / nº documento / boleto
  installments?: string;    // "2/12" ou "12x"
  supplier_name?: string;   // fornecedor (despesa)
  _raw: Record<string, any>;
  _valid: boolean;
  _error?: string;
};

const TEMPLATE_HEADERS = ["data", "valor", "metodo_pagamento", "status", "observacao"];

// Normaliza string (remove acentos, baixa caixa, trim)
const norm = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Aliases por campo e tipo de importação — evita colisões de nomenclatura
const FIELD_ALIASES: Record<ImportKind, Record<string, string[]>> = {
  vendas: {
    amount: [
      "valor", "total", "vlr", "amount", "value", "venda", "faturamento", "subtotal", "vlr total", "valor total", "recebido", "bruto", "liquido", "líquido", "total venda"
    ],
    date: [
      "data", "date", "dt", "emissao", "created", "criado", "data pedido", "data venda", "momento"
    ],
    payment: [
      "pagamento", "pagto", "metodo", "method", "forma", "payment", "meio", "condicao", "condição", "forma pgto", "meio pagamento"
    ],
    status: [
      "status", "situacao", "estado", "etapa", "fase", "posicao", "posição"
    ],
    customer: [
      "cliente", "customer", "comprador", "nome cliente", "nome do cliente", "razao social", "destinatario"
    ],
    customer_document: [
      "cpf", "cnpj", "documento", "doc", "cpf/cnpj", "cpf cnpj", "rg", "identidade"
    ],
    customer_phone: [
      "telefone", "celular", "phone", "fone", "whatsapp", "wpp", "contato", "tel"
    ],
    customer_email: [
      "email", "e-mail", "mail", "correio"
    ],
    customer_birthdate: [
      "nascimento", "data nascimento", "data de nascimento", "aniversario", "aniversário", "birth", "birthdate", "dt nasc", "nasc"
    ],
    customer_address: [
      "rua", "endereco", "endereço", "logradouro", "address", "av", "avenida", "rua/numero", "rua numero"
    ],
    customer_neighborhood: [
      "bairro", "neighborhood", "distrito", "setor", "quadra"
    ],
    customer_city: [
      "cidade", "city", "municipio", "município", "localidade"
    ],
    product: [
      "produto", "item", "product", "mercadoria", "aparelho", "nome produto"
    ],
    product_sku: [
      "sku", "codigo", "código", "cod", "ref", "referencia", "referência", "part number", "id produto"
    ],
    imei: [
      "imei", "serial", "s/n", "sn", "n de serie", "numero de serie", "número de série"
    ],
    brand: [
      "marca", "brand", "fabricante"
    ],
    model: [
      "modelo", "model", "versao", "versão"
    ],
    ean: [
      "ean", "barras", "barcode", "codigo de barras"
    ],
    quantity: [
      "qtd", "quantidade", "qty", "quantity", "volume", "itens", "unidades"
    ],
    unit_price: [
      "preco", "preço", "preco unit", "valor unitario", "unit price", "vlr unit"
    ],
    cost_price: [
      "custo", "preco custo", "valor custo", "p.custo", "vlr custo", "vlr compra"
    ],
    discount: [
      "desconto", "discount", "abatimento", "descontos", "promo", "cupom"
    ],
    notes: [
      "obs", "observacao", "observação", "nota", "notas", "comentario", "comentário", "remark"
    ],
  },
  estoque: {
    product: [
      "produto", "nome", "item", "product", "mercadoria", "descri", "modelo", "nome produto"
    ],
    product_sku: [
      "sku", "codigo", "código", "cod", "ref", "referencia", "referência", "part number", "ean", "barras", "id produto"
    ],
    quantity: [
      "estoque", "saldo", "qtd", "quantidade", "qty", "quantity", "volume", "itens", "unidades", "disponivel"
    ],
    unit_price: [
      "preco venda", "valor venda", "venda", "preco", "preço", "unitario", "valor cada", "p.venda"
    ],
    cost_price: [
      "custo", "compra", "valor custo", "preco custo", "p.custo", "vlr custo", "vlr compra"
    ],
    category: [
      "categoria", "category", "grupo", "classe", "classificacao", "classificação", "familia", "tipo"
    ],
    brand: [
      "marca", "brand", "fabricante"
    ],
    model: [
      "modelo", "model", "versao", "versão"
    ],
    ean: [
      "ean", "barras", "barcode", "codigo de barras"
    ],
    imei: [
      "imei", "serial", "s/n", "sn", "n de serie", "numero de serie"
    ],
  },
  financeiro: {
    amount: [
      "valor", "valor total", "vlr total", "vlr", "total", "amount", "value", "bruto", "valor bruto", "valor lancamento", "valor titulo", "valor original", "valor doc"
    ],
    paid_amount: [
      "valor pago", "vlr pago", "pago", "recebido", "valor recebido", "vlr recebido", "valor baixa", "valor liquidado", "liquido", "líquido", "valor liquido"
    ],
    date: [
      "data", "data emissao", "emissao", "emissão", "data lancamento", "lançamento", "data documento", "competencia", "competência", "criado", "created", "dt emissao"
    ],
    due_date: [
      "vencimento", "data vencimento", "venc", "vence em", "due", "due date", "prazo", "data prazo", "dt vencimento", "vencto"
    ],
    payment_date: [
      "data pagamento", "dt pagamento", "data pago", "pago em", "data baixa", "baixa", "liquidacao", "liquidação", "data quitacao", "quitado em", "dt pgto", "data recebimento", "recebido em"
    ],
    description: [
      "descricao", "descrição", "description", "historico", "histórico", "memo", "titulo", "título", "identificador", "lancamento", "lançamento", "referencia", "referência"
    ],
    fin_type: [
      "tipo", "natureza", "type", "operacao", "operação", "movimento", "fluxo", "d/c", "dc", "entrada saida"
    ],
    category: [
      "categoria", "category", "classe", "centro de custo", "grupo", "plano", "plano contas", "plano de contas", "conta contabil", "tag"
    ],
    payment: [
      "forma pagamento", "forma de pagamento", "metodo", "método", "method", "meio", "meio pagamento", "forma pgto", "pagto", "tipo pagamento"
    ],
    document_number: [
      "documento", "num documento", "n documento", "numero documento", "número documento", "nf", "nota", "nota fiscal", "num nota", "n nota", "boleto", "num boleto", "n doc", "doc"
    ],
    installments: [
      "parcela", "parcelas", "parc", "qt parcelas", "qtd parcelas", "num parcela", "n parcela", "x"
    ],
    customer: [
      "cliente", "customer", "pagador", "sacado", "razao social", "razão social", "pessoa", "nome"
    ],
    supplier: [
      "fornecedor", "vendor", "supplier", "credor", "beneficiario", "beneficiário", "favorecido", "razao social fornecedor"
    ],
    customer_document: [
      "cpf", "cnpj", "documento pessoa", "doc cliente", "doc fornecedor", "cpf/cnpj", "cpf cnpj"
    ],
    status: [
      "status", "situacao", "situação", "estado", "etapa", "pago/pendente"
    ],
    notes: [
      "observacao", "observação", "obs", "comentario", "comentário", "notes", "anotacao", "anotação"
    ],
  }
};

// Tokeniza um cabeçalho normalizado: separa por espaço, underscore, hífen e pontuação
const tokenize = (s: string): string[] =>
  norm(s)
    .replace(/[^a-z0-9\s_\-/]/g, " ")
    .split(/[\s_\-/]+/)
    .filter(Boolean);

// Distância de Levenshtein curta (para fuzzy de tokens parecidos)
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

// Mapeia cabeçalhos reais do arquivo → nossos campos canônicos
// Estratégia: tokeniza header e aliases; pontua exato > prefixo > token > fuzzy.
// Cada header só pode ser atribuído a um campo (evita "Data Venda" virar VALOR).
function buildHeaderMap(sample: Record<string, any>, kind: ImportKind): Record<string, string> {
  const map: Record<string, string> = {};
  const headers = Object.keys(sample);
  const used = new Set<string>();

  // Tenta recuperar mapeamento salvo no localStorage para este "tipo"
  const savedKey = `import_map_${kind}`;
  const savedMap = localStorage.getItem(savedKey);
  if (savedMap) {
    try {
      const parsed = JSON.parse(savedMap);
      for (const [field, header] of Object.entries(parsed)) {
        if (headers.includes(header as string)) {
          map[field] = header as string;
          used.add(header as string);
        }
      }
    } catch (e) {
      console.warn("Falha ao ler mapeamento salvo", e);
    }
  }

  // Datas pessoais não viram "data da venda"
  const DATE_BLACKLIST = ["nasc", "aniversari", "birth", "cadastr", "atualiz", "modific", "updated", "modified"];
  const DATE_BOOST = ["data venda", "data da venda", "emissao", "data emissao", "venda em", "data pedido", "data nf"];

  // Aliases que precisam de match de token completo (palavras curtas/ambíguas)
  const STRICT_TOKEN = new Set([
    "doc", "cpf", "cnpj", "rg", "sn", "dt", "ref", "cod", "id", "ean", "imei",
    "qtd", "qty", "tel", "wpp", "obs", "vlr",
  ]);

  const score = (h: string, aliases: string[], field?: string): number => {
    const n = norm(h);
    const compact = n.replace(/[\s_\-]/g, "");
    const tokens = tokenize(h);

    if (field === "date") {
      if (DATE_BLACKLIST.some((b) => n.includes(b))) return 0;
      if (DATE_BOOST.some((b) => n.includes(b))) return 130;
    }

    let best = 0;
    for (const aRaw of aliases) {
      const a = norm(aRaw);
      const aCompact = a.replace(/\s+/g, "");
      const aTokens = a.split(/\s+/);
      const strict = STRICT_TOKEN.has(a);

      // 1) Igualdade total (com ou sem separadores)
      if (n === a || compact === aCompact) { best = Math.max(best, 100); continue; }

      // 2) Prefixo de header (ex: "valor total" começa com "valor")
      if (n.startsWith(a + " ") || n.startsWith(a + "_") || n.startsWith(a + "-")) {
        best = Math.max(best, 85);
        continue;
      }

      // 3) Match de tokens (todos os tokens do alias estão presentes como tokens do header)
      const allTokensIn = aTokens.every((t) => tokens.includes(t));
      if (allTokensIn) { best = Math.max(best, 75); continue; }

      // 4) Token único do header igual ao alias
      if (!strict && tokens.includes(a)) { best = Math.max(best, 70); continue; }

      // 5) Fuzzy curto (typo de 1 char) para aliases >= 4 letras, NÃO estritos
      if (!strict && a.length >= 4) {
        for (const t of tokens) {
          if (Math.abs(t.length - a.length) <= 1 && lev(t, a) <= 1) {
            best = Math.max(best, 55);
            break;
          }
        }
      }

      // 6) Substring (fraco) somente para aliases longos e não estritos
      if (!strict && a.length >= 5 && n.includes(a)) {
        best = Math.max(best, 40);
      }
    }
    return best;
  };

  // Ordem: campos mais específicos primeiro para não roubar headers
  const fieldOrder = [
    "customer_document", "customer_email", "customer_phone", "supplier", "customer",
    "imei", "ean", "product_sku",
    "document_number", "installments",
    "due_date", "payment_date", "date",
    "paid_amount", "amount", "discount", "unit_price", "cost_price",
    "payment", "status",
    "quantity", "brand", "model", "product",
    "fin_type", "category", "description", "notes",
  ];

  const aliasesForKind = FIELD_ALIASES[kind] || {};

  // Duas passadas: alta confiança (>=70) primeiro, depois aceita >=40
  for (const minScore of [70, 40]) {
    for (const field of fieldOrder) {
      if (map[field]) continue;
      const aliases = aliasesForKind[field];
      if (!aliases) continue;
      let bestHeader: string | undefined;
      let bestScore = 0;
      for (const h of headers) {
        if (used.has(h)) continue;
        const s = score(h, aliases, field);
        if (s > bestScore) { bestScore = s; bestHeader = h; }
      }
      if (bestHeader && bestScore >= minScore) {
        map[field] = bestHeader;
        used.add(bestHeader);
      }
    }
  }
  return map;
}

// Parser de moeda robusto: aceita "R$ 1.234,56", "1234.56", "1,234.56", "1.234,56"
function parseCurrency(raw: any): number {
  if (raw === null || raw === undefined || raw === "") return NaN;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  // remove R$, espaços, e qualquer letra
  s = s.replace(/[R$\s\u00A0]/gi, "").replace(/[^\d.,\-]/g, "");
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // formato brasileiro: ponto = milhar, vírgula = decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // formato americano: vírgula = milhar
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

// Parser de data: aceita Date, número serial Excel, "DD/MM/YYYY", "YYYY-MM-DD", ISO
function parseDate(raw: any): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  // número serial Excel (dias desde 1900-01-01)
  if (typeof raw === "number" && raw > 25000 && raw < 80000) {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  const s = String(raw).trim();
  // DD/MM/YYYY ou DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    const [, d, m, y] = br;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const dt = new Date(year, parseInt(m) - 1, parseInt(d));
    if (!isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function normalizePayment(raw: any): string {
  const n = norm(raw);
  if (!n) return "Pix";
  if (n.includes("pix")) return "Pix";
  if (n.includes("dinh") || n.includes("cash") || n === "esp" || n.includes("especie")) return "Dinheiro";
  if (n.includes("debit")) return "Débito";
  if (n.includes("parcel") || n.includes("crediar")) return "Crediário";
  if (n.includes("fiado") || n.includes("prazo")) return "Prazo";
  if (n.includes("cred") || n.includes("card") || n.includes("cart")) return "Crédito";
  if (n.includes("boleto")) return "Boleto";
  if (n.includes("transf") || n.includes("ted") || n.includes("doc")) return "Transferência";
  return String(raw).slice(0, 30);
}

function normalizeStatus(raw: any): string {
  const n = norm(raw);
  if (!n) return "concluded";
  if (n.includes("cancel")) return "cancelled";
  if (n.includes("pend") || n.includes("aberto") || n.includes("open")) return "pending";
  return "concluded";
}

function parseRow(row: any, hmap: Record<string, string>, idx: number, kind: ImportKind): ParsedRow {
  const get = (field: string) => (hmap[field] ? row[hmap[field]] : undefined);

  const rawAmount = get("amount");
  const amount = parseCurrency(rawAmount);
  let date = parseDate(get("date"));
  let dueDate = parseDate(get("due_date"));
  let paymentDate = parseDate(get("payment_date"));
  // Sanidade: rejeita datas absurdas. Aceita apenas dos últimos 20 anos até +5 anos
  // (vencimentos podem estar no futuro).
  const sanitize = (d: Date | null) => {
    if (!d) return null;
    const y = d.getFullYear(); const nowY = new Date().getFullYear();
    return y < nowY - 20 || y > nowY + 5 ? null : d;
  };
  date = sanitize(date); dueDate = sanitize(dueDate); paymentDate = sanitize(paymentDate);

  const errors: string[] = [];
  
  if (kind === "estoque") {
    if (!hmap.product) errors.push("coluna de produto não encontrada");
  } else {
    if (!hmap.amount) errors.push("coluna de valor não encontrada");
    else if (isNaN(amount)) errors.push("valor inválido");
    else if (amount <= 0) errors.push("valor deve ser maior que zero");
  }

  const supplierRaw = get("supplier");
  const customerName = (get("customer") ? String(get("customer")).trim() : undefined)
    || (supplierRaw ? String(supplierRaw).trim() : undefined);
  const supplierName = supplierRaw ? String(supplierRaw).trim() : undefined;
  const customerPhone = get("customer_phone") ? String(get("customer_phone")).trim() : undefined;
  const customerEmail = get("customer_email") ? String(get("customer_email")).trim() : undefined;
  const customerDocRaw = get("customer_document");
  const customerDocument = customerDocRaw
    ? String(customerDocRaw).replace(/\D/g, "").trim() || undefined
    : undefined;
  const productName = get("product") ? String(get("product")).trim() : undefined;
  const productSku = get("product_sku") ? String(get("product_sku")).trim() : undefined;
  const qtyRaw = get("quantity");
  const productQty = qtyRaw != null && qtyRaw !== "" ? Number(parseCurrency(qtyRaw)) || 1 : 1;

  const paidAmountRaw = get("paid_amount");
  const paidAmount = paidAmountRaw != null && paidAmountRaw !== ""
    ? Math.abs(parseCurrency(paidAmountRaw))
    : undefined;
  const documentNumber = get("document_number") ? String(get("document_number")).trim() : undefined;
  const installments = get("installments") ? String(get("installments")).trim() : undefined;
  // Se forneceu data de pagamento, força status "pago" (a menos que status explícito diga o contrário)
  const explicitStatus = get("status");

  if (kind === "estoque" && !productName) {
    errors.push("nome do produto obrigatório");
  }
  const unitPriceRaw = get("unit_price");
  const productPrice = unitPriceRaw != null && unitPriceRaw !== ""
    ? parseCurrency(unitPriceRaw)
    : undefined;

  const costPriceRaw = get("cost_price");
  const costPrice = costPriceRaw != null && costPriceRaw !== ""
    ? parseCurrency(costPriceRaw)
    : undefined;

  const discountRaw = get("discount");
  const discount = discountRaw != null && discountRaw !== ""
    ? Math.abs(parseCurrency(discountRaw))
    : undefined;

  const description = get("description") ? String(get("description")).trim() : undefined;
  const categoryRaw = get("category") ? String(get("category")).trim() : undefined;
  const finTypeRaw = get("fin_type") ? norm(get("fin_type")) : "";
  const descNorm = description ? norm(description) : "";
  const catNorm = categoryRaw ? norm(categoryRaw) : "";
  // Palavras-chave: compra/despesa/pagamento/saída => SAÍDA (expense)
  const EXPENSE_RE = /(saida|saída|despes|debit|compra|pagame|expense|fornecedor|aluguel|salario|salário|imposto|conta|boleto|^d$)/;
  const INCOME_RE = /(entrada|receit|credit|venda|recebi|income|faturament|^c$)/;
  let finType: "income" | "expense" | undefined;
  if (finTypeRaw) {
    if (INCOME_RE.test(finTypeRaw)) finType = "income";
    else if (EXPENSE_RE.test(finTypeRaw)) finType = "expense";
  }
  // Inferência por descrição/categoria quando o tipo não foi mapeado
  if (!finType) {
    if (EXPENSE_RE.test(descNorm) || EXPENSE_RE.test(catNorm)) finType = "expense";
    else if (INCOME_RE.test(descNorm) || INCOME_RE.test(catNorm)) finType = "income";
  }
  // fallback por valor: negativo = expense, positivo = income
  if (!finType && !isNaN(amount)) finType = amount < 0 ? "expense" : "income";

  const notes =
    get("notes") || description || (customerName ? `Cliente: ${customerName}` : "Importado via sistema");

  // Status: pagamento explícito > status explícito > default
  const inferredStatus = paymentDate || (paidAmount && paidAmount > 0)
    ? "concluded"
    : normalizeStatus(explicitStatus);

  // created_at: para financeiro, prioriza data de emissão > vencimento > pagamento.
  // Para outros, usa date (com fallback "ontem" para não poluir métricas de "hoje").
  const finPrimaryDate = date ?? dueDate ?? paymentDate;
  const createdAt = kind === "financeiro"
    ? (finPrimaryDate ?? new Date()).toISOString()
    : (date ?? new Date(new Date().setHours(0, 0, 0, 0) - 86400000)).toISOString();

  return {
    total_amount: isNaN(amount) ? (productPrice ? productPrice * productQty : 0) : Math.abs(amount),
    payment_method: normalizePayment(get("payment")),
    status: inferredStatus,
    notes: String(notes).slice(0, 500),
    created_at: createdAt,
    customer_name: customerName || undefined,
    customer_phone: customerPhone || undefined,
    customer_email: customerEmail || undefined,
    customer_document: customerDocument,
    customer_birthdate: get("customer_birthdate") ? String(get("customer_birthdate")).trim() : undefined,
    customer_address: get("customer_address") ? String(get("customer_address")).trim() : undefined,
    customer_neighborhood: get("customer_neighborhood") ? String(get("customer_neighborhood")).trim() : undefined,
    customer_city: get("customer_city") ? String(get("customer_city")).trim() : undefined,
    product_name: productName || undefined,
    product_quantity: productQty,
    product_price: productPrice && !isNaN(productPrice) ? productPrice : undefined,
    cost_price: costPrice && !isNaN(costPrice) ? costPrice : undefined,
    product_sku: productSku || undefined,
    discount: discount && !isNaN(discount) ? discount : undefined,
    brand: get("brand") ? String(get("brand")).trim() : undefined,
    model: get("model") ? String(get("model")).trim() : undefined,
    ean: get("ean") ? String(get("ean")).trim() : undefined,
    imei: get("imei") ? String(get("imei")).trim() : undefined,
    description: description,
    fin_type: finType,
    category: categoryRaw,
    due_date: dueDate ? dueDate.toISOString() : undefined,
    payment_date: paymentDate ? paymentDate.toISOString() : undefined,
    paid_amount: paidAmount,
    document_number: documentNumber,
    installments: installments,
    supplier_name: supplierName,
    _raw: row,
    _valid: errors.length === 0,
    _error: errors.length ? `Linha ${idx + 2}: ${errors.join(", ")}` : undefined,
  };
}

export function ImportModal({ isOpen, onClose, onImportSuccess, initialKind }: ImportModalProps) {
  const { user } = useAuth();
  const { startImport } = useImport();
  const [isImporting, setIsImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hmap, setHmap] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [kind, setKind] = useState<ImportKind>(initialKind || "vendas");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [pdfParsing, setPdfParsing] = useState<{ elapsed: number; phase: string } | null>(null);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r._valid);
    const total = valid.reduce((acc, r) => acc + r.total_amount, 0);
    return {
      total,
      valid: valid.length,
      invalid: rows.length - valid.length,
    };
  }, [rows]);

  const remap = (field: string, header: string) => {
    const newMap = { ...hmap };
    if (!header) delete newMap[field];
    else newMap[field] = header;
    setHmap(newMap);

    // Salva mapeamento no localStorage para uso futuro
    localStorage.setItem(`import_map_${kind}`, JSON.stringify(newMap));

    if (rawData.length) {
      setRows(rawData.map((r, i) => parseRow(r, newMap, i, kind)));
    }
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setHmap({});
    setHeaders([]);
    setRawData([]);
    setStep("upload");
    setProgress(0);
    setImported(0);
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const processFile = async (
    file: File,
    targetKind: ImportKind,
  ): Promise<{
    rows: ParsedRow[];
    hmap: Record<string, string>;
    headers: string[];
    raw: any[];
  }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });
          if (json.length === 0) {
            resolve({ rows: [], hmap: {}, headers: [], raw: [] });
            return;
          }
          const hmap = buildHeaderMap(json[0], targetKind);
          const headers = Object.keys(json[0]);
          const rows = json.map((r, i) => parseRow(r, hmap, i, targetKind));
          resolve({ rows, hmap, headers, raw: json });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFile = async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls", "pdf"].includes(ext || "")) {
      toast.error("Formato inválido. Use CSV, Excel ou PDF.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB).");
      return;
    }
    setFile(f);
    try {
      let parsed: { rows: ParsedRow[]; hmap: Record<string, string>; headers: string[]; raw: any[] };
      if (ext === "pdf") {
        const t0 = Date.now();
        setPdfParsing({ elapsed: 0, phase: "Lendo arquivo..." });
        const timer = setInterval(() => {
          setPdfParsing((p) => p ? { ...p, elapsed: Math.floor((Date.now() - t0) / 1000) } : null);
        }, 250);
        let data: any, error: any;
        try {
          const b64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => {
              const s = (r.result as string) || "";
              resolve(s.split(",")[1] || "");
            };
            r.onerror = reject;
            r.readAsDataURL(f);
          });
          setPdfParsing({ elapsed: Math.floor((Date.now() - t0) / 1000), phase: "Extraindo dados com IA..." });
          const res = await (supabase as any).functions.invoke("parse-import-pdf", {
            body: { fileBase64: b64, fileName: f.name, kind, fast: true },
          });
          data = res.data; error = res.error;
          if (!error) toast.success(`PDF lido em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        } finally {
          clearInterval(timer);
          setPdfParsing(null);
        }
        if (error) throw new Error(error.message || "Falha ao processar PDF");
        const json: any[] = data?.rows || [];
        if (json.length === 0) {
          toast.error("Nenhum registro encontrado no PDF.");
          return;
        }
        const hmap = buildHeaderMap(json[0], kind);
        const headers = Object.keys(json[0]);
        const rowsP = json.map((r, i) => parseRow(r, hmap, i, kind));
        parsed = { rows: rowsP, hmap, headers, raw: json };
      } else {
        parsed = await processFile(f, kind);
      }
      if (parsed.rows.length === 0) {
        toast.error("Arquivo vazio ou sem registros válidos.");
        return;
      }
      setRows(parsed.rows);
      setHmap(parsed.hmap);
      setHeaders(parsed.headers);
      setRawData(parsed.raw);
      setStep("preview");
      const validCount = parsed.rows.filter((r) => r._valid).length;
      if (validCount === 0) {
        toast.warning(
          `${parsed.rows.length} linhas lidas, mas nenhuma válida. Confira o mapeamento de colunas.`,
        );
      } else {
        toast.success(`${parsed.rows.length} linhas detectadas · ${validCount} válidas`);
      }
    } catch (err: any) {
      toast.error("Erro ao ler o arquivo: " + (err.message || "formato inválido"));
    }
  };

  const handleImport = async () => {
    if (!user?.id || rows.length === 0) return;
    const validRows = rows.filter((r) => r._valid);
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }

    // Enfileira no servidor — processa em background mesmo se fechar o navegador
    const jobId = await startImport(
      `[${KIND_META[kind].label}] ${file?.name || "Importação"}`,
      validRows.map((r) => ({
        total_amount: r.total_amount,
        payment_method: r.payment_method,
        status: r.status,
        notes: r.notes,
        created_at: r.created_at,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        customer_document: r.customer_document,
        product_name: r.product_name,
        product_quantity: r.product_quantity,
        product_price: r.product_price,
        product_sku: r.product_sku,
        discount: r.discount,
        cost_price: r.cost_price,
        description: r.description,
        // Vendas SEMPRE entram pelo fluxo de vendas (cria sales_orders + sale_items +
        // accounts_receivable + finance_transactions). Só envia fin_type quando o
        // usuário escolheu importação financeira pura.
        fin_type: kind === "financeiro" ? r.fin_type : undefined,
        category: r.category,
      })),
    );
    if (!jobId) return;

    toast.success(
      `${validRows.length} vendas na fila — acompanhe em "Importações" no menu`,
      { duration: 5000 },
    );
    onImportSuccess?.();
    reset();
    onClose();
  };


  // Baixa CSV com TODAS as linhas inválidas (nenhuma informação é perdida)
  const downloadErrorReport = () => {
    const invalid = rows.filter((r) => !r._valid);
    if (!invalid.length) return;
    const allKeys = Array.from(new Set(invalid.flatMap((r) => Object.keys(r._raw))));
    const head = ["_erro", ...allKeys].join(",");
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = invalid
      .map((r) => [r._error || "", ...allKeys.map((k) => r._raw[k])].map(escape).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + head + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "linhas-com-erros.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${invalid.length} linhas exportadas para correção`);
  };

  const downloadTemplate = () => {
    const csv = [
      TEMPLATE_HEADERS.join(","),
      "2025-05-18,1500.00,Pix,concluded,Venda iPhone 14",
      "2025-05-17,890.50,Cartão,concluded,Acessórios diversos",
      "2025-05-16,2100.00,Dinheiro,pending,Aguardando confirmação",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo-importacao-vendas.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Modelo baixado!");
  };

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[760px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card max-h-[92vh] flex flex-col">
        {/* Hero header */}
        <div className="relative p-6 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <DialogHeader className="relative space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-white">
                    Importar {KIND_META[kind].label}
                  </DialogTitle>
                  <DialogDescription className="text-white/80 text-xs mt-0.5">
                    Migre seu histórico em minutos · CSV, Excel ou PDF (IA)
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div className="relative flex items-center gap-2 pt-2">
              {(["upload", "preview", "done"] as Step[]).map((s, i) => {
                const active = step === s;
                const done =
                  (step === "preview" && s === "upload") ||
                  (step === "done" && s !== "done");
                return (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                        active
                          ? "bg-white text-primary scale-110"
                          : done
                            ? "bg-white/90 text-primary"
                            : "bg-white/20 text-white/70"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        active || done ? "text-white" : "text-white/60"
                      }`}
                    >
                      {s === "upload" ? "Arquivo" : s === "preview" ? "Prévia" : "Concluído"}
                    </span>
                    {i < 2 && (
                      <div
                        className={`flex-1 h-0.5 rounded-full ${
                          done ? "bg-white/80" : "bg-white/20"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "upload" && (
            <div className="space-y-4">
              {/* Tipo de relatório */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Tipo de relatório
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(KIND_META) as ImportKind[]).map((k) => {
                    const meta = KIND_META[k];
                    const Icon = meta.icon;
                    const active = kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={`relative rounded-2xl border-2 p-3 text-left transition-all bg-gradient-to-br ${
                          active
                            ? `${meta.tone} shadow-md scale-[1.02]`
                            : "border-border bg-card hover:border-primary/40 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${active ? "bg-white/60 dark:bg-white/10" : "bg-muted"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate">{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {meta.desc}
                            </p>
                          </div>
                        </div>
                        {active && (
                          <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {pdfParsing && (
                <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-primary">Processando PDF com IA</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pdfParsing.phase}</p>
                    <div className="mt-2 h-1.5 bg-primary/15 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(95, pdfParsing.elapsed * 8)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary tabular-nums">{pdfParsing.elapsed}s</p>
                    <p className="text-[10px] text-muted-foreground uppercase">decorridos</p>
                  </div>
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all overflow-hidden ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : "border-border hover:border-primary/60 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <div className="relative flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-black text-base">
                      {isDragging ? "Solte para enviar" : "Arraste ou clique para escolher"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV · XLSX · XLS · PDF · até 10MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                      .CSV
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      .XLSX
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">
                      .XLS
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                      .PDF
                    </span>
                  </div>
                </div>
              </div>

              {/* Template + Tips grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadTemplate}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">Baixar modelo</p>
                    <p className="text-[11px] text-muted-foreground">
                      CSV com colunas certas
                    </p>
                  </div>
                </button>

                <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border">
                  <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">100% seguro</p>
                    <p className="text-[11px] text-muted-foreground">
                      Dados isolados por loja
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-2xl p-4 bg-info/5 border border-info/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-info" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-info">
                    Dicas pra importação perfeita
                  </h4>
                </div>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-info">•</span>
                    Colunas aceitas:{" "}
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                      {kind === "vendas" ? "data, valor, cliente, produto, qtd" : kind === "estoque" ? "produto, sku, estoque, preco, custo" : "data, valor, descricao, categoria"}
                    </code>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-info">•</span>
                    Datas em <strong>DD/MM/AAAA</strong> ou <strong>AAAA-MM-DD</strong>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-info">•</span>
                    Valores sem R$ — use ponto ou vírgula (ex: 1500.00)
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {/* File card */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate">{file?.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {((file?.size || 0) / 1024).toFixed(1)} KB · {rows.length} linhas
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-9 w-9 p-0 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Smart status banner */}
              {(() => {
                const requiredOk = kind === "estoque" ? !!hmap.product : !!hmap.amount;
                const validPct = rows.length ? Math.round((stats.valid / rows.length) * 100) : 0;
                const ready = requiredOk && stats.valid > 0;
                return (
                  <div className={`rounded-2xl p-4 border-2 flex items-center gap-3 ${
                    ready
                      ? "border-success/30 bg-gradient-to-br from-success/10 to-success/5"
                      : "border-warning/40 bg-gradient-to-br from-warning/10 to-warning/5"
                  }`}>
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${ready ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                      {ready ? <Zap className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">
                        {ready
                          ? `Tudo pronto — ${stats.valid} linhas detectadas (${validPct}% válidas)`
                          : !requiredOk
                          ? `Falta mapear o campo obrigatório "${kind === "estoque" ? "Produto" : "Valor"}"`
                          : "Nenhuma linha válida — confira o mapeamento"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {ready
                          ? "Revise abaixo e clique em Importar quando estiver pronto"
                          : "Ajuste o mapeamento de colunas para continuar"}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Mini KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-3 bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
                  <div className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Válidas</p>
                  </div>
                  <p className="text-2xl font-black mt-1">{stats.valid}</p>
                  <p className="text-[10px] text-muted-foreground">de {rows.length} linhas</p>
                </div>
                <div className="rounded-2xl p-3 bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Com erros</p>
                  </div>
                  <p className="text-2xl font-black mt-1">{stats.invalid}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.invalid > 0 ? "precisam revisão" : "tudo certo"}
                  </p>
                </div>
                <div className="rounded-2xl p-3 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1.5 text-primary">
                    <TrendingUp className="h-3 w-3" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Total</p>
                  </div>
                  <p className="text-lg font-black mt-1 truncate">{brl(stats.total)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.valid > 0 ? `~ ${brl(stats.total / stats.valid)}/venda` : "—"}
                  </p>
                </div>
              </div>

              {/* Mapeamento de colunas — colapsável */}
              <div className="rounded-2xl border border-border overflow-hidden bg-card">
                <button
                  type="button"
                  onClick={() => setMappingOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                      Mapeamento de colunas
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {Object.keys(hmap).length} mapeados
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.removeItem(`import_map_${kind}`);
                        const freshMap = buildHeaderMap(rawData[0], kind);
                        setHmap(freshMap);
                        setRows(rawData.map((r, i) => parseRow(r, freshMap, i, kind)));
                        toast.info("Mapeamento resetado para o padrão inteligente");
                      }}
                      className="text-[10px] font-bold text-primary hover:underline ml-2 cursor-pointer"
                    >
                      Resetar
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!hmap.amount && kind !== "estoque" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 animate-pulse">
                        Valor obrigatório
                      </span>
                    )}
                    {mappingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {mappingOpen && (
                <div className="p-3 space-y-4">
                  {(kind === "financeiro"
                    ? [
                        {
                          title: "Lançamento financeiro",
                          fields: [
                            { field: "description", label: "Descrição" },
                            { field: "fin_type", label: "Tipo (compra/despesa)" },
                            { field: "category", label: "Categoria" },
                            { field: "date", label: "Data" },
                            { field: "amount", label: "Valor *", required: true },
                            { field: "payment", label: "Pagamento" },
                          ],
                        },
                        {
                          title: "Complementar",
                          fields: [
                            { field: "customer", label: "Cliente / Fornecedor" },
                            { field: "customer_document", label: "CPF / CNPJ" },
                            { field: "status", label: "Status" },
                            { field: "notes", label: "Observação" },
                          ],
                        },
                      ]
                    : kind === "estoque"
                    ? [
                        {
                          title: "Dados do Produto",
                          fields: [
                            { field: "product", label: "Nome do Produto *", required: true },
                            { field: "product_sku", label: "Código / SKU" },
                            { field: "category", label: "Categoria" },
                            { field: "brand", label: "Marca" },
                            { field: "model", label: "Modelo" },
                          ],
                        },
                        {
                          title: "Valores e Estoque",
                          fields: [
                            { field: "quantity", label: "Qtd em estoque" },
                            { field: "unit_price", label: "Preço de Venda" },
                            { field: "cost_price", label: "Preço de Custo" },
                          ],
                        },
                        {
                          title: "Identificadores",
                          fields: [
                            { field: "imei", label: "IMEI / Serial" },
                            { field: "ean", label: "EAN / Barras" },
                          ],
                        },
                      ]
                    : [
                        {
                          title: "Venda",
                          fields: [
                            { field: "amount", label: "Valor Total *", required: true },
                            { field: "date", label: "Data da Venda" },
                            { field: "payment", label: "Forma de Pagamento" },
                            { field: "status", label: "Status" },
                            { field: "discount", label: "Desconto" },
                            { field: "notes", label: "Observação" },
                          ],
                        },
                        {
                          title: "Cliente",
                          fields: [
                            { field: "customer", label: "Nome do cliente" },
                            { field: "customer_document", label: "CPF / CNPJ" },
                            { field: "customer_phone", label: "Telefone" },
                            { field: "customer_email", label: "E-mail" },
                            { field: "customer_birthdate", label: "Data de Nascimento" },
                            { field: "customer_address", label: "Rua / Endereço" },
                            { field: "customer_neighborhood", label: "Bairro" },
                            { field: "customer_city", label: "Cidade" },
                          ],
                        },
                        {
                          title: "Item Vendido",
                          fields: [
                            { field: "product", label: "Produto" },
                            { field: "product_sku", label: "Código / SKU" },
                            { field: "quantity", label: "Quantidade" },
                            { field: "unit_price", label: "Preço unitário" },
                            { field: "cost_price", label: "Preço de custo" },
                            { field: "category", label: "Categoria" },
                          ],
                        },
                        {
                          title: "Identificadores do Aparelho",
                          fields: [
                            { field: "imei", label: "IMEI / Serial" },
                            { field: "ean", label: "EAN / Código de barras" },
                            { field: "brand", label: "Marca" },
                            { field: "model", label: "Modelo" },
                          ],
                        },
                      ]
                  ).map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
                        {group.title}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.fields.map(({ field, label, required }) => {
                          // mapa reverso: header -> field que já o usa
                          const usedBy: Record<string, string> = {};
                          for (const [f, h] of Object.entries(hmap)) {
                            if (h && f !== field) usedBy[h as string] = f;
                          }
                          return (
                          <div key={field} className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                {label}
                                {hmap[field] && (
                                  <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                                )}
                              </span>
                              {hmap[field] && rawData.length > 0 && (
                                <span className="text-[9px] font-normal lowercase opacity-70 truncate max-w-[80px]">
                                  {String(rawData[0][hmap[field]]).slice(0, 20) || "vazio"}
                                </span>
                              )}
                            </label>
                            <select
                              value={hmap[field] || ""}
                              onChange={(e) => remap(field, e.target.value)}
                              title={`${headers.length} colunas disponíveis no arquivo`}
                              className={`w-full text-[11px] px-2 py-1.5 rounded-lg bg-background border ${
                                required && !hmap[field]
                                  ? "border-destructive/50 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                                  : hmap[field]
                                  ? "border-success/40 bg-success/5"
                                  : "border-border"
                              } focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all`}
                            >
                              <option value="">— ignorar coluna —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}{usedBy[h] ? `  · em uso (${usedBy[h]})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          );
                        })}
                      </div>

                    </div>
                  ))}
                </div>
                )}
              </div>



              {/* Prévia de Clientes e Produtos que serão sincronizados (somente Vendas) */}
              {kind === "vendas" && <SyncPreview rows={rows} brl={brl} />}



              {/* Erros agregados */}
              {stats.invalid > 0 && (
                <details className="rounded-2xl border border-destructive/20 bg-destructive/5 overflow-hidden">
                  <summary className="cursor-pointer px-4 py-2.5 flex items-center gap-2 text-xs font-black">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-destructive">
                      {stats.invalid} linhas com problemas
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); downloadErrorReport(); }}
                      className="ml-auto text-[10px] font-black px-2 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> Baixar erros
                    </button>
                  </summary>
                  <div className="max-h-32 overflow-y-auto border-t border-destructive/20 bg-background/50">
                    {rows
                      .filter((r) => !r._valid)
                      .slice(0, 20)
                      .map((r, i) => (
                        <p
                          key={i}
                          className="px-4 py-1.5 text-[11px] text-destructive border-b border-destructive/10 last:border-0"
                        >
                          {r._error}
                        </p>
                      ))}
                    {stats.invalid > 20 && (
                      <p className="px-4 py-2 text-[10px] text-center text-muted-foreground">
                        + {stats.invalid - 20} erros adicionais
                      </p>
                    )}
                  </div>
                </details>
              )}

              {/* Preview table */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Prévia
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      Mostrando {Math.min(8, rows.length)} de {rows.length}
                    </span>
                    <button
                      onClick={() => setShowFullscreenPreview(true)}
                      className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-primary"
                      title="Expandir prévia"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gradient-to-r from-muted/60 to-muted/30 sticky top-0 backdrop-blur z-10">
                      <tr className="border-b border-border">
                        <th className="text-left p-2.5 font-black w-10 text-[10px] uppercase tracking-wider text-muted-foreground">#</th>
                        <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Data</th>
                        {kind === "financeiro" ? (
                          <>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Categoria</th>
                          </>
                        ) : kind === "estoque" ? (
                          <>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Produto</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">SKU</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">P. Custo</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">CPF / CNPJ</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Pagamento</th>
                          </>
                        )}
                        <th className="text-right p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">{kind === "estoque" ? "P. Venda" : "Valor"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r, i) => {
                        const dt = r.created_at ? new Date(r.created_at) : null;
                        const dateOk = dt && !isNaN(dt.getTime());
                        const pm = (r.payment_method || "").toString();
                        const pmColor = /pix/i.test(pm)
                          ? "bg-success/10 text-success border-success/20"
                          : /cart/i.test(pm)
                          ? "bg-primary/10 text-primary border-primary/20"
                          : /dinheiro|cash/i.test(pm)
                          ? "bg-warning/10 text-warning border-warning/20"
                          : /prazo|boleto/i.test(pm)
                          ? "bg-info/10 text-info border-info/20"
                          : "bg-muted text-muted-foreground border-border";
                        const isIncome = r.fin_type === "income";
                        return (
                          <tr
                            key={i}
                            className={`border-t border-border/60 transition-colors ${
                              r._valid
                                ? "hover:bg-primary/5"
                                : "bg-destructive/5 hover:bg-destructive/10"
                            }`}
                          >
                            <td className="p-2.5 text-[10px] font-mono text-muted-foreground">
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <td className="p-2.5">
                              {r._valid ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success border border-success/20 text-[10px] font-black">
                                  <CheckCircle2 className="h-3 w-3" />
                                  OK
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-black"
                                  title={r._error}
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  ERRO
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-[11px]">
                              {dateOk ? dt!.toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}
                            </td>
                            {kind === "financeiro" ? (
                              <>
                                <td className="p-2.5 text-[11px] max-w-[200px] truncate" title={r.description || r.notes}>
                                  {r.description || r.notes || "—"}
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${isIncome ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                    {isIncome ? "Receita" : "Despesa"}
                                  </span>
                                </td>
                                <td className="p-2.5 text-muted-foreground text-[10px]">{r.category || "—"}</td>
                              </>
                            ) : kind === "estoque" ? (
                              <>
                                <td className="p-2.5 text-[11px] max-w-[200px] truncate font-bold" title={r.product_name}>
                                  {r.product_name || "—"}
                                </td>
                                <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{r.product_sku || "—"}</td>
                                <td className="p-2.5 text-muted-foreground text-[10px]">
                                  {r.cost_price ? brl(r.cost_price) : "—"}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-2.5 text-[11px] max-w-[150px] truncate" title={r.customer_name}>
                                  {r.customer_name || "—"}
                                </td>
                                <td className="p-2.5 text-muted-foreground text-[10px]">{r.customer_document || "—"}</td>
                                <td className="p-2.5">
                                  <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${pmColor}`}>
                                    {pm}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="p-2.5 text-right font-black">
                              {kind === "estoque" ? (r.product_price ? brl(r.product_price) : "—") : brl(r.total_amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rows.length > 8 && (
                    <div className="p-2.5 text-center text-[11px] text-muted-foreground border-t border-border bg-muted/20 font-bold">
                      + {rows.length - 8} linhas adicionais serão importadas
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              {isImporting && (
                <div className="rounded-2xl p-4 bg-info/5 border border-info/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-info" />
                      Importando...
                    </span>
                    <span className="font-mono font-bold text-info">
                      {imported}/{stats.valid}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-info/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-info to-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-success/10 flex items-center justify-center ring-4 ring-success/5 animate-in zoom-in duration-500">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Importação concluída!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {imported} vendas adicionadas ao histórico
                </p>
              </div>
              <div className="inline-flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border border-border">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">
                    Faturamento
                  </p>
                  <p className="text-lg font-black text-success">{brl(stats.total)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">
                    Registros
                  </p>
                  <p className="text-lg font-black">{imported}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 gap-2 sm:gap-2">
          {step === "upload" && (
            <Button
              variant="ghost"
              onClick={handleClose}
              className="rounded-xl font-bold"
            >
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="ghost"
                onClick={reset}
                disabled={isImporting}
                className="rounded-xl font-bold gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              {stats.valid > 0 && kind !== "estoque" && (
                <div className="hidden sm:flex flex-col items-end justify-center mr-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    Valor total
                  </span>
                  <span className="text-sm font-black text-success leading-tight">{brl(stats.total)}</span>
                </div>
              )}
              <Button
                onClick={handleImport}
                disabled={isImporting || stats.valid === 0}
                className="rounded-xl font-black bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 min-w-[180px] gap-1.5"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importando…
                  </>
                ) : (
                  <>
                    Importar {stats.valid} {stats.valid === 1 ? "linha" : "linhas"} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button
              onClick={handleClose}
              className="rounded-xl font-black bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 min-w-[140px]"
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <FullscreenPreview
        isOpen={showFullscreenPreview}
        onClose={() => setShowFullscreenPreview(false)}
        rows={rows}
        kind={kind}
        brl={brl}
        hmap={hmap}
        headers={headers}
      />
    </>
  );
}

function FullscreenPreview({
  isOpen,
  onClose,
  rows,
  kind,
  brl,
  hmap,
  headers,
}: {
  isOpen: boolean;
  onClose: () => void;
  rows: ParsedRow[];
  kind: ImportKind;
  brl: (n: number) => string;
  hmap: Record<string, string>;
  headers: string[];
}) {
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "valid" && r._valid) ||
        (filter === "invalid" && !r._valid);
      
      const searchStr = search.toLowerCase();
      const matchesSearch = !search || 
        (r.product_name && r.product_name.toLowerCase().includes(searchStr)) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(searchStr)) ||
        (r.notes && r.notes.toLowerCase().includes(searchStr)) ||
        (r.product_sku && r.product_sku.toLowerCase().includes(searchStr)) ||
        (r.imei && r.imei.toLowerCase().includes(searchStr));

      return matchesFilter && matchesSearch;
    });
  }, [rows, filter, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    valid: rows.filter(r => r._valid).length,
    invalid: rows.filter(r => !r._valid).length
  }), [rows]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] w-full h-[90vh] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card flex flex-col">
        <div className="p-6 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Maximize2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-white">
                  Prévia Detalhada da Importação
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs mt-0.5">
                  Visualize todos os itens e identifique campos faltantes ou erros.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/10 rounded-xl"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  filter === "all" ? "bg-white text-primary" : "text-white/70 hover:text-white"
                }`}
              >
                Todos ({stats.total})
              </button>
              <button
                onClick={() => setFilter("valid")}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  filter === "valid" ? "bg-success text-white shadow-lg shadow-success/20" : "text-white/70 hover:text-white"
                }`}
              >
                Válidos ({stats.valid})
              </button>
              <button
                onClick={() => setFilter("invalid")}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  filter === "invalid" ? "bg-destructive text-white shadow-lg shadow-destructive/20" : "text-white/70 hover:text-white"
                }`}
              >
                Erros ({stats.invalid})
              </button>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, SKU, IMEI..."
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Mapping Summary */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Conferência de Mapeamento (Coluna no Arquivo → Campo no Sistema)
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(hmap).map(([field, header]) => (
                <div key={field} className="flex items-center bg-white border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">{header}</span>
                  <ArrowRight className="h-3 w-3 mx-2 text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase">
                    {field === "amount" ? "Valor Total" 
                     : field === "date" ? "Data" 
                     : field === "payment" ? "Pagamento"
                     : field === "customer" ? "Cliente"
                     : field === "product" ? "Produto"
                     : field === "quantity" ? "Quantidade"
                     : field === "unit_price" ? "Preço Unitário"
                     : field === "cost_price" ? "Custo"
                     : field === "product_sku" ? "SKU"
                     : field === "imei" ? "IMEI/Serial"
                     : field === "fin_type" ? "Tipo Financeiro"
                     : field === "category" ? "Categoria"
                     : field}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground w-12 sticky left-0 bg-muted/50 z-20">#</th>
                  <th className="text-left p-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground w-24 sticky left-12 bg-muted/50 z-20">Status</th>
                  {headers.map((h) => (
                    <th key={h} className="text-left p-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[120px]">
                      <div className="flex flex-col">
                        <span className="text-primary truncate" title={h}>{h}</span>
                        {Object.entries(hmap).find(([_, head]) => head === h) && (
                          <span className="text-[8px] text-success-foreground bg-success/20 px-1 rounded-sm w-fit mt-0.5">
                            MAPEADO
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="text-left p-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground min-w-[200px]">Erro/Aviso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((r, i) => {
                  const dt = r.created_at ? new Date(r.created_at) : null;
                  const isIncome = r.fin_type === "income";
                  return (
                    <tr
                      key={i}
                      className={`group hover:bg-primary/5 transition-colors ${
                        !r._valid ? "bg-destructive/5" : ""
                      }`}
                    >
                      <td className="p-3 text-[10px] font-mono text-muted-foreground sticky left-0 bg-background group-hover:bg-primary/5 z-20">
                        {String(i + 1).padStart(3, "0")}
                      </td>
                      <td className="p-3 sticky left-12 bg-background group-hover:bg-primary/5 z-20">
                        {r._valid ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success border border-success/20 text-[10px] font-black uppercase">
                            <Check className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-black uppercase">
                            <AlertCircle className="h-3 w-3" /> ERRO
                          </span>
                        )}
                      </td>

                      {headers.map((h) => (
                        <td key={h} className="p-3 truncate max-w-[200px]" title={String(r._raw[h] || "")}>
                          <span className="text-[11px]">
                            {String(r._raw[h] || "—")}
                          </span>
                        </td>
                      ))}

                      <td className="p-3 whitespace-nowrap">
                        {!r._valid ? (
                          <div className="flex items-center gap-2 text-destructive font-bold">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span className="leading-tight">{r._error?.split(": ")[1]}</span>
                          </div>
                        ) : (
                          <span className="text-success flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Pronto para importar
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-muted-foreground font-bold">Nenhum registro encontrado para este filtro.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Exibindo <strong>{filtered.length}</strong> de <strong>{rows.length}</strong> registros totais.
          </p>
          <Button onClick={onClose} className="rounded-xl font-black min-w-[120px]">
            Fechar prévia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CustomerPreview = {
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  orders: number;
  total: number;
};
type ProductPreview = {
  name: string;
  sku?: string;
  imei?: string;
  brand?: string;
  model?: string;
  qty: number;
  total: number;
  avgPrice: number;
};

function SyncPreview({ rows, brl }: { rows: ParsedRow[]; brl: (n: number) => string }) {
  const [maxView, setMaxView] = useState<null | "customers" | "products">(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerPreview | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductPreview | null>(null);
  const [query, setQuery] = useState("");

  const { customers, products } = useMemo(() => {
    const cmap = new Map<string, CustomerPreview>();
    const pmap = new Map<string, ProductPreview>();

    for (const r of rows) {
      if (!r._valid) continue;
      if (r.customer_name) {
        const key = (r.customer_document || r.customer_phone || r.customer_email || r.customer_name).toLowerCase();
        const cur = cmap.get(key);
        if (cur) {
          cur.orders += 1;
          cur.total += r.total_amount;
        } else {
          cmap.set(key, {
            name: r.customer_name,
            document: r.customer_document,
            phone: r.customer_phone,
            email: r.customer_email,
            orders: 1,
            total: r.total_amount,
          });
        }
      }
      if (r.product_name) {
        const key = (r.product_sku || r.imei || r.product_name).toLowerCase();
        const qty = r.product_quantity || 1;
        const unit = r.product_price || r.total_amount / Math.max(qty, 1);
        const cur = pmap.get(key);
        if (cur) {
          cur.qty += qty;
          cur.total += unit * qty;
          cur.avgPrice = cur.total / Math.max(cur.qty, 1);
        } else {
          pmap.set(key, {
            name: r.product_name,
            sku: r.product_sku,
            imei: r.imei,
            brand: r.brand,
            model: r.model,
            qty,
            total: unit * qty,
            avgPrice: unit,
          });
        }
      }
    }
    return {
      customers: Array.from(cmap.values()).sort((a, b) => b.total - a.total),
      products: Array.from(pmap.values()).sort((a, b) => b.qty - a.qty),
    };
  }, [rows]);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.document?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q),
    );
  }, [products, query]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Clientes */}
        <div className="rounded-2xl border border-info/20 bg-info/5 overflow-hidden">
          <div className="px-4 py-2.5 bg-info/10 border-b border-info/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-info" />
              <span className="text-[10px] font-black uppercase tracking-wider text-info">
                Cadastro de Clientes (Prévia)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-info/20 text-info">
                {customers.length} únicos
              </span>
              <button
                type="button"
                onClick={() => { setQuery(""); setMaxView("customers"); }}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md bg-white border border-info/20 text-info hover:bg-info hover:text-white transition-colors"
                title="Maximizar prévia"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {customers.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-muted-foreground">
                Nenhum cliente identificado. Mapeie a coluna "Cliente" acima.
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="bg-white/60 sticky top-0">
                  <tr className="border-b border-info/10">
                    <th className="text-left p-2 font-black text-[9px] uppercase text-muted-foreground">Nome</th>
                    <th className="text-left p-2 font-black text-[9px] uppercase text-muted-foreground">Documento</th>
                    <th className="text-right p-2 font-black text-[9px] uppercase text-muted-foreground">Compras</th>
                    <th className="text-right p-2 font-black text-[9px] uppercase text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.slice(0, 50).map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-info/5 hover:bg-info/10 cursor-pointer"
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <td className="p-2 max-w-[180px] truncate font-bold" title={c.name}>{c.name}</td>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">
                        {c.document || c.phone || c.email || <span className="italic">novo</span>}
                      </td>
                      <td className="p-2 text-right font-bold tabular-nums">{c.orders}</td>
                      <td className="p-2 text-right font-black text-info tabular-nums">{brl(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {customers.length > 50 && (
              <p className="p-2 text-center text-[10px] text-muted-foreground border-t border-info/10">
                + {customers.length - 50} clientes adicionais —{" "}
                <button onClick={() => { setQuery(""); setMaxView("customers"); }} className="font-black text-info hover:underline">
                  ver todos
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Produtos */}
        <div className="rounded-2xl border border-success/20 bg-success/5 overflow-hidden">
          <div className="px-4 py-2.5 bg-success/10 border-b border-success/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] font-black uppercase tracking-wider text-success">
                Cadastro de Produtos (Prévia)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-success/20 text-success">
                {products.length} únicos
              </span>
              <button
                type="button"
                onClick={() => { setQuery(""); setMaxView("products"); }}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md bg-white border border-success/20 text-success hover:bg-success hover:text-white transition-colors"
                title="Maximizar prévia"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {products.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-muted-foreground">
                Nenhum produto identificado. Mapeie a coluna "Produto" acima.
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="bg-white/60 sticky top-0">
                  <tr className="border-b border-success/10">
                    <th className="text-left p-2 font-black text-[9px] uppercase text-muted-foreground">Produto</th>
                    <th className="text-left p-2 font-black text-[9px] uppercase text-muted-foreground">SKU / IMEI</th>
                    <th className="text-right p-2 font-black text-[9px] uppercase text-muted-foreground">Qtd</th>
                    <th className="text-right p-2 font-black text-[9px] uppercase text-muted-foreground">Preço méd.</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 50).map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-success/5 hover:bg-success/10 cursor-pointer"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="p-2 max-w-[180px] truncate font-bold" title={p.name}>
                        {p.name}
                        {(p.brand || p.model) && (
                          <span className="block text-[9px] font-normal text-muted-foreground truncate">
                            {[p.brand, p.model].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">
                        {p.sku || p.imei || <span className="italic">novo</span>}
                      </td>
                      <td className="p-2 text-right font-bold tabular-nums">{p.qty}</td>
                      <td className="p-2 text-right font-black text-success tabular-nums">{brl(p.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {products.length > 50 && (
              <p className="p-2 text-center text-[10px] text-muted-foreground border-t border-success/10">
                + {products.length - 50} produtos adicionais —{" "}
                <button onClick={() => { setQuery(""); setMaxView("products"); }} className="font-black text-success hover:underline">
                  ver todos
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Maximized fullscreen preview */}
      <Dialog open={maxView !== null} onOpenChange={(o) => !o && setMaxView(null)}>
        <DialogContent
          className="!max-w-[95vw] w-[95vw] !h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
        >
          <DialogHeader className="p-5 border-b border-border bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {maxView === "customers" ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-info" />
                  Cadastro de Clientes — Análise completa
                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/20">
                    {filteredCustomers.length} de {customers.length}
                  </span>
                </>
              ) : (
                <>
                  <Package className="h-5 w-5 text-success" />
                  Cadastro de Produtos — Análise completa
                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                    {filteredProducts.length} de {products.length}
                  </span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Clique em uma linha para abrir o cadastro completo e revisar antes da importação.
            </DialogDescription>
            <div className="mt-3 relative">
              <Filter className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={maxView === "customers" ? "Buscar por nome, documento, telefone ou email..." : "Buscar por nome, SKU, IMEI, marca ou modelo..."}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-5">
            {maxView === "customers" ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b-2 border-info/20">
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">#</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Nome</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Documento</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Telefone</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Email</th>
                    <th className="text-right p-2.5 font-black text-[10px] uppercase text-muted-foreground">Compras</th>
                    <th className="text-right p-2.5 font-black text-[10px] uppercase text-muted-foreground">Total</th>
                    <th className="text-right p-2.5 font-black text-[10px] uppercase text-muted-foreground">Ticket méd.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-border hover:bg-info/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{i + 1}</td>
                      <td className="p-2.5 font-bold">{c.name}</td>
                      <td className="p-2.5 font-mono text-[10px]">{c.document || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5 font-mono text-[10px]">{c.phone || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5 font-mono text-[10px] max-w-[200px] truncate" title={c.email}>{c.email || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5 text-right font-bold tabular-nums">{c.orders}</td>
                      <td className="p-2.5 text-right font-black text-info tabular-nums">{brl(c.total)}</td>
                      <td className="p-2.5 text-right font-bold tabular-nums text-muted-foreground">{brl(c.total / Math.max(c.orders, 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b-2 border-success/20">
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">#</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Produto</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Marca</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">Modelo</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">SKU</th>
                    <th className="text-left p-2.5 font-black text-[10px] uppercase text-muted-foreground">IMEI</th>
                    <th className="text-right p-2.5 font-black text-[10px] uppercase text-muted-foreground">Qtd</th>
                    <th className="text-right p-2.5 font-black text-[10px] uppercase text-muted-foreground">Preço méd.</th>
                    <th className="text-right p-2.5 font-black text-[10px] uppercase text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-border hover:bg-success/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{i + 1}</td>
                      <td className="p-2.5 font-bold">{p.name}</td>
                      <td className="p-2.5">{p.brand || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5">{p.model || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5 font-mono text-[10px]">{p.sku || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5 font-mono text-[10px]">{p.imei || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2.5 text-right font-bold tabular-nums">{p.qty}</td>
                      <td className="p-2.5 text-right font-bold tabular-nums">{brl(p.avgPrice)}</td>
                      <td className="p-2.5 text-right font-black text-success tabular-nums">{brl(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Dica: clique em qualquer linha para abrir o cadastro completo do registro.
            </p>
            <Button onClick={() => setMaxView(null)} className="rounded-xl font-black min-w-[120px]">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer detail — formato igual ao cadastro de Clientes do sistema */}
      <Dialog open={selectedCustomer !== null} onOpenChange={(o) => !o && setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-info/15 flex items-center justify-center font-black text-info text-base">
                {(selectedCustomer?.name || "?").trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-base font-black">{selectedCustomer?.name || "Cadastro de Cliente"}</div>
                <div className="text-[11px] font-normal text-muted-foreground">
                  Prévia do cadastro — será criado/atualizado durante a importação
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Nome Completo</label>
                <input
                  readOnly
                  value={selectedCustomer.name || ""}
                  placeholder="Ex: João da Silva"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">E-mail</label>
                  <input
                    readOnly
                    value={selectedCustomer.email || ""}
                    placeholder="Não informado"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">WhatsApp / Celular</label>
                  <input
                    readOnly
                    value={selectedCustomer.phone || ""}
                    placeholder="Não informado"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">CPF / CNPJ</label>
                <input
                  readOnly
                  value={selectedCustomer.document || ""}
                  placeholder="000.000.000-00"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Endereço (Rua)</label>
                  <input
                    readOnly
                    placeholder="Não informado na planilha"
                    className="w-full h-10 px-3 rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground italic"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Cidade</label>
                  <input
                    readOnly
                    placeholder="Não informado na planilha"
                    className="w-full h-10 px-3 rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground italic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 mt-1 border-t border-border">
                <Stat label="Compras" value={String(selectedCustomer.orders)} />
                <Stat label="Total" value={brl(selectedCustomer.total)} accent="info" />
                <Stat label="Ticket méd." value={brl(selectedCustomer.total / Math.max(selectedCustomer.orders, 1))} />
              </div>

              <div className="rounded-lg border border-info/20 bg-info/5 p-3 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Este cadastro será <strong className="text-foreground">criado ou atualizado</strong> automaticamente
                  no módulo <strong className="text-foreground">Clientes</strong> ao concluir a importação, vinculado às {selectedCustomer.orders} venda(s) acima.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCustomer(null)} className="rounded-xl">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Product detail */}
      <Dialog open={selectedProduct !== null} onOpenChange={(o) => !o && setSelectedProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-success" />
              Cadastro do Produto
            </DialogTitle>
            <DialogDescription className="text-xs">
              Prévia dos dados que serão criados/atualizados na importação.
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-3">
              <DetailRow label="Nome" value={selectedProduct.name} />
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Marca" value={selectedProduct.brand} />
                <DetailRow label="Modelo" value={selectedProduct.model} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="SKU" value={selectedProduct.sku} mono />
                <DetailRow label="IMEI" value={selectedProduct.imei} mono />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <Stat label="Qtd" value={String(selectedProduct.qty)} />
                <Stat label="Preço méd." value={brl(selectedProduct.avgPrice)} />
                <Stat label="Total" value={brl(selectedProduct.total)} accent="success" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProduct(null)} className="rounded-xl">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm font-bold ${mono ? "font-mono" : ""} ${!value ? "italic text-muted-foreground font-normal" : ""}`}>
        {value || "Não informado"}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "info" | "success" }) {
  const color = accent === "info" ? "text-info" : accent === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
      <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-black tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

