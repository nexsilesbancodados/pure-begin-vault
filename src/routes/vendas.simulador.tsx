 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { TaxSimulator } from "@/components/vendas/TaxSimulator";
 
 export const Route = createFileRoute("/vendas/simulador")({
   component: TaxSimulatorPage,
 });
 
 function TaxSimulatorPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Simulador de Taxas" subtitle="Cálculo de Margem e Parcelamento" />
         <main className="flex-1 overflow-y-auto p-6">
           <TaxSimulator />
         </main>
       </div>
     </div>
   );
 }
