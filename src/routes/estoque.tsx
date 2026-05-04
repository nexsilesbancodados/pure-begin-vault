import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { StockList } from "@/components/estoque/StockList";
 
 export const Route = createFileRoute("/estoque")({
   component: StockPage,
 });
 
 function StockPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Estoque" subtitle="Gestão de Inventário" />
         <main className="flex-1 overflow-y-auto p-6">
           <StockList />
         </main>
       </div>
     </div>
   );
 }
