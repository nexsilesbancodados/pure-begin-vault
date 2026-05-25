import { useEffect, useMemo, useState } from "react";
import { Download, FileText, FileSpreadsheet, FileJson, Printer, NotebookPen, Copy, X, Check } from "lucide-react";
import { Export, ColumnDef } from "@/lib/exportUniversal";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

interface Props<T> {
  filename: string;
  rows: T[];
  cols: ColumnDef<T>[];
  variant?: "outline" | "ghost";
  /** Enable "Bloco de Notas" option (default true). Uses row fields: name/model, capacity, color, price. */
  notepad?: boolean;
}

function fmtBRL(v: any) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pick(row: any, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function ExportMenu<T>({ filename, rows, cols, variant = "outline", notepad = true }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [mode, setMode] = useState<"retail" | "wholesale" | "cost">("retail");
  const [orgName, setOrgName] = useState<string>("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const { orgId } = useOrg();

  useEffect(() => {
    if (!notepadOpen || !orgId) return;
    (supabase as any)
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle()
      .then(({ data }: any) => setOrgName(data?.name ?? "Minha Loja"));
  }, [notepadOpen, orgId]);

  const generated = useMemo(() => {
    const isWholesale = mode === "wholesale";
    const title = isWholesale ? "Lista Atacado" : "Disponível";
    const header = `📋 ${orgName || "Estoque"} — ${title}\n${new Date().toLocaleDateString("pt-BR")}\n${"─".repeat(28)}\n`;
    const lines = rows.map((r: any) => {
      const model = pick(r, ["name", "model", "product_name", "title"]);
      const gb = pick(r, ["capacity", "storage", "gb"]);
      const color = pick(r, ["color", "cor"]);
      const rawPrice = Number(pick(r, ["price", "sale_price", "preco"])) || 0;
      const finalPrice = isWholesale && rawPrice > 0 ? rawPrice + 350 : rawPrice;
      const price = fmtBRL(finalPrice);
      const parts = [model, gb && `${gb}`, color].filter(Boolean).join(" ");
      return price ? `• ${parts} — ${price}` : `• ${parts}`;
    });
    return header + lines.join("\n") + `\n${"─".repeat(28)}\nTotal: ${rows.length} ${rows.length === 1 ? "item" : "itens"}`;
  }, [rows, orgName, mode]);

  useEffect(() => {
    if (notepadOpen) setText(generated);
  }, [notepadOpen, generated]);

  const opts = [
    { id: "csv", label: "CSV (texto)", icon: FileText, fn: () => Export.csv(filename, rows, cols) },
    { id: "excel", label: "Excel (.xls)", icon: FileSpreadsheet, fn: () => Export.excel(filename, rows, cols) },
    { id: "pdf", label: "PDF (imprimir)", icon: Printer, fn: () => Export.pdf(filename, rows, cols) },
    { id: "json", label: "JSON (técnico)", icon: FileJson, fn: () => Export.json(filename, rows) },
    ...(notepad
      ? [
          { id: "notepad", label: "Bloco de Notas", icon: NotebookPen, fn: () => { setMode("retail"); setNotepadOpen(true); } },
          { id: "wholesale", label: "Lista Atacado (+R$ 350)", icon: NotebookPen, fn: () => { setMode("wholesale"); setNotepadOpen(true); } },
        ]
      : []),
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado para a área de transferência");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`h-9 px-3 rounded-xl border border-border flex items-center gap-2 text-sm font-bold ${
          variant === "ghost" ? "" : "bg-card hover:bg-muted/50"
        }`}
      >
        <Download className="h-4 w-4" />
        Exportar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            {opts.map((o) => (
              <button
                key={o.id}
                disabled={rows.length === 0}
                onClick={() => {
                  o.fn();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <o.icon className="h-4 w-4 text-muted-foreground" />
                {o.label}
              </button>
            ))}
            <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              {rows.length} registro{rows.length !== 1 ? "s" : ""}
            </div>
          </div>
        </>
      )}

      {notepadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setNotepadOpen(false)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <NotebookPen className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base">{mode === "wholesale" ? "Lista Atacado (+R$ 350)" : "Bloco de Notas"}</h3>
              </div>
              <button onClick={() => setNotepadOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-auto">
              <p className="text-xs text-muted-foreground mb-2">
                Texto formatado com cabeçalho da loja, modelo, capacidade, cor e preço. Edite à vontade antes de copiar.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-[55vh] p-3 rounded-xl border border-border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                spellCheck={false}
              />
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
              <button
                onClick={() => setText(generated)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Restaurar texto original
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNotepadOpen(false)}
                  className="h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted/50"
                >
                  Fechar
                </button>
                <button
                  onClick={handleCopy}
                  className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
