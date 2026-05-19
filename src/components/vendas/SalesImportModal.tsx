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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useImport } from "@/contexts/ImportContext";
import * as XLSX from "xlsx";

interface SalesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
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
  product_name?: string;
  product_quantity?: number;
  product_price?: number;
  product_sku?: string;
  discount?: number;
  // Financeiro
  description?: string;
  fin_type?: "income" | "expense";
  category?: string;
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

// Aliases por campo — qualquer coluna que contenha um destes termos é considerada match
const FIELD_ALIASES: Record<string, string[]> = {
  amount: [
    "valor",
    "total",
    "vlr",
    "amount",
    "value",
    "venda",
    "faturamento",
    "subtotal",
  ],
  date: ["data", "date", "dt", "emissao", "vencimento", "created", "criado"],
  payment: ["pagamento", "pagto", "metodo", "method", "forma", "payment"],
  status: ["status", "situacao", "estado"],
  notes: ["obs", "observacao", "observacoes", "notes", "descricao", "description"],
  customer: ["cliente", "customer", "comprador", "nome cliente", "nome do cliente", "razao social"],
  customer_phone: ["telefone", "celular", "whatsapp", "fone", "phone", "tel"],
  customer_email: ["email", "e-mail", "mail"],
  customer_document: ["cpf", "cnpj", "documento", "doc", "cpf/cnpj", "cpf cnpj", "rg"],
  product: ["produto", "item", "product", "mercadoria", "descricao produto", "modelo", "aparelho"],
  product_sku: ["sku", "codigo", "código", "cod", "ref", "referencia", "referência"],
  quantity: ["qtd", "quantidade", "qty", "quantity"],
  unit_price: ["preco", "preço", "preco unit", "valor unitario", "unit price"],
  discount: ["desconto", "discount", "abatimento", "descontos"],
  description: ["descricao", "description", "historico", "histórico", "memo", "lancamento", "lançamento", "titulo", "título"],
  fin_type: ["tipo", "natureza", "type", "operacao", "operação", "movimento", "credito/debito", "c/d"],
  category: ["categoria", "category", "classe", "classificacao", "classificação", "centro de custo", "grupo", "plano"],
};

// Mapeia cabeçalhos reais do arquivo → nossos campos canônicos
// Estratégia: prioridade exato > startsWith > inclui, e cada header só pode
// ser atribuído a um único campo (evita "Data Venda" virar VALOR).
function buildHeaderMap(sample: Record<string, any>): Record<string, string> {
  const map: Record<string, string> = {};
  const headers = Object.keys(sample);
  const used = new Set<string>();

  // Cabeçalhos que NUNCA devem virar "data da venda" (datas pessoais/cadastrais)
  const DATE_BLACKLIST = [
    "nasc", "aniversari", "birth", "cadastr",
    "atualiz", "modific", "updated", "modified",
  ];
  // Boost para datas claramente de venda
  const DATE_BOOST = ["data venda", "data da venda", "emissao", "emissão", "data emissao", "venda em"];

  const score = (h: string, aliases: string[], field?: string): number => {
    const n = norm(h);
    if (field === "date") {
      if (DATE_BLACKLIST.some((b) => n.includes(b))) return 0;
      if (DATE_BOOST.some((b) => n.includes(b))) return 120;
    }
    let best = 0;
    for (const a of aliases) {
      if (n === a) best = Math.max(best, 100);
      else if (n.startsWith(a + " ") || n.startsWith(a + "_")) best = Math.max(best, 80);
      else if (new RegExp(`(^|\\s|_)${a}(\\s|_|$)`).test(n)) best = Math.max(best, 60);
      else if (n.includes(a)) best = Math.max(best, 30);
    }
    return best;
  };
  // Ordena campos por prioridade: campos mais específicos primeiro
  const fieldOrder = [
    "customer_document", "customer_email", "customer_phone", "customer",
    "amount", "discount", "date", "payment", "status",
    "unit_price", "quantity", "product_sku", "product",
    "fin_type", "category", "description", "notes",
  ];
  for (const field of fieldOrder) {
    const aliases = FIELD_ALIASES[field];
    if (!aliases) continue;
    let bestHeader: string | undefined;
    let bestScore = 0;
    for (const h of headers) {
      if (used.has(h)) continue;
      const s = score(h, aliases, field);
      if (s > bestScore) {
        bestScore = s;
        bestHeader = h;
      }
    }
    if (bestHeader && bestScore >= 30) {
      map[field] = bestHeader;
      used.add(bestHeader);
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
  if (n.includes("dinh") || n.includes("cash") || n === "esp") return "Dinheiro";
  if (n.includes("debit")) return "Débito";
  if (n.includes("cred") || n.includes("card")) return "Crédito";
  if (n.includes("boleto")) return "Boleto";
  if (n.includes("transf")) return "Transferência";
  return String(raw).slice(0, 30);
}

function normalizeStatus(raw: any): string {
  const n = norm(raw);
  if (!n) return "concluded";
  if (n.includes("cancel")) return "cancelled";
  if (n.includes("pend") || n.includes("aberto") || n.includes("open")) return "pending";
  return "concluded";
}

function parseRow(row: any, hmap: Record<string, string>, idx: number): ParsedRow {
  const get = (field: string) => (hmap[field] ? row[hmap[field]] : undefined);

  const rawAmount = get("amount");
  const amount = parseCurrency(rawAmount);
  let date = parseDate(get("date"));
  // Sanidade: rejeita datas absurdas (provável data de nascimento ou erro
  // de mapeamento). Aceita apenas datas dos últimos 20 anos até +1 ano.
  if (date) {
    const y = date.getFullYear();
    const nowY = new Date().getFullYear();
    if (y < nowY - 20 || y > nowY + 1) date = null;
  }

  const errors: string[] = [];
  if (!hmap.amount) errors.push("coluna de valor não encontrada");
  else if (isNaN(amount)) errors.push("valor inválido");
  else if (amount <= 0) errors.push("valor deve ser maior que zero");

  const customerName = get("customer") ? String(get("customer")).trim() : undefined;
  const customerPhone = get("customer_phone") ? String(get("customer_phone")).trim() : undefined;
  const customerEmail = get("customer_email") ? String(get("customer_email")).trim() : undefined;
  const customerDocRaw = get("customer_document");
  const customerDocument = customerDocRaw
    ? String(customerDocRaw).replace(/\D/g, "").trim() || undefined
    : undefined;
  const productName = get("product") ? String(get("product")).trim() : undefined;
  const qtyRaw = get("quantity");
  const productQty = qtyRaw != null && qtyRaw !== "" ? Number(parseCurrency(qtyRaw)) || 1 : 1;
  const unitPriceRaw = get("unit_price");
  const productPrice = unitPriceRaw != null && unitPriceRaw !== ""
    ? parseCurrency(unitPriceRaw)
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

  return {
    total_amount: isNaN(amount) ? 0 : Math.abs(amount),
    payment_method: normalizePayment(get("payment")),
    status: normalizeStatus(get("status")),
    notes: String(notes).slice(0, 500),
    created_at: (date ?? new Date()).toISOString(),
    customer_name: customerName || undefined,
    customer_phone: customerPhone || undefined,
    customer_email: customerEmail || undefined,
    customer_document: customerDocument,
    product_name: productName || undefined,
    product_quantity: productQty,
    product_price: productPrice && !isNaN(productPrice) ? productPrice : undefined,
    description: description,
    fin_type: finType,
    category: categoryRaw,
    _raw: row,
    _valid: errors.length === 0,
    _error: errors.length ? `Linha ${idx + 2}: ${errors.join(", ")}` : undefined,
  };
}

export function SalesImportModal({ isOpen, onClose, onImportSuccess }: SalesImportModalProps) {
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
  const [kind, setKind] = useState<ImportKind>("vendas");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (rawData.length) {
      setRows(rawData.map((r, i) => parseRow(r, newMap, i)));
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
          const hmap = buildHeaderMap(json[0]);
          const headers = Object.keys(json[0]);
          const rows = json.map((r, i) => parseRow(r, hmap, i));
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
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Formato inválido. Use CSV ou Excel.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB).");
      return;
    }
    setFile(f);
    try {
      const parsed = await processFile(f);
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card max-h-[90vh] flex flex-col">
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
                    Migre seu histórico em minutos · CSV ou Excel
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
                  accept=".csv,.xlsx,.xls"
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
                      CSV · XLSX · XLS · até 10MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                      .CSV
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      .XLSX
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">
                      .XLS
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
                      data, valor, metodo_pagamento, status, observacao
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

              {/* Mini KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-3 bg-success/5 border border-success/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-success">
                    Válidas
                  </p>
                  <p className="text-2xl font-black mt-1">{stats.valid}</p>
                </div>
                <div className="rounded-2xl p-3 bg-destructive/5 border border-destructive/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-destructive">
                    Inválidas
                  </p>
                  <p className="text-2xl font-black mt-1">{stats.invalid}</p>
                </div>
                <div className="rounded-2xl p-3 bg-primary/5 border border-primary/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                    Total
                  </p>
                  <p className="text-lg font-black mt-1 truncate">{brl(stats.total)}</p>
                </div>
              </div>

              {/* Mapeamento de colunas */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Mapeamento de colunas
                  </span>
                  {!hmap.amount && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">
                      Valor obrigatório
                    </span>
                  )}
                </div>
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
                    : [
                        {
                          title: "Venda",
                          fields: [
                            { field: "amount", label: "Valor *", required: true },
                            { field: "date", label: "Data" },
                            { field: "payment", label: "Pagamento" },
                            { field: "status", label: "Status" },
                          ],
                        },
                        {
                          title: "Cliente",
                          fields: [
                            { field: "customer", label: "Nome do cliente" },
                            { field: "customer_document", label: "CPF / CNPJ" },
                            { field: "customer_phone", label: "Telefone" },
                            { field: "customer_email", label: "E-mail" },
                          ],
                        },
                        {
                          title: "Produto",
                          fields: [
                            { field: "product", label: "Produto" },
                            { field: "quantity", label: "Quantidade" },
                            { field: "unit_price", label: "Preço unitário" },
                            { field: "notes", label: "Observação" },
                          ],
                        },
                      ]
                  ).map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
                        {group.title}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.fields.map(({ field, label, required }) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              {label}
                              {hmap[field] && (
                                <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                              )}
                            </label>
                            <select
                              value={hmap[field] || ""}
                              onChange={(e) => remap(field, e.target.value)}
                              className={`w-full text-xs px-2.5 py-1.5 rounded-lg bg-background border ${
                                required && !hmap[field]
                                  ? "border-destructive/50"
                                  : hmap[field]
                                  ? "border-success/40"
                                  : "border-border"
                              } focus:outline-none focus:ring-2 focus:ring-primary/30`}
                            >
                              <option value="">— não usar —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground">
                    Mostrando {Math.min(8, rows.length)} de {rows.length}
                  </span>
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
                        ) : (
                          <>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">CPF / CNPJ</th>
                            <th className="text-left p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Pagamento</th>
                          </>
                        )}
                        <th className="text-right p-2.5 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Valor</th>
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
                                  {r.description || r.notes ? (
                                    <span className="font-semibold">{r.description || r.notes}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  {r.fin_type ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${
                                        isIncome
                                          ? "bg-success/10 text-success border-success/30"
                                          : "bg-destructive/10 text-destructive border-destructive/30"
                                      }`}
                                    >
                                      {isIncome ? "↑ Entrada" : "↓ Saída"}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-[11px] max-w-[140px] truncate" title={r.category}>
                                  {r.category ? (
                                    <span className="px-2 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-primary text-[10px] font-bold">
                                      {r.category}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-2.5 text-[11px] max-w-[160px] truncate">
                                  {r.customer_name ? (
                                    <span className="font-semibold">{r.customer_name}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-mono text-[11px]">
                                  {r.customer_document ? (
                                    <span className="px-1.5 py-0.5 rounded-md bg-primary/5 border border-primary/20 text-primary">
                                      {r.customer_document.length === 11
                                        ? r.customer_document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
                                        : r.customer_document.length === 14
                                        ? r.customer_document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                                        : r.customer_document}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  {pm ? (
                                    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${pmColor}`}>
                                      {pm}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </>
                            )}
                            <td className="p-2.5 text-right font-black tabular-nums">
                              {r._valid ? (
                                <span className={kind === "financeiro" && r.fin_type === "expense" ? "text-destructive" : "text-foreground"}>
                                  {kind === "financeiro" && r.fin_type === "expense" ? "−" : ""}{brl(r.total_amount)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
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
              <Button
                onClick={handleImport}
                disabled={isImporting || stats.valid === 0}
                className="rounded-xl font-black bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 min-w-[160px] gap-1.5"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importando
                  </>
                ) : (
                  <>
                    Importar {stats.valid} <ArrowRight className="h-4 w-4" />
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
  );
}
