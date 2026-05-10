import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";

type Mapping = { name?: string; email?: string; phone?: string; source?: string };

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Simple CSV parser supporting quoted fields and commas/semicolons
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === sep) { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field || cur.length) { cur.push(field); lines.push(cur); }
  const headers = (lines.shift() ?? []).map((h) => h.trim());
  return { headers, rows: lines.filter((r) => r.some((v) => v && v.trim())) };
}

const guess = (headers: string[]): Mapping => {
  const m: Mapping = {};
  headers.forEach((h) => {
    const k = h.toLowerCase();
    if (!m.name && /(nome|name|cliente|contato)/.test(k)) m.name = h;
    if (!m.email && /e?mail/.test(k)) m.email = h;
    if (!m.phone && /(tel|fone|whats|cel|phone|mobile)/.test(k)) m.phone = h;
    if (!m.source && /(origem|source|canal)/.test(k)) m.source = h;
  });
  return m;
};

export function CsvImporter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ inserted: number; duplicates: number } | null>(null);

  const onFile = async (f: File) => {
    setDone(null);
    const text = await f.text();
    const { headers, rows } = parseCsv(text);
    setHeaders(headers);
    setRows(rows);
    setMapping(guess(headers));
  };

  const preview = useMemo(() => rows.slice(0, 3), [rows]);
  const idx = (col?: string) => (col ? headers.indexOf(col) : -1);

  const doImport = async () => {
    if (!user?.id || !profile?.organization_id) return toast.error("Sem organização");
    if (!mapping.name) return toast.error("Selecione a coluna de Nome");
    setBusy(true);
    try {
      const ni = idx(mapping.name), ei = idx(mapping.email), pi = idx(mapping.phone), si = idx(mapping.source);
      // Build records and dedupe by phone/email within file
      const seen = new Set<string>();
      const records = rows
        .map((r) => ({
          name: (r[ni] ?? "").trim(),
          email: ei >= 0 ? (r[ei] ?? "").trim() || null : null,
          phone: pi >= 0 ? (r[pi] ?? "").replace(/\D/g, "") || null : null,
          source: si >= 0 ? (r[si] ?? "").trim() || "import" : "import",
        }))
        .filter((r) => r.name);
      const unique = records.filter((r) => {
        const key = (r.phone || r.email || r.name).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Dedup against existing leads in DB (by phone or email)
      const phones = unique.map((r) => r.phone).filter(Boolean) as string[];
      const emails = unique.map((r) => r.email).filter(Boolean) as string[];
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      if (phones.length) {
        const { data } = await supabase.from("leads").select("phone").eq("organization_id", profile.organization_id).in("phone", phones);
        data?.forEach((d: any) => d.phone && existingPhones.add(d.phone));
      }
      if (emails.length) {
        const { data } = await supabase.from("leads").select("email").eq("organization_id", profile.organization_id).in("email", emails);
        data?.forEach((d: any) => d.email && existingEmails.add(d.email));
      }

      const toInsert = unique.filter((r) => !(r.phone && existingPhones.has(r.phone)) && !(r.email && existingEmails.has(r.email)));
      const dupes = unique.length - toInsert.length;

      // Batch insert
      const chunks: any[][] = [];
      for (let i = 0; i < toInsert.length; i += 200) chunks.push(toInsert.slice(i, i + 200));
      let inserted = 0;
      for (const c of chunks) {
        const { error, count } = await supabase
          .from("leads")
          .insert(c.map((r) => ({ ...r, user_id: user.id, organization_id: profile.organization_id, status: "new" })), { count: "exact" });
        if (error) throw error;
        inserted += count ?? c.length;
      }
      setDone({ inserted, duplicates: dupes });
      toast.success(`${inserted} leads importados (${dupes} duplicados ignorados)`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Importar leads (CSV)</DialogTitle>
        </DialogHeader>

        {!headers.length && (
          <label className="block rounded-xl border-2 border-dashed border-border p-10 text-center cursor-pointer hover:border-primary transition">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="mt-3 font-bold">Clique para selecionar um CSV</div>
            <div className="text-xs text-muted-foreground mt-1">Suporta separadores , e ; — UTF-8</div>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        )}

        {headers.length > 0 && !done && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">{rows.length} linhas detectadas. Mapeie as colunas:</div>
            <div className="grid grid-cols-2 gap-3">
              {(["name", "phone", "email", "source"] as const).map((field) => (
                <div key={field}>
                  <Label className="capitalize">{field === "name" ? "Nome *" : field === "phone" ? "Telefone" : field === "email" ? "Email" : "Origem"}</Label>
                  <Select value={mapping[field] ?? "__none__"} onValueChange={(v) => setMapping({ ...mapping, [field]: v === "__none__" ? undefined : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— ignorar —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="text-[11px] uppercase font-bold text-muted-foreground px-3 py-2 bg-muted/40">Pré-visualização</div>
              <table className="w-full text-xs">
                <thead><tr>{headers.map((h) => <th key={h} className="text-left px-2 py-1 font-bold border-b border-border">{h}</th>)}</tr></thead>
                <tbody>{preview.map((r, i) => <tr key={i}>{headers.map((_, j) => <td key={j} className="px-2 py-1 border-b border-border/50">{r[j]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setHeaders([]); setRows([]); }}>Trocar arquivo</Button>
              <Button onClick={doImport} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar {rows.length} linhas
              </Button>
            </DialogFooter>
          </div>
        )}

        {done && (
          <div className="space-y-4 text-center py-6">
            <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
            <div>
              <div className="text-2xl font-bold">{done.inserted} leads importados</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" /> {done.duplicates} duplicados ignorados
              </div>
            </div>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
