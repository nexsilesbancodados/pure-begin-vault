 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Quotations } from "@/components/vendas/Quotations";
 
 export const Route = createFileRoute("/vendas/orcamentos")({
   component: QuotationsPage,
 });
 
 function QuotationsPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Orçamentos" subtitle="Propostas e Pré-vendas" />
         <main className="flex-1 overflow-y-auto p-6">
           <Quotations />
         </main>
       </div>
     </div>
   );
 }
