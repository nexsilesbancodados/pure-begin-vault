 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { WarrantyMonitoring } from "@/components/vendas/WarrantyMonitoring";
 
 export const Route = createFileRoute("/vendas/garantias")({
   component: WarrantyPage,
 });
 
 function WarrantyPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Monitoramento de Garantias" subtitle="Pós-venda e Assistência" />
         <main className="flex-1 overflow-y-auto p-6">
           <WarrantyMonitoring />
         </main>
       </div>
     </div>
   );
 }
