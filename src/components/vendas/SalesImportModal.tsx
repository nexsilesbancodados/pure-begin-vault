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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import * as XLSX from "xlsx";

interface SalesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

type Step = "upload" | "preview" | "done";

type ParsedRow = {
  total_amount: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
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
    "preco",
    "amount",
    "value",
    "price",
    "subtotal",
    "venda",
    "faturamento",
  ],
  date: ["data", "date", "dt", "emissao", "vencimento", "created", "criado"],
  payment: ["pagamento", "pagto", "metodo", "method", "forma", "payment"],
  status: ["status", "situacao", "estado"],
  notes: ["obs", "observacao", "observacoes", "notes", "descricao", "description", "nota"],
  customer: ["cliente", "customer", "comprador", "nome"],
};

// Mapeia cabeçalhos reais do arquivo → nossos campos canônicos
function buildHeaderMap(sample: Record<string, any>): Record<string, string> {
  const map: Record<string, string> = {};
  const headers = Object.keys(sample);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const match = headers.find((h) => {
      const n = norm(h);
      return aliases.some((a) => n === a || n.includes(a));
    });
    if (match) map[field] = match;
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
  const date = parseDate(get("date"));

  const errors: string[] = [];
  if (!hmap.amount) errors.push("coluna de valor não encontrada");
  else if (isNaN(amount)) errors.push("valor inválido");
  else if (amount <= 0) errors.push("valor deve ser maior que zero");

  const customer = get("customer");
  const notes = get("notes") || (customer ? `Cliente: ${customer}` : "Importado via sistema");

  return {
    total_amount: isNaN(amount) ? 0 : amount,
    payment_method: normalizePayment(get("payment")),
    status: normalizeStatus(get("status")),
    notes: String(notes).slice(0, 500),
    created_at: (date ?? new Date()).toISOString(),
    _raw: row,
    _valid: errors.length === 0,
    _error: errors.length ? `Linha ${idx + 2}: ${errors.join(", ")}` : undefined,
  };
}

export function SalesImportModal({ isOpen, onClose, onImportSuccess }: SalesImportModalProps) {
  const { user } = useAuth();
  const { orgId } = useOrg();
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

    setIsImporting(true);
    setImported(0);
    try {
      const batchSize = 50;
      let ok = 0;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize).map((r) => ({
          user_id: user.id,
          organization_id: orgId,
          total_amount: r.total_amount,
          payment_method: r.payment_method,
          status: r.status,
          notes: r.notes,
          created_at: r.created_at,
        }));
        const { error } = await supabase.from("sales_orders").insert(batch);
        if (!error) ok += batch.length;
        setImported(ok);
        setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
      }

      setStep("done");
      toast.success(`${ok} vendas importadas!`);
      onImportSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar.");
    } finally {
      setIsImporting(false);
    }
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
                    Importar Vendas
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

              {/* Preview table */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Prévia (primeiras 8)
                  </span>
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr>
                        <th className="text-left p-2.5 font-black w-8"></th>
                        <th className="text-left p-2.5 font-black">Data</th>
                        <th className="text-left p-2.5 font-black">Pagamento</th>
                        <th className="text-right p-2.5 font-black">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/20">
                          <td className="p-2.5">
                            {r._valid ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </td>
                          <td className="p-2.5">
                            {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-2.5">{r.payment_method}</td>
                          <td className="p-2.5 text-right font-bold">
                            {r._valid ? brl(r.total_amount) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 8 && (
                    <p className="p-2 text-center text-[11px] text-muted-foreground border-t border-border">
                      + {rows.length - 8} linhas adicionais
                    </p>
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
