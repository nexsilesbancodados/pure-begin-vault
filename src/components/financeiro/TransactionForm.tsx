 import { useState, useEffect, useRef } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Dialog as ShadcnDialog, DialogContent as ShadcnDialogContent, DialogHeader as ShadcnDialogHeader, DialogTitle as ShadcnDialogTitle } from "@/components/ui/dialog";
 import { Textarea } from "@/components/ui/textarea";
 import { Switch } from "@/components/ui/switch";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Separator } from "@/components/ui/separator";
import { Wallet, Calendar, Tag, Plus, FileText, Repeat, Upload, X, PlusCircle, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { cn } from "@/lib/utils";
 import { toast } from "sonner";
 
 interface TransactionFormProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onSave: (data: any) => void;
   transaction?: any;
 }
 
  export function TransactionForm({ open, onOpenChange, onSave, transaction }: TransactionFormProps) {
    const [activeTab, setActiveTab] = useState("geral");
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [categories, setCategories] = useState(["Geral", "Compra", "Despesa", "Vendas", "Operacional"]);
    
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState("");
    const [accounts, setAccounts] = useState(["Conta Principal", "Caixa da Loja", "Reserva"]);

    const [formData, setFormData] = useState<any>({
     description: "",
     amount: "",
     type: "income",
     category: "Geral",
     status: "paid",
     payment_date: new Date().toISOString().split('T')[0],
     payment_methods: [{ method: "Pix", amount: "" }],
     payment_account: "Conta Principal",
     notes: "",
     tags: "",
     recurring: false,
     recurrence_period: "monthly",
   });
   const [attachments, setAttachments] = useState<File[]>([]);
   const fileInputRef = useRef<HTMLInputElement>(null);
 
   useEffect(() => {
     if (transaction) {
       setFormData({
         description: transaction.description || "",
         amount: transaction.amount || "",
         type: transaction.type || "income",
         category: transaction.category || "Geral",
         status: transaction.status || "paid",
         payment_date: transaction.payment_date || new Date().toISOString().split('T')[0],
         payment_methods: transaction.payment_methods || [{ method: transaction.payment_method || "Pix", amount: transaction.amount || "" }],
         payment_account: transaction.payment_account || "Conta Principal",
         notes: transaction.notes || "",
         tags: transaction.tags?.join(", ") || "",
         recurring: transaction.recurring || false,
         recurrence_period: transaction.recurrence_period || "monthly",
       });
       setActiveTab("geral");
     } else if (open) {
       setFormData({
         description: "",
         amount: "",
         type: "income",
         category: "Geral",
         status: "paid",
         payment_date: new Date().toISOString().split('T')[0],
         payment_methods: [{ method: "Pix", amount: "" }],
         payment_account: "Conta Principal",
         notes: "",
         tags: "",
         recurring: false,
         recurrence_period: "monthly",
       });
       setAttachments([]);
       setActiveTab("geral");
     }
   }, [transaction, open]);
 
    const handleAddCategory = () => {
      if (newCategoryName.trim()) {
        const category = newCategoryName.trim();
        if (!categories.includes(category)) {
          setCategories(prev => [...prev, category]);
        }
        setFormData({ ...formData, category });
        setNewCategoryName("");
        setIsAddingCategory(false);
        toast.success(`Categoria "${category}" adicionada`);
      }
    };

    const handleAddAccount = () => {
      if (newAccountName.trim()) {
        const account = newAccountName.trim();
        if (!accounts.includes(account)) {
          setAccounts(prev => [...prev, account]);
        }
        setFormData({ ...formData, payment_account: account });
        setNewAccountName("");
        setIsAddingAccount(false);
        toast.success(`Conta "${account}" cadastrada`);
      }
    };

    const addPaymentMethod = () => {
     setFormData({
       ...formData,
       payment_methods: [...formData.payment_methods, { method: "Dinheiro", amount: "" }]
     });
   };
 
   const removePaymentMethod = (index: number) => {
     if (formData.payment_methods.length > 1) {
       const newMethods = [...formData.payment_methods];
       newMethods.splice(index, 1);
       setFormData({ ...formData, payment_methods: newMethods });
     }
   };
 
   const updatePaymentMethod = (index: number, field: string, value: string) => {
     const newMethods = [...formData.payment_methods];
     newMethods[index] = { ...newMethods[index], [field]: value };
     setFormData({ ...formData, payment_methods: newMethods });
   };
 
   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files) {
       const newFiles = Array.from(e.target.files);
       setAttachments(prev => [...prev, ...newFiles]);
       toast.success(`${newFiles.length} arquivo(s) adicionado(s)`);
     }
   };
 
   const removeFile = (index: number) => {
     setAttachments(prev => prev.filter((_, i) => i !== index));
   };
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     
     if (formData.payment_methods.length > 1) {
       const totalSplit = formData.payment_methods.reduce((acc: number, curr: any) => acc + (parseFloat(curr.amount) || 0), 0);
       const mainAmount = parseFloat(formData.amount.toString()) || 0;
       
       if (Math.abs(totalSplit - mainAmount) > 0.01) {
         toast.error("A soma das formas de pagamento deve ser igual ao valor total.");
         setActiveTab("pagamento");
         return;
       }
     }
 
      const submissionData = {
        description: formData.description,
        amount: parseFloat(formData.amount.toString()),
        type: formData.type,
        category: formData.category,
        status: formData.status,
        payment_date: formData.payment_date,
        payment_method: formData.payment_methods[0]?.method || "Pix",
        payment_methods: formData.payment_methods,
        payment_account: formData.payment_account,
        notes: formData.notes,
        tags: formData.tags ? formData.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        recurring: formData.recurring,
        recurrence_period: formData.recurrence_period,
        attachment_url: attachments.length > 0 ? attachments[0].name : null, // Simplificado para exemplo
      };

      onSave(submissionData);
     onOpenChange(false);
   };
 
   return (
     <ShadcnDialog open={open} onOpenChange={onOpenChange}>
       <ShadcnDialogContent className="sm:max-w-[650px] max-h-[95vh] p-0 overflow-hidden flex flex-col outline-none rounded-3xl border-none shadow-2xl">
         <div className="w-12 h-1.5 bg-muted rounded-full mx-auto my-3 sm:hidden shrink-0" />
         
         <ShadcnDialogHeader className="px-6 pt-4 sm:pt-6 pb-2">
           <div className="flex items-center justify-between">
             <div>
                <ShadcnDialogTitle className="text-xl font-black text-slate-900">
                  {transaction ? "Editar Lançamento" : "Novo Lançamento"}
                </ShadcnDialogTitle>
                <p className="text-xs text-muted-foreground font-medium">Preencha os detalhes da transação financeira</p>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                formData.type === 'income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {formData.type === 'income' ? "Entrada" : "Saída"}
              </div>
           </div>
         </ShadcnDialogHeader>
 
         <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
           <div className="px-6 border-b">
             <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
               <TabsTrigger value="geral" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 text-xs font-bold uppercase tracking-wider">
                 <FileText className="w-4 h-4 mr-2" /> Geral
               </TabsTrigger>
               <TabsTrigger value="pagamento" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 text-xs font-bold uppercase tracking-wider">
                 <Wallet className="w-4 h-4 mr-2" /> Pagamento
               </TabsTrigger>
               <TabsTrigger value="anexos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-12 text-xs font-bold uppercase tracking-wider">
                 <Upload className="w-4 h-4 mr-2" /> Anexos
               </TabsTrigger>
             </TabsList>
           </div>
 
           <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
             <ScrollArea className="flex-1 px-6 py-4">
               <TabsContent value="geral" className="mt-0 space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="space-y-2 sm:col-span-2">
                     <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-slate-500">Descrição</Label>
                     <Input 
                       id="description" 
                       value={formData.description} 
                       onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                       placeholder="Ex: Aluguel, Venda de Produto..."
                       className="h-11 rounded-xl border-slate-200 focus:ring-blue-600"
                       required
                     />
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="amount" className="text-xs font-black uppercase tracking-widest text-slate-500">Valor Total</Label>
                     <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                       <Input 
                         id="amount" 
                         type="number" 
                         step="0.01"
                         value={formData.amount} 
                         onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
                         placeholder="0,00"
                         className="h-11 pl-10 rounded-xl border-slate-200 text-lg font-black focus:ring-blue-600"
                         required
                       />
                     </div>
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="type" className="text-xs font-black uppercase tracking-widest text-slate-500">Tipo</Label>
                     <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, type: "income" })}
                          className={cn(
                            "py-2 rounded-lg text-xs font-black uppercase transition-all",
                            formData.type === "income" ? "bg-white text-green-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
                          )}
                        >
                          Entrada
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, type: "expense" })}
                          className={cn(
                            "py-2 rounded-lg text-xs font-black uppercase transition-all",
                            formData.type === "expense" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
                          )}
                        >
                          Saída
                        </button>
                     </div>
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="category" className="text-xs font-black uppercase tracking-widest text-slate-500">Categoria</Label>
                     {isAddingCategory ? (
                       <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                         <Input 
                           value={newCategoryName}
                           onChange={(e) => setNewCategoryName(e.target.value)}
                           placeholder="Nome da categoria"
                           className="h-11 rounded-xl border-slate-200 focus:ring-blue-600"
                           autoFocus
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               e.preventDefault();
                               handleAddCategory();
                             }
                             if (e.key === 'Escape') {
                               setIsAddingCategory(false);
                               setNewCategoryName("");
                             }
                           }}
                         />
                         <Button 
                           type="button" 
                           onClick={handleAddCategory}
                           className="h-11 w-11 p-0 rounded-xl bg-blue-600 hover:bg-blue-700 shrink-0 shadow-lg shadow-blue-200"
                         >
                           <Plus className="w-5 h-5" />
                         </Button>
                         <Button 
                           type="button" 
                           variant="ghost"
                           onClick={() => setIsAddingCategory(false)}
                           className="h-11 w-11 p-0 rounded-xl text-slate-400 shrink-0"
                         >
                           <X className="w-5 h-5" />
                         </Button>
                       </div>
                     ) : (
                       <Select 
                         value={formData.category} 
                         onValueChange={(value) => {
                           if (value === "add_new") {
                             setIsAddingCategory(true);
                           } else {
                             setFormData({ ...formData, category: value });
                           }
                         }}
                       >
                         <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-blue-600 transition-all duration-200">
                           <SelectValue placeholder="Selecione uma categoria" />
                         </SelectTrigger>
                         <SelectContent className="rounded-xl border-slate-200 shadow-xl overflow-hidden">
                           <ScrollArea className="h-[200px]">
                             {categories.map((cat) => (
                               <SelectItem key={cat} value={cat} className="focus:bg-blue-50 focus:text-blue-700 rounded-lg mx-1">{cat}</SelectItem>
                             ))}
                           </ScrollArea>
                           <Separator className="my-1" />
                           <SelectItem value="add_new" className="text-blue-600 font-black focus:bg-blue-600 focus:text-white rounded-lg mx-1 cursor-pointer">
                             <div className="flex items-center gap-2">
                               <PlusCircle className="w-4 h-4" /> CADASTRAR NOVA
                             </div>
                           </SelectItem>
                         </SelectContent>
                       </Select>
                     )}
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="status" className="text-xs font-black uppercase tracking-widest text-slate-500">Status</Label>
                     <Select 
                       value={formData.status} 
                       onValueChange={(value) => setFormData({ ...formData, status: value })}
                     >
                       <SelectTrigger className="h-11 rounded-xl border-slate-200">
                         <SelectValue placeholder="Selecione o status" />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl">
                         <SelectItem value="paid">Pago / Recebido</SelectItem>
                         <SelectItem value="pending">Pendente</SelectItem>
                         <SelectItem value="overdue">Atrasado</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
 
                 <div className="space-y-4 pt-4 border-t">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Repeat className="w-4 h-4 text-blue-600" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-900">Lançamento Recorrente</span>
                     </div>
                     <Switch 
                       checked={formData.recurring} 
                       onCheckedChange={(checked) => setFormData({ ...formData, recurring: checked })} 
                     />
                   </div>
                   
                   {formData.recurring && (
                     <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                       <div className="space-y-2">
                         <Label htmlFor="recurrence_period" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Frequência</Label>
                         <Select 
                           value={formData.recurrence_period} 
                           onValueChange={(value) => setFormData({ ...formData, recurrence_period: value })}
                         >
                           <SelectTrigger className="h-10 rounded-xl border-slate-200">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl">
                             <SelectItem value="daily">Diário</SelectItem>
                             <SelectItem value="weekly">Semanal</SelectItem>
                             <SelectItem value="monthly">Mensal</SelectItem>
                             <SelectItem value="yearly">Anual</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                   )}
                 </div>
 
                 <div className="space-y-2 pt-2">
                   <Label htmlFor="tags" className="text-xs font-black uppercase tracking-widest text-slate-500">Tags (opcional)</Label>
                   <Input 
                     id="tags" 
                     value={formData.tags} 
                     onChange={(e) => setFormData({ ...formData, tags: e.target.value })} 
                     placeholder="Urgente, Fornecedor, etc..."
                     className="h-11 rounded-xl border-slate-200"
                   />
                 </div>
               </TabsContent>
 
               <TabsContent value="pagamento" className="mt-0 space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <Label htmlFor="payment_date" className="text-xs font-black uppercase tracking-widest text-slate-500">Data do Lançamento</Label>
                     <div className="relative">
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <Input 
                         id="payment_date" 
                         type="date"
                         className="h-11 pl-10 rounded-xl border-slate-200"
                         value={formData.payment_date} 
                         onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} 
                         required
                       />
                     </div>
                   </div>
 
                    <div className="space-y-2">
                      <Label htmlFor="payment_account" className="text-xs font-black uppercase tracking-widest text-slate-500">Conta / Caixa</Label>
                      {isAddingAccount ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <Input 
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            placeholder="Nome da conta"
                            className="h-11 rounded-xl border-slate-200 focus:ring-blue-600"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAccount();
                              }
                              if (e.key === 'Escape') {
                                setIsAddingAccount(false);
                                setNewAccountName("");
                              }
                            }}
                          />
                          <Button 
                            type="button" 
                            onClick={handleAddAccount}
                            className="h-11 w-11 p-0 rounded-xl bg-blue-600 hover:bg-blue-700 shrink-0 shadow-lg shadow-blue-200"
                          >
                            <Plus className="w-5 h-5" />
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost"
                            onClick={() => setIsAddingAccount(false)}
                            className="h-11 w-11 p-0 rounded-xl text-slate-400 shrink-0"
                          >
                            <X className="w-5 h-5" />
                          </Button>
                        </div>
                      ) : (
                        <Select 
                          value={formData.payment_account} 
                          onValueChange={(value) => {
                            if (value === "add_new_account") {
                              setIsAddingAccount(true);
                            } else {
                              setFormData({ ...formData, payment_account: value });
                            }
                          }}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-blue-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl overflow-hidden">
                            <ScrollArea className="h-[150px]">
                              {accounts.map((acc) => (
                                <SelectItem key={acc} value={acc} className="focus:bg-blue-50 focus:text-blue-700 rounded-lg mx-1">{acc}</SelectItem>
                              ))}
                            </ScrollArea>
                            <Separator className="my-1" />
                            <SelectItem value="add_new_account" className="text-blue-600 font-black focus:bg-blue-600 focus:text-white rounded-lg mx-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <PlusCircle className="w-4 h-4" /> CADASTRAR NOVA
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                 </div>
 
                 <div className="space-y-4 pt-2">
                   <div className="flex items-center justify-between">
                     <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Formas de Pagamento</Label>
                     <Button 
                       type="button" 
                       variant="outline" 
                       size="sm" 
                       onClick={addPaymentMethod}
                       className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wider gap-1"
                     >
                       <PlusCircle className="w-3 h-3" /> Adicionar Outra
                     </Button>
                   </div>
 
                   <div className="space-y-3">
                     {formData.payment_methods.map((pm: any, index: number) => (
                       <div key={index} className="flex items-end gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 animate-in fade-in slide-in-from-right-2">
                         <div className="flex-1 space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Método</Label>
                           <Select 
                             value={pm.method} 
                             onValueChange={(value) => updatePaymentMethod(index, "method", value)}
                           >
                             <SelectTrigger className="h-9 rounded-lg bg-white border-slate-200">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="rounded-xl">
                               <SelectItem value="Pix">Pix</SelectItem>
                               <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                               <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                               <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                               <SelectItem value="Boleto">Boleto</SelectItem>
                               <SelectItem value="Transferência">Transferência</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="w-1/3 space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor</Label>
                           <Input 
                             type="number"
                             step="0.01"
                             placeholder="0,00"
                             value={pm.amount}
                             onChange={(e) => updatePaymentMethod(index, "amount", e.target.value)}
                             className="h-9 rounded-lg bg-white border-slate-200 font-bold"
                           />
                         </div>
                         {formData.payment_methods.length > 1 && (
                           <Button 
                             type="button" 
                             variant="ghost" 
                             size="icon" 
                             onClick={() => removePaymentMethod(index)}
                             className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                           >
                             <Trash2 className="w-4 h-4" />
                           </Button>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
 
                 <div className="space-y-2 pt-2">
                   <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-slate-500">Observações / Notas</Label>
                   <Textarea 
                     id="notes" 
                     value={formData.notes} 
                     onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                     placeholder="Alguma informação adicional importante?"
                     className="resize-none min-h-[100px] rounded-xl border-slate-200"
                   />
                 </div>
               </TabsContent>
 
               <TabsContent value="anexos" className="mt-0 space-y-6">
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all group"
                 >
                   <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center group-hover:scale-110 transition-transform">
                     <Upload className="w-6 h-6" />
                   </div>
                   <div className="text-center">
                     <p className="text-sm font-black text-slate-900">Clique para anexar arquivos</p>
                     <p className="text-xs text-muted-foreground font-medium">Comprovantes, Notas Fiscais, PDFs, etc.</p>
                   </div>
                   <input 
                     type="file" 
                     multiple 
                     ref={fileInputRef} 
                     onChange={handleFileChange} 
                     className="hidden" 
                   />
                 </div>
 
                 {attachments.length > 0 && (
                   <div className="space-y-3">
                     <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Arquivos Selecionados</Label>
                     <div className="grid grid-cols-1 gap-2">
                       {attachments.map((file, index) => (
                         <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                           <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 grid place-items-center">
                               <FileText className="w-4 h-4 text-blue-600" />
                             </div>
                             <div className="overflow-hidden">
                               <p className="text-xs font-bold text-slate-900 truncate max-w-[200px]">{file.name}</p>
                               <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                             </div>
                           </div>
                           <Button 
                             type="button" 
                             variant="ghost" 
                             size="icon" 
                             onClick={() => removeFile(index)}
                             className="h-8 w-8 text-slate-400 hover:text-red-600"
                           >
                             <X className="w-4 h-4" />
                           </Button>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
 
                 <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                   <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                   <p className="text-[11px] text-amber-700 font-medium">
                     Arquivos anexados serão salvos e vinculados a este lançamento para consulta futura.
                   </p>
                 </div>
               </TabsContent>
             </ScrollArea>
 
             <div className="p-6 pt-4 border-t bg-slate-50/50 flex gap-3 items-center">
               <Button 
                 type="button" 
                 variant="ghost" 
                 onClick={() => onOpenChange(false)}
                 className="flex-1 h-12 rounded-2xl font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
               >
                 Cancelar
               </Button>
               <Button 
                 type="submit" 
                 className="flex-[2] h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black uppercase tracking-wider shadow-lg shadow-blue-200"
               >
                 {transaction ? "Salvar Alterações" : "Confirmar Lançamento"}
               </Button>
             </div>
           </form>
         </Tabs>
       </ShadcnDialogContent>
     </ShadcnDialog>
   );
 }
 