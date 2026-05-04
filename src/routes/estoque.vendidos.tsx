import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Stockouts } from "@/components/estoque/Stockouts";
 
 export const Route = createFileRoute("/estoque/vendidos")({
   component: StockoutsPage,
 });
 
function StockoutsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

   return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
       <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Ruptura de Estoque" 
          subtitle="Produtos esgotados ou em nível crítico" 
          toggleSidebar={() => setSidebarOpen(true)} 
        />
         <main className="flex-1 overflow-y-auto p-6">
           <Stockouts />
         </main>
       </div>
     </div>
   );
 }
