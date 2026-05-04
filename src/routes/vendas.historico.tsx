 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { SalesHistory } from "@/components/vendas/SalesHistory";

export const Route = createFileRoute("/vendas/historico")({
   component: SalesHistoryPage,
});
 
 function SalesHistoryPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Histórico de Vendas" subtitle="Gestão de Vendas Realizadas" />
         <main className="flex-1 overflow-y-auto p-6">
           <SalesHistory />
         </main>
       </div>
     </div>
   );
 }
