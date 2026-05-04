 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { DREConfig } from "@/components/financeiro/DREConfig";
 
 export const Route = createFileRoute("/financeiro/dre")({
   component: DREPage,
 });
 
 function DREPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="DRE Gerencial" subtitle="Resultado da Operação" />
         <main className="flex-1 overflow-y-auto p-6">
           <DREConfig />
         </main>
       </div>
     </div>
   );
 }
