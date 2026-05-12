import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, XCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
}

type Row = { name: string; phone: string; email?: string; document?: string; city?: string; state?: string; notes?: string };

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
  const idx = (k: string[]) => header.findIndex((h) => k.some((x) => h.includes(x)));
  const nameIdx = idx(["nome", "name"]);
  const phoneIdx = idx(["fone", "tel", "phone", "celular", "whats"]);
  const emailIdx = idx(["email", "e-mail"]);
  const docIdx = idx(["cpf", "cnpj", "doc"]);
  const cityIdx = idx(["cidade", "city"]);
  const stateIdx = idx(["estado", "uf", "state"]);
  const notesIdx = idx(["obs", "nota", "notes"]);

  return lines.slice(1).map((line) => {
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      name: cells[nameIdx] ?? "",
      phone: cells[phoneIdx] ?? "",
      email: emailIdx >= 0 ? cells[emailIdx] : undefined,
      document: docIdx >= 0 ? cells[docIdx] : undefined,
      city: cityIdx >= 0 ? cells[cityIdx] : undefined,
      state: stateIdx >= 0 ? cells[stateIdx] : undefined,
      notes: notesIdx >= 0 ? cells[notesIdx] : undefined,
    };
  }).filter((r) => r.name);
}

export function ImportCsvDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ ok: 0, fail: 0 });

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("CSV vazio ou inválido. A primeira linha deve ter os nomes das colunas.");
      return;
    }
    setRows(parsed);
    setProgress({ ok: 0, fail: 0 });
  };

  const doImport = async () => {
    if (!user?.id) return;
    setImporting(true);
    const { data: p } = await (supabase as any).from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    if (!p?.organization_id) {
      toast.error("Sem organização ativa");
      setImporting(false);
      return;
    }

    let ok = 0, fail = 0;
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => ({
        organization_id: p.organization_id,
        user_id: user.id,
        name: r.name,
        phone: r.phone,
        email: r.email || null,
        document: r.document || null,
        city: r.city || null,
        state: r.state || null,
        notes: r.notes || null,
      }));
      const { error } = await (supabase as any).from("customers").insert(batch);
      if (error) fail += batch.length;
      else ok += batch.length;
      setProgress({ ok, fail });
    }

    setImporting(false);
    if (ok > 0) {
      toast.success(`${ok} clientes importados${fail > 0 ? ` · ${fail} falharam` : ""}`);
      onImported?.();
      setTimeout(() => onOpenChange(false), 1500);
    } else {
      toast.error("Nenhum cliente importado. Verifique o formato.");
    }
  };

  const downloadTemplate = () => {
    const csv = "nome,telefone,email,cpf,cidade,uf,observacoes\nMaria Silva,(11) 98765-4321,maria@exemplo.com,123.456.789-00,São Paulo,SP,Cliente VIP\nJoão Costa,(21) 99876-5432,joao@exemplo.com,,Rio de Janeiro,RJ,";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo-clientes.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar clientes via CSV</DialogTitle>
          <DialogDescription>
            Envie uma planilha .csv com colunas: nome, telefone, email, cpf, cidade, uf, observações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {rows.length === 0 ? (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:bg-muted/30"
              >
                <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-bold mb-1">Arraste o CSV aqui ou clique pra selecionar</p>
                <p className="text-xs text-muted-foreground">Suporta separador vírgula, ponto-vírgula ou tab</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="flex justify-center">
                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar modelo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30">
                <FileText className="h-5 w-5 text-success" />
                <div className="flex-1">
                  <p className="font-bold text-sm">{rows.length} clientes detectados</p>
                  <p className="text-xs text-muted-foreground">Confira a prévia abaixo antes de importar.</p>
                </div>
              </div>
              <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Telefone</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Cidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.phone}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">{r.city}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && <p className="p-2 text-center text-xs text-muted-foreground">+ {rows.length - 20} linhas adicionais</p>}
              </div>

              {importing && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-info/10">
                  <div className="animate-spin h-4 w-4 border-2 border-info border-t-transparent rounded-full" />
                  <span className="text-sm">Importando... {progress.ok + progress.fail}/{rows.length}</span>
                </div>
              )}

              {progress.fail > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  {progress.fail} linhas falharam (possível duplicata ou dado inválido)
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRows([])} disabled={importing}>Trocar arquivo</Button>
                <Button onClick={doImport} disabled={importing} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Importar {rows.length} clientes
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
