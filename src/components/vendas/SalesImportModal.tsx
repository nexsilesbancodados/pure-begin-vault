 import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
 import * as XLSX from "xlsx";

interface SalesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export function SalesImportModal({ isOpen, onClose, onImportSuccess }: SalesImportModalProps) {
   const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

   const processFile = async (file: File): Promise<any[]> => {
     return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.onload = (e) => {
         try {
           const data = new Uint8Array(e.target?.result as ArrayBuffer);
           const workbook = XLSX.read(data, { type: "array" });
           const firstSheetName = workbook.SheetNames[0];
           const worksheet = workbook.Sheets[firstSheetName];
           const jsonData = XLSX.utils.sheet_to_json(worksheet);
           resolve(jsonData);
         } catch (err) {
           reject(err);
         }
       };
       reader.onerror = (err) => reject(err);
       reader.readAsArrayBuffer(file);
     });
   };
 
   const handleImport = async () => {
     if (!file || !user?.id) {
       toast.error("Por favor, selecione um arquivo.");
       return;
     }
 
     setIsImporting(true);
     try {
       const data = await processFile(file);
       
       if (!data || data.length === 0) {
         throw new Error("O arquivo está vazio ou é inválido.");
       }
 
       // Mapeamento dos dados para o formato do banco
       // Esperamos colunas como: valor, metodo_pagamento, status, data
       const salesToInsert = data.map((row: any) => ({
         user_id: user.id,
         total_amount: parseFloat(row.valor || row.total || row.Amount || 0),
         payment_method: row.metodo_pagamento || row.payment_method || "Pix",
          status: row.status || "concluded",
         notes: row.observacao || row.notes || "Importado via sistema",
         items: row.itens ? JSON.parse(row.itens) : [],
         created_at: row.data ? new Date(row.data).toISOString() : new Date().toISOString(),
       }));
 
       const { error } = await supabase
         .from('sales_orders')
         .insert(salesToInsert);
 
       if (error) throw error;
 
       toast.success(`${salesToInsert.length} vendas importadas com sucesso!`);
       onImportSuccess?.();
       onClose();
       setFile(null);
     } catch (error: any) {
       console.error("Erro na importação:", error);
       toast.error(error.message || "Ocorreu um erro ao importar as vendas. Verifique o formato do arquivo.");
     } finally {
       setIsImporting(false);
     }
   };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            Importar Vendas
          </DialogTitle>
          <DialogDescription>
            Traga seus dados de outros sistemas de forma rápida e segura.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div 
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            <label 
              htmlFor="file-upload" 
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              {file ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(2)} KB • Clique para trocar
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Clique para selecionar ou arraste o arquivo</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Formatos suportados: CSV, Excel (.xlsx, .xls)
                    </p>
                  </div>
                </>
              )}
            </label>
          </div>

          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              Dicas para uma importação perfeita:
            </h4>
            <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
              <li>Certifique-se de que os nomes das colunas correspondem ao nosso modelo.</li>
              <li>Datas devem estar no formato DD/MM/AAAA ou AAAA-MM-DD.</li>
              <li>Valores monetários não devem conter o símbolo da moeda (R$).</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={isImporting} className="rounded-xl font-bold">
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || isImporting}
            className="rounded-xl font-bold bg-primary shadow-lg shadow-primary/20 min-w-[120px]"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Iniciar Importação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}