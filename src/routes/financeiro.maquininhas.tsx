 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { CreditCard, Plus, Receipt, Settings } from "lucide-react";
 
 export const Route = createFileRoute("/financeiro/maquininhas")({
   component: FinanceMaquininhasPage,
 });
 
 function FinanceMaquininhasPage() {
   const terminals = [
     { id: 1, name: "Cielo Lio - Principal", serial: "SN-9922881", rates: "Deb: 1.2% | Cred: 2.8%", status: "Ativa" },
     { id: 2, name: "Rede Smart", serial: "SN-1122334", rates: "Deb: 1.1% | Cred: 2.5%", status: "Ativa" },
     { id: 3, name: "PagSeguro Moderninha", serial: "SN-4455667", rates: "Deb: 1.99%", status: "Inativa" },
   ];
 
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Maquininhas POS" subtitle="Histórico de Pagamentos" />
         <main className="flex-1 overflow-y-auto p-6">
           <div className="flex justify-between items-center mb-8">
             <div>
               <h2 className="text-xl font-bold">Terminais de Pagamento</h2>
               <p className="text-sm text-muted-foreground mt-1">Gerencie suas maquininhas de cartão e conciliação bancária.</p>
             </div>
             <div className="flex gap-3">
               <Button variant="outline" className="border-border rounded-xl">
                 <Receipt className="h-4 w-4 mr-2" /> Histórico Pagamentos
               </Button>
               <Button className="bg-gradient-primary shadow-glow rounded-xl font-bold">
                 <Plus className="h-4 w-4 mr-2" /> Nova Maquininha
               </Button>
             </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {terminals.map(term => (
               <Card key={term.id} className="p-6 border-border/50 hover:shadow-card transition-shadow relative overflow-hidden group">
                 <div className={`absolute top-0 right-0 h-20 w-20 ${term.status === 'Ativa' ? 'bg-green-500/5' : 'bg-slate-500/5'} rounded-bl-full -mr-6 -mt-6`} />
                 <div className="flex items-center justify-between mb-6">
                   <div className={`h-12 w-12 rounded-2xl ${term.status === 'Ativa' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} grid place-items-center`}>
                     <CreditCard className="h-6 w-6" />
                   </div>
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${term.status === 'Ativa' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                     {term.status}
                   </span>
                 </div>
                 <div className="space-y-1 mb-6">
                   <h3 className="font-bold text-lg">{term.name}</h3>
                   <p className="text-xs text-muted-foreground font-mono">Serial: {term.serial}</p>
                 </div>
                 <div className="p-4 rounded-xl bg-muted/50 border border-border/50 mb-6">
                   <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Taxas Aplicadas</div>
                   <div className="text-xs font-bold">{term.rates}</div>
                 </div>
                 <div className="flex gap-2">
                   <Button variant="outline" size="sm" className="flex-1 h-9 rounded-lg text-xs">Taxas</Button>
                   <Button variant="ghost" size="sm" className="h-9 w-9 rounded-lg"><Settings className="h-4 w-4" /></Button>
                 </div>
               </Card>
             ))}
           </div>
         </main>
       </div>
     </div>
   );
 }
