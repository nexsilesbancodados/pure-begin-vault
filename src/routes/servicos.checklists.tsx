 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { ClipboardCheck, Plus, Settings2 } from "lucide-react";
 
 export const Route = createFileRoute("/servicos/checklists")({
   component: OSChecklistsPage,
 });
 
 function OSChecklistsPage() {
   const checklists = [
     { id: 1, name: "Entrada de iPhone", items: 12, lastUpdate: "2024-03-20" },
     { id: 2, name: "Saída de Aparelho", items: 8, lastUpdate: "2024-03-21" },
     { id: 3, name: "Android Geral", items: 15, lastUpdate: "2024-03-15" },
   ];
 
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Modelos de Checklist" subtitle="Padronização de Testes" />
         <main className="flex-1 overflow-y-auto p-6">
           <div className="flex justify-between items-center mb-6">
             <p className="text-muted-foreground text-sm">Gerencie os itens de verificação obrigatórios para entrada e saída de serviços.</p>
             <Button className="bg-gradient-primary shadow-glow">
               <Plus className="h-4 w-4 mr-2" /> Novo Modelo
             </Button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {checklists.map(item => (
               <Card key={item.id} className="p-5 border-border/50 hover:shadow-card transition-shadow">
                 <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary mb-4">
                   <ClipboardCheck className="h-5 w-5" />
                 </div>
                 <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                 <p className="text-sm text-muted-foreground mb-4">{item.items} itens cadastrados</p>
                 <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                   <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Alt: {item.lastUpdate}</span>
                   <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                     <Settings2 className="h-4 w-4" />
                   </Button>
                 </div>
               </Card>
             ))}
           </div>
         </main>
       </div>
     </div>
   );
 }
