import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import VendasDashboard from "@/components/vendas/VendasDashboard";

export const Route = createFileRoute("/vendas")({
   component: VendasPage,
});
 
 function VendasPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Gestão de Vendas" subtitle="Painel Comercial" />
         <main className="flex-1 overflow-y-auto">
           <VendasDashboard />
         </main>
       </div>
     </div>
   );
 }
