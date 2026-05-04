 import { useState, useRef } from "react";
 import { FileUp, Loader2, Info } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from "@/components/ui/dialog";
 import { toast } from "sonner";
 import { History, RotateCcw, Check, AlertCircle } from "lucide-react";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import * as XLSX from "xlsx";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 
 interface StockImportProps {
   onImported: (products: any[]) => void;
 }
 
 export function StockImport({ onImported }: StockImportProps) {
   const { user } = useAuth();
   const [isOpen, setIsOpen] = useState(false);
   const [loading, setLoading] = useState(false);
   const [progress, setProgress] = useState(0);
   const [step, setStep] = useState<'upload' | 'preview' | 'history'>('upload');
   const [previewData, setPreviewData] = useState<any[]>([]);
   const [currentFile, setCurrentFile] = useState<File | null>(null);
   const [importHistory, setImportHistory] = useState<any[]>([]);
   const fileInputRef = useRef<HTMLInputElement>(null);
 
   const fetchHistory = async () => {
     if (!user?.id) return;
     const { data, error } = await supabase
       .from('import_history')
       .select('*')
       .order('created_at', { ascending: false });
     if (!error) setImportHistory(data || []);
   };
 
   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !user?.id) return;
 
     setLoading(true);
     try {
       const reader = new FileReader();
       
       if (file.name.endsWith(".pdf")) {
         toast.info("Processando PDF... Isso pode levar um momento.");
         // Para PDF, vamos usar uma Edge Function para processar com IA
         const { data, error } = await supabase.functions.invoke("parse-inventory-pdf", {
           body: { 
             fileBase64: await fileToBase64(file),
             fileName: file.name
           }
         });
 
          if (error) {
            setLoading(false);
            throw error;
          }
          
          if (data?.products) {
            setPreviewData(data.products);
            setStep('preview');
            setLoading(false);
          } else {
            setLoading(false);
            toast.error("Nenhum dado pôde ser extraído do PDF.");
          }
       } else {
         // XLS, XLSX, CSV
         reader.onload = async (event) => {
           const bstr = event.target?.result;
           const wb = XLSX.read(bstr, { type: "binary" });
           const wsname = wb.SheetNames[0];
           const ws = wb.Sheets[wsname];
           const data = XLSX.utils.sheet_to_json(ws);
           
           if (data.length === 0) {
             toast.error("O arquivo parece estar vazio.");
             setLoading(false);
             return;
           }
 
            const products = data.map((row: any) => {
              // Helper to find a value by searching for multiple possible key names (case-insensitive)
              const findVal = (possibleKeys: string[]) => {
                const keys = Object.keys(row);
                const key = keys.find(k => 
                  possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()))
                );
                return key ? row[key] : null;
              };

               const nameVal = findVal(['nome', 'produto', 'description', 'descrição', 'item', 'modelo', 'model']);
               const modelVal = findVal(['modelo', 'model']);
               
               // Use model if name is missing or too generic
               let finalName = String(nameVal || modelVal || "Produto sem nome");
               if (finalName === "Produto sem nome" && modelVal) {
                 finalName = String(modelVal);
               }

               const parseCurrency = (val: any) => {
                 if (val === null || val === undefined) return 0;
                 if (typeof val === 'number') return val;
                 const str = String(val).replace('R$', '').trim();
                 if (str.includes(',') && str.includes('.')) {
                   // Formato como 1.234,56
                   return Number(str.replace(/\./g, '').replace(',', '.'));
                 } else if (str.includes(',')) {
                   // Formato como 1234,56
                   return Number(str.replace(',', '.'));
                 }
                 return Number(str);
               };

               const priceVal = findVal(['venda', 'preço', 'valor', 'price', 'unitário', 'vlr', 'saída', 'valor venda']);
               const costVal = findVal(['custo', 'compra', 'cost', 'entrada', 'preço custo', 'valor custo']);
               
               const price = parseCurrency(priceVal);
               const cost = parseCurrency(costVal);
               const stock = Number(findVal(['estoque', 'qtd', 'quantidade', 'stock', 'saldo', 'atual', 'disponível']) || 0);
               
              return {
                user_id: user.id,
                 name: finalName,
                price,
                cost_price: cost,
                stock_quantity: stock,
                category: String(findVal(['categoria', 'category', 'grupo']) || "Importado"),
                brand: String(findVal(['marca', 'brand', 'fabricante']) || ""),
                model: String(findVal(['modelo', 'model']) || ""),
                sku: String(findVal(['sku', 'código', 'cod']) || ""),
                imei: String(findVal(['imei', 'serial', 'sn']) || ""),
                reference: String(findVal(['referência', 'ref', 'id']) || ""),
                ncm: String(findVal(['ncm']) || ""),
                ean: String(findVal(['ean', 'barras', 'barcode']) || ""),
              };
            }).filter(p => p.name !== "Produto sem nome" || p.price > 0 || p.stock_quantity > 0);
 
             setPreviewData(products);
             setStep('preview');
             setLoading(false);
         };
         reader.readAsBinaryString(file);
       }
     } catch (error: any) {
       console.error("Erro na importação:", error);
       toast.error("Erro ao importar: " + error.message);
       setLoading(false);
     }
   };
 
   const fileToBase64 = (file: File): Promise<string> => {
     return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.readAsDataURL(file);
       reader.onload = () => resolve(reader.result?.toString().split(",")[1] || "");
       reader.onerror = (error) => reject(error);
     });
   };
 
    const saveProducts = async () => {
      if (!user?.id || previewData.length === 0) return;
      setLoading(true);
      setProgress(0);
      try {
        const { data: history, error: hErr } = await supabase
          .from('import_history')
          .insert({
            user_id: user.id,
            file_name: currentFile?.name || 'Importação via IA',
            file_type: currentFile?.name?.split('.').pop() || 'pdf',
            items_count: previewData.length,
            status: 'success'
          })
          .select()
          .single();
  
        if (hErr) throw hErr;
  
        const CHUNK_SIZE = 50;
        const totalItems = previewData.length;
        let importedCount = 0;
        const allImported = [];

        for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
          const chunk = previewData.slice(i, i + CHUNK_SIZE).map(p => ({
            user_id: user.id,
            import_id: history.id,
            name: String(p.name || "Produto sem nome"),
            price: Number(p.price || 0),
            cost_price: Number(p.cost_price || 0),
            stock_quantity: Number(p.stock_quantity || 0),
            category: String(p.category || "Importado"),
            brand: String(p.brand || ""),
            model: String(p.model || ""),
            sku: String(p.sku || ""),
            imei: String(p.imei || ""),
            reference: String(p.reference || ""),
            ncm: String(p.ncm || ""),
            ean: String(p.ean || ""),
          }));

          const { data, error } = await supabase
            .from("products")
            .insert(chunk)
            .select();

          if (error) throw error;
          if (data) allImported.push(...data);
          
          importedCount += chunk.length;
          setProgress(Math.round((importedCount / totalItems) * 100));
        }
  
        toast.success(`${allImported.length} produtos importados com sucesso!`);
        onImported(allImported);
        setIsOpen(false);
        setStep('upload');
        setPreviewData([]);
      } catch (error: any) {
        toast.error("Erro ao salvar produtos: " + error.message);
      } finally {
        setLoading(false);
        setProgress(0);
      }
    };
 
   const handleReverse = async (importId: string) => {
     if (!confirm("Tem certeza que deseja reverter esta importação? Todos os produtos vinculados a ela serão removidos.")) return;
     setLoading(true);
     try {
       const { error: pErr } = await supabase.from('products').delete().eq('import_id', importId);
       if (pErr) throw pErr;
       const { error: hErr } = await supabase.from('import_history').update({ status: 'reversed' }).eq('id', importId);
       if (hErr) throw hErr;
       toast.success("Importação revertida com sucesso.");
       fetchHistory();
       // Opcional: recarregar lista principal de produtos
       window.location.reload();
     } catch (e: any) {
       toast.error("Erro ao reverter: " + e.message);
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={(o) => {
       setIsOpen(o);
       if (o) fetchHistory();
       else { setStep('upload'); setPreviewData([]); }
     }}>
       <DialogTrigger asChild>
         <button className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition flex items-center gap-2">
           <FileUp className="h-4 w-4" /> Importar
         </button>
       </DialogTrigger>
       <DialogContent className={step === 'preview' ? "sm:max-w-[900px]" : "sm:max-w-[500px]"}>
         <DialogHeader>
           <div className="flex items-center justify-between pr-8">
             <DialogTitle className="flex items-center gap-2">
               {step === 'upload' && "Importar Estoque"}
               {step === 'preview' && "Conferir Dados Lidos"}
               {step === 'history' && "Histórico de Importações"}
             </DialogTitle>
             {step === 'upload' && (
               <Button variant="ghost" size="sm" onClick={() => { setStep('history'); fetchHistory(); }}>
                 <History className="h-4 w-4 mr-2" /> Histórico
               </Button>
             )}
           </div>
           <DialogDescription>
             {step === 'upload' && "Selecione um arquivo PDF, XLS ou XLSX de outro sistema."}
             {step === 'preview' && `Identificamos ${previewData.length} produtos. Verifique se os preços e nomes estão corretos.`}
             {step === 'history' && "Gerencie importações anteriores e reverta se necessário."}
           </DialogDescription>
         </DialogHeader>
 
         <div className="py-4">
           {step === 'upload' && (
             <div className="space-y-4">
               <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-10 space-y-4 hover:border-primary/50 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
                        <Loader2 className="h-7 w-7 animate-spin" />
                        {progress > 0 && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                            {progress}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold">Processando...</p>
                      <p className="text-[10px] text-muted-foreground">Aguarde, estamos organizando os dados.</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <FileUp className="h-7 w-7" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold">Clique para selecionar arquivo</p>
                        <p className="text-xs text-muted-foreground mt-1">Excel (XLS, XLSX), CSV ou PDF</p>
                      </div>
                    </>
                  )}
                 <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xls,.xlsx,.csv" onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) { setCurrentFile(f); handleFileChange(e); }
                 }} disabled={loading} />
               </div>
               <div className="bg-muted/50 rounded-xl p-4 flex gap-3 items-start">
                 <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                 <div className="text-xs space-y-1 text-muted-foreground">
                   <p className="font-bold text-foreground">Como funciona a importação:</p>
                   <p>• O sistema reconhece colunas de Nome, Preço Venda, Custo e Estoque.</p>
                   <p>• Para PDFs, usamos IA Vision para ler tabelas de qualquer formato.</p>
                 </div>
               </div>
             </div>
           )}
 
           {step === 'preview' && (
             <div className="space-y-4">
               <ScrollArea className="h-[400px] border border-border rounded-xl">
                 <Table>
                   <TableHeader className="bg-muted/50 sticky top-0 z-10">
                     <TableRow>
                       <TableHead>Nome</TableHead>
                       <TableHead>Categoria</TableHead>
                       <TableHead className="text-center">Estoque</TableHead>
                       <TableHead className="text-right">Venda</TableHead>
                       <TableHead className="text-right">Custo</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {previewData.map((p, i) => (
                       <TableRow key={i}>
                         <TableCell className="font-medium text-xs max-w-[200px] truncate">{p.name}</TableCell>
                         <TableCell className="text-xs">{p.category || '-'}</TableCell>
                         <TableCell className="text-center text-xs font-bold">{p.stock_quantity}</TableCell>
                         <TableCell className="text-right text-xs font-bold text-primary">
                           {Number(p.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </TableCell>
                         <TableCell className="text-right text-xs text-muted-foreground">
                           {Number(p.cost_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </ScrollArea>
               <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                 <AlertCircle className="h-4 w-4 text-blue-500" />
                 <p className="text-[10px] text-blue-700 font-medium">Os dados acima ainda não foram salvos. Clique em "Confirmar" para finalizar.</p>
               </div>
             </div>
           )}
 
           {step === 'history' && (
             <div className="space-y-4">
               <ScrollArea className="h-[400px]">
                 <div className="space-y-3">
                   {importHistory.length === 0 ? (
                     <div className="py-20 text-center text-muted-foreground">Nenhuma importação realizada.</div>
                   ) : importHistory.map((h) => (
                     <div key={h.id} className="p-4 border border-border rounded-xl flex items-center justify-between group hover:bg-muted/30 transition">
                       <div>
                         <div className="flex items-center gap-2">
                           <p className="text-sm font-bold truncate max-w-[200px]">{h.file_name}</p>
                           <Badge variant={h.status === 'success' ? 'default' : 'secondary'} className="text-[10px] h-4">
                             {h.status === 'success' ? 'Importado' : 'Revertido'}
                           </Badge>
                         </div>
                         <p className="text-[10px] text-muted-foreground mt-1">
                           {new Date(h.created_at).toLocaleString('pt-BR')} • {h.items_count} itens • .{h.file_type}
                         </p>
                       </div>
                       {h.status === 'success' && (
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className="text-destructive hover:bg-destructive/10"
                           onClick={() => handleReverse(h.id)}
                           disabled={loading}
                         >
                           <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reverter
                         </Button>
                       )}
                     </div>
                   ))}
                 </div>
               </ScrollArea>
               <Button variant="outline" className="w-full h-10 rounded-xl" onClick={() => setStep('upload')}>
                 Fazer Nova Importação
               </Button>
             </div>
           )}
         </div>
 
         <DialogFooter className="gap-2">
           {step === 'upload' && (
             <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setIsOpen(false)} disabled={loading}>Cancelar</Button>
           )}
           {step === 'preview' && (
             <>
               <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setStep('upload')} disabled={loading}>Voltar</Button>
                <Button 
                  className="h-10 rounded-xl px-8 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-glow" 
                  onClick={saveProducts} 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando {previewData.length} itens...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      <span>Confirmar e Salvar {previewData.length} itens</span>
                    </div>
                  )}
                </Button>
             </>
           )}
           {step === 'history' && (
             <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setIsOpen(false)}>Fechar</Button>
           )}
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }