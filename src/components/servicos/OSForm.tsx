 import { useState, useEffect } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { toast } from "sonner";
 import { useNavigate } from "@tanstack/react-router";
 import { Search, UserPlus, Loader2, ArrowLeft, Wrench } from "lucide-react";
 
 export function OSForm() {
   const { user } = useAuth();
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [customers, setCustomers] = useState<any[]>([]);
   const [searchingCustomers, setSearchingCustomers] = useState(false);
 
   const [formData, setFormData] = useState({
     customer_id: "",
     equipment: "",
     problem_description: "",
     estimated_cost: "",
     status: "open",
   });
 
   useEffect(() => {
     const fetchCustomers = async () => {
       if (!user?.id) return;
       setSearchingCustomers(true);
       const { data, error } = await supabase
         .from("customers")
         .select("id, full_name, phone")
         .eq("user_id", user.id)
         .limit(50);
       if (error) console.error(error);
       else setCustomers(data || []);
       setSearchingCustomers(false);
     };
     fetchCustomers();
   }, [user?.id]);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user?.id) return;
     if (!formData.customer_id) return toast.error("Selecione um cliente");
 
     setLoading(true);
     try {
       const { error } = await supabase.from("service_orders").insert([{
         ...formData,
         user_id: user.id,
         estimated_cost: parseFloat(formData.estimated_cost) || 0,
       }]);
 
       if (error) throw error;
       toast.success("Ordem de serviço aberta com sucesso!");
       navigate({ to: "/servicos" });
     } catch (error: any) {
       toast.error("Erro ao criar OS: " + error.message);
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <div className="max-w-4xl mx-auto space-y-6">
       <div className="flex items-center gap-4">
         <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/servicos" })} className="rounded-full">
           <ArrowLeft className="h-5 w-5" />
         </Button>
         <div>
           <h1 className="text-2xl font-black tracking-tight text-slate-900">Nova Ordem de Serviço</h1>
           <p className="text-muted-foreground text-sm font-medium">Preencha os detalhes para iniciar o atendimento</p>
         </div>
       </div>
 
       <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 space-y-6">
           <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
             <CardHeader className="bg-slate-50/50 border-b border-slate-100">
               <CardTitle className="text-base font-black flex items-center gap-2">
                 <Wrench className="h-4 w-4 text-blue-600" /> Detalhes do Serviço
               </CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <div className="space-y-2">
                 <Label htmlFor="customer">Cliente</Label>
                 <div className="flex gap-2">
                   <div className="relative flex-1">
                     <Select 
                       value={formData.customer_id} 
                       onValueChange={(val) => setFormData({ ...formData, customer_id: val })}
                     >
                       <SelectTrigger className="h-11 rounded-xl">
                         <SelectValue placeholder="Selecione um cliente" />
                       </SelectTrigger>
                       <SelectContent>
                         {searchingCustomers ? (
                           <div className="p-2 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                         ) : customers.length > 0 ? (
                           customers.map(c => (
                             <SelectItem key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                           ))
                         ) : (
                           <div className="p-2 text-center text-xs text-muted-foreground">Nenhum cliente encontrado</div>
                         )}
                       </SelectContent>
                     </Select>
                   </div>
                   <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => navigate({ to: "/clientes" })}>
                     <UserPlus className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="equipment">Aparelho / Equipamento</Label>
                 <Input 
                   id="equipment" 
                   placeholder="Ex: iPhone 13 Pro Max - Azul" 
                   className="h-11 rounded-xl"
                   value={formData.equipment}
                   onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                   required
                 />
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="problem">Problema Relatado</Label>
                 <Textarea 
                   id="problem" 
                   placeholder="Descreva detalhadamente o defeito ou solicitação..." 
                   className="min-h-[120px] rounded-xl resize-none"
                   value={formData.problem_description}
                   onChange={(e) => setFormData({ ...formData, problem_description: e.target.value })}
                   required
                 />
               </div>
             </CardContent>
           </Card>
         </div>
 
         <div className="space-y-6">
           <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
             <CardHeader className="bg-slate-50/50 border-b border-slate-100">
               <CardTitle className="text-base font-black">Resumo</CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <div className="space-y-2">
                 <Label htmlFor="cost">Orçamento Estimado (R$)</Label>
                 <Input 
                   id="cost" 
                   type="number" 
                   step="0.01"
                   placeholder="0,00" 
                   className="h-11 rounded-xl font-black text-blue-600"
                   value={formData.estimated_cost}
                   onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                 />
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="status">Status Inicial</Label>
                 <Select 
                   value={formData.status} 
                   onValueChange={(val) => setFormData({ ...formData, status: val })}
                 >
                   <SelectTrigger className="h-11 rounded-xl">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="open">Aberto</SelectItem>
                     <SelectItem value="in_progress">Em Andamento</SelectItem>
                     <SelectItem value="waiting_approval">Aguardando Aprovação</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="pt-4">
                 <Button 
                   type="submit" 
                   className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200"
                   disabled={loading}
                 >
                   {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Abrir Ordem de Serviço"}
                 </Button>
               </div>
             </CardContent>
           </Card>
         </div>
       </form>
     </div>
   );
 }