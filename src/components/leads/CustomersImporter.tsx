import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported?: () => void;
}

type Row = {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  notes?: string;
};

const HEADER_MAP: Record<string, keyof Row> = {
  nome: "name",
  name: "name",
  cliente: "name",
  telefone: "phone",
  celular: "phone",
  whatsapp: "phone",
  phone: "phone",
  email: "email",
  "e-mail": "email",
  cpf: "document",
  cnpj: "document",
  documento: "document",
  document: "document",
  obs: "notes",
  observacoes: "notes",
  observações: "notes",
  notes: "notes",
};

function normalizeKey(k: string): keyof Row | null {
  const clean = k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return HEADER_MAP[clean] ?? null;
}

function cleanPhone(p: string | undefined): string | undefined {
  if (!p) return undefined;
  return String(p).replace(/\D/g, "") || undefined;
}

export function CustomersImporter({ open, onOpenChange, onImported }: Props) {
  const { orgId, userId } = useOrg();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Row[]>([]);
  const [valid, setValid] = useState<Row[]>([]);
  const [invalid, setInvalid] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  const onFile = async (file: File) => {
    setResult(null);
    setPreview([]);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(sheet);
    if (!json.length) {
      toast.error("Planilha vazia");
      return;
    }

    const rows: Row[] = json.map((r) => {
      const out: Row = { name: "" };
      for (const [k, v] of Object.entries(r)) {
        const target = normalizeKey(String(k));
        if (target) (out as any)[target] = String(v ?? "").trim();
      }
      if (out.phone) out.phone = cleanPhone(out.phone);
      return out;
    });

    const v = rows.filter((r) => r.name && (r.phone || r.email));
    const iv = rows.filter((r) => !r.name || (!r.phone && !r.email));
    setValid(v);
    setInvalid(iv);
    setPreview(rows.slice(0, 10));
    if (iv.length > 0) {
      toast.warning(`${iv.length} linha(s) sem nome ou contato — serão ignoradas`);
    }
  };

  const importNow = async () => {
    if (!orgId || !userId || valid.length === 0) return;
    setImporting(true);
    let ok = 0,
      failed = 0;
    // batch insert (chunks de 100)
    for (let i = 0; i < valid.length; i += 100) {
      const chunk = valid.slice(i, i + 100).map((r) => ({
        organization_id: orgId,
        user_id: userId,
        name: r.name,
        phone: r.phone ?? null,
        email: r.email ?? null,
        document: r.document ?? null,
        notes: r.notes ?? null,
      }));
      const { error } = await (supabase as any).from("customers").insert(chunk);
      if (error) failed += chunk.length;
      else ok += chunk.length;
    }
    setImporting(false);
    setResult({ ok, failed });
    if (ok > 0) {
      toast.success(`${ok} cliente(s) importado(s)`);
      onImported?.();
    }
  };

  const reset = () => {
    setPreview([]);
    setValid([]);
    setInvalid([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar clientes (CSV/XLSX)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!preview.length ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-bold mb-1">Suba CSV ou XLSX</p>
              <p className="text-xs text-muted-foreground mb-4">
                Colunas aceitas: <code>nome</code>, <code>telefone</code>, <code>email</code>,{" "}
                <code>cpf/cnpj</code>, <code>obs</code>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Escolher arquivo
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-success/15 text-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {valid.length} válidas
                </Badge>
                {invalid.length > 0 && (
                  <Badge className="bg-destructive/15 text-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" /> {invalid.length} inválidas
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border border-border max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/40">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest">
                        Nome
                      </th>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest">
                        Telefone
                      </th>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest">
                        Email
                      </th>
                      <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-widest">
                        Doc
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr
                        key={i}
                        className={!r.name || (!r.phone && !r.email) ? "bg-destructive/5" : ""}
                      >
                        <td className="px-2 py-1 font-bold">{r.name || "—"}</td>
                        <td className="px-2 py-1">{r.phone || "—"}</td>
                        <td className="px-2 py-1">{r.email || "—"}</td>
                        <td className="px-2 py-1">{r.document || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mostrando {Math.min(10, preview.length)} de {valid.length + invalid.length} linhas
              </p>

              {result && (
                <div className="rounded-lg bg-success/5 border border-success/30 p-3 text-sm">
                  ✓ Importação concluída: <strong>{result.ok}</strong> ok,{" "}
                  <strong>{result.failed}</strong> falhas
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {preview.length > 0 && !result && (
            <>
              <Button variant="outline" onClick={reset}>
                Trocar arquivo
              </Button>
              <Button onClick={importNow} disabled={importing || valid.length === 0}>
                {importing ? "Importando..." : `Importar ${valid.length} cliente(s)`}
              </Button>
            </>
          )}
          {result && <Button onClick={() => onOpenChange(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
